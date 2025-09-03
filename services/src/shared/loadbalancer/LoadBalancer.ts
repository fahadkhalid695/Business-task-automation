import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { CircuitBreaker } from '../utils/circuitBreaker';

const logger = new Logger('LoadBalancer');
const metrics = MetricsCollector.getInstance();

export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  healthy: boolean;
  lastHealthCheck: Date;
  responseTime: number;
  activeConnections: number;
  maxConnections: number;
  metadata?: Record<string, any>;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  expectedStatusCode?: number;
  expectedResponse?: string;
}

export interface LoadBalancingStrategy {
  name: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'response-time' | 'ip-hash';
  config?: Record<string, any>;
}

export class LoadBalancer {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthChecks: Map<string, HealthCheckConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.startHealthCheckMonitoring();
  }

  registerService(
    serviceName: string,
    instance: Omit<ServiceInstance, 'healthy' | 'lastHealthCheck' | 'responseTime' | 'activeConnections'>,
    healthCheckConfig: HealthCheckConfig
  ): void {
    const fullInstance: ServiceInstance = {
      ...instance,
      healthy: true,
      lastHealthCheck: new Date(),
      responseTime: 0,
      activeConnections: 0
    };

    const instances = this.services.get(serviceName) || [];
    instances.push(fullInstance);
    this.services.set(serviceName, instances);

    this.healthChecks.set(`${serviceName}:${instance.id}`, healthCheckConfig);
    
    // Create circuit breaker for this instance
    this.circuitBreakers.set(`${serviceName}:${instance.id}`, new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    }));

    logger.info(`Registered service instance: ${serviceName}:${instance.id}`, {
      host: instance.host,
      port: instance.port,
      weight: instance.weight
    });

    metrics.incrementCounter('loadbalancer_instances_registered_total', 1, {
      service: serviceName
    });
  }

  unregisterService(serviceName: string, instanceId: string): void {
    const instances = this.services.get(serviceName) || [];
    const filteredInstances = instances.filter(instance => instance.id !== instanceId);
    
    if (filteredInstances.length !== instances.length) {
      this.services.set(serviceName, filteredInstances);
      this.healthChecks.delete(`${serviceName}:${instanceId}`);
      this.circuitBreakers.delete(`${serviceName}:${instanceId}`);

      logger.info(`Unregistered service instance: ${serviceName}:${instanceId}`);
      
      metrics.incrementCounter('loadbalancer_instances_unregistered_total', 1, {
        service: serviceName
      });
    }
  }

  async selectInstance(
    serviceName: string,
    strategy: LoadBalancingStrategy = { name: 'round-robin' },
    clientInfo?: { ip?: string; sessionId?: string }
  ): Promise<ServiceInstance | null> {
    const instances = this.services.get(serviceName) || [];
    const healthyInstances = instances.filter(instance => 
      instance.healthy && 
      instance.activeConnections < instance.maxConnections
    );

    if (healthyInstances.length === 0) {
      logger.warn(`No healthy instances available for service: ${serviceName}`);
      metrics.incrementCounter('loadbalancer_no_instances_available_total', 1, {
        service: serviceName
      });
      return null;
    }

    let selectedInstance: ServiceInstance;

    switch (strategy.name) {
      case 'round-robin':
        selectedInstance = this.selectRoundRobin(serviceName, healthyInstances);
        break;
      case 'weighted-round-robin':
        selectedInstance = this.selectWeightedRoundRobin(serviceName, healthyInstances);
        break;
      case 'least-connections':
        selectedInstance = this.selectLeastConnections(healthyInstances);
        break;
      case 'response-time':
        selectedInstance = this.selectByResponseTime(healthyInstances);
        break;
      case 'ip-hash':
        selectedInstance = this.selectByIpHash(healthyInstances, clientInfo?.ip || '');
        break;
      default:
        selectedInstance = this.selectRoundRobin(serviceName, healthyInstances);
    }

    // Increment active connections
    selectedInstance.activeConnections++;

    metrics.incrementCounter('loadbalancer_requests_routed_total', 1, {
      service: serviceName,
      instance: selectedInstance.id,
      strategy: strategy.name
    });

    return selectedInstance;
  }

  private selectRoundRobin(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const selectedIndex = counter % instances.length;
    this.roundRobinCounters.set(serviceName, counter + 1);
    return instances[selectedIndex];
  }

  private selectWeightedRoundRobin(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    
    let weightedIndex = (counter % totalWeight) + 1;
    this.roundRobinCounters.set(serviceName, counter + 1);

    for (const instance of instances) {
      weightedIndex -= instance.weight;
      if (weightedIndex <= 0) {
        return instance;
      }
    }

    return instances[0]; // Fallback
  }

  private selectLeastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((least, current) => 
      current.activeConnections < least.activeConnections ? current : least
    );
  }

  private selectByResponseTime(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((fastest, current) => 
      current.responseTime < fastest.responseTime ? current : fastest
    );
  }

  private selectByIpHash(instances: ServiceInstance[], clientIp: string): ServiceInstance {
    // Simple hash function for IP-based routing
    const hash = clientIp.split('.').reduce((acc, octet) => acc + parseInt(octet, 10), 0);
    const index = hash % instances.length;
    return instances[index];
  }

  releaseConnection(serviceName: string, instanceId: string): void {
    const instances = this.services.get(serviceName) || [];
    const instance = instances.find(inst => inst.id === instanceId);
    
    if (instance && instance.activeConnections > 0) {
      instance.activeConnections--;
    }
  }

  private startHealthCheckMonitoring(): void {
    // Run health checks every 30 seconds
    const timer = setInterval(() => {
      this.performHealthChecks();
    }, 30000);

    this.healthCheckTimers.set('global', timer);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises: Promise<void>[] = [];

    for (const [serviceName, instances] of this.services) {
      for (const instance of instances) {
        const healthCheckKey = `${serviceName}:${instance.id}`;
        const healthCheckConfig = this.healthChecks.get(healthCheckKey);
        
        if (healthCheckConfig) {
          healthCheckPromises.push(
            this.performInstanceHealthCheck(serviceName, instance, healthCheckConfig)
          );
        }
      }
    }

    await Promise.allSettled(healthCheckPromises);
  }

  private async performInstanceHealthCheck(
    serviceName: string,
    instance: ServiceInstance,
    config: HealthCheckConfig
  ): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(`${serviceName}:${instance.id}`);
    
    if (circuitBreaker?.isOpen()) {
      instance.healthy = false;
      return;
    }

    const startTime = Date.now();
    let attempts = 0;

    while (attempts < config.retries) {
      try {
        const response = await this.makeHealthCheckRequest(instance, config);
        const responseTime = Date.now() - startTime;

        instance.responseTime = responseTime;
        instance.lastHealthCheck = new Date();

        if (this.isHealthCheckSuccessful(response, config)) {
          if (!instance.healthy) {
            logger.info(`Instance recovered: ${serviceName}:${instance.id}`);
            metrics.incrementCounter('loadbalancer_instance_recovered_total', 1, {
              service: serviceName,
              instance: instance.id
            });
          }
          
          instance.healthy = true;
          circuitBreaker?.recordSuccess();
          
          metrics.setGauge('loadbalancer_instance_response_time_ms', responseTime, {
            service: serviceName,
            instance: instance.id
          });
          
          return;
        }
      } catch (error) {
        logger.debug(`Health check failed for ${serviceName}:${instance.id}`, error);
        circuitBreaker?.recordFailure();
      }

      attempts++;
      if (attempts < config.retries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
      }
    }

    // All attempts failed
    if (instance.healthy) {
      logger.warn(`Instance became unhealthy: ${serviceName}:${instance.id}`);
      metrics.incrementCounter('loadbalancer_instance_failed_total', 1, {
        service: serviceName,
        instance: instance.id
      });
    }
    
    instance.healthy = false;
    instance.lastHealthCheck = new Date();
  }

  private async makeHealthCheckRequest(
    instance: ServiceInstance,
    config: HealthCheckConfig
  ): Promise<any> {
    const url = `http://${instance.host}:${instance.port}${config.endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'LoadBalancer-HealthCheck/1.0'
        }
      });

      clearTimeout(timeoutId);
      
      return {
        status: response.status,
        body: await response.text()
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private isHealthCheckSuccessful(response: any, config: HealthCheckConfig): boolean {
    const expectedStatus = config.expectedStatusCode || 200;
    
    if (response.status !== expectedStatus) {
      return false;
    }

    if (config.expectedResponse && !response.body.includes(config.expectedResponse)) {
      return false;
    }

    return true;
  }

  getServiceStats(serviceName?: string): Record<string, any> {
    const stats: Record<string, any> = {};

    const servicesToCheck = serviceName 
      ? [serviceName] 
      : Array.from(this.services.keys());

    for (const service of servicesToCheck) {
      const instances = this.services.get(service) || [];
      
      stats[service] = {
        totalInstances: instances.length,
        healthyInstances: instances.filter(i => i.healthy).length,
        totalConnections: instances.reduce((sum, i) => sum + i.activeConnections, 0),
        averageResponseTime: instances.length > 0 
          ? instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length 
          : 0,
        instances: instances.map(instance => ({
          id: instance.id,
          host: instance.host,
          port: instance.port,
          healthy: instance.healthy,
          activeConnections: instance.activeConnections,
          responseTime: instance.responseTime,
          lastHealthCheck: instance.lastHealthCheck
        }))
      };
    }

    return stats;
  }

  shutdown(): void {
    // Clear all health check timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    logger.info('Load balancer shutdown complete');
  }
}