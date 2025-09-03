import { Logger } from './logger';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuitBreaker';

export interface FallbackOptions {
  maxRetries: number;
  retryDelay: number;
  fallbackValue?: any;
  fallbackFunction?: () => Promise<any>;
  enableCircuitBreaker: boolean;
  circuitBreakerOptions?: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
  };
}

export interface ServiceDependency {
  name: string;
  critical: boolean;
  healthCheckUrl?: string;
  fallbackBehavior: 'fail' | 'degrade' | 'cache' | 'mock';
  fallbackData?: any;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'up' | 'down' | 'degraded';
    lastCheck: Date;
    responseTime?: number;
    error?: string;
  }>;
  degradedFeatures: string[];
  availableFeatures: string[];
}

export class GracefulDegradationManager {
  private static instance: GracefulDegradationManager;
  private logger: Logger;
  private dependencies: Map<string, ServiceDependency> = new Map();
  private serviceStatus: Map<string, any> = new Map();
  private degradedFeatures: Set<string> = new Set();
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private healthCheckInterval?: NodeJS.Timeout;

  private constructor() {
    this.logger = new Logger('GracefulDegradationManager');
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.startHealthChecks();
  }

  static getInstance(): GracefulDegradationManager {
    if (!GracefulDegradationManager.instance) {
      GracefulDegradationManager.instance = new GracefulDegradationManager();
    }
    return GracefulDegradationManager.instance;
  }

  registerDependency(dependency: ServiceDependency) {
    this.dependencies.set(dependency.name, dependency);
    this.serviceStatus.set(dependency.name, {
      status: 'up',
      lastCheck: new Date(),
      responseTime: 0
    });

    this.logger.info(`Registered service dependency: ${dependency.name}`, {
      critical: dependency.critical,
      fallbackBehavior: dependency.fallbackBehavior
    });
  }

  async executeWithFallback<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: Partial<FallbackOptions> = {}
  ): Promise<T> {
    const opts: FallbackOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      enableCircuitBreaker: true,
      circuitBreakerOptions: {
        failureThreshold: 0.5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000
      },
      ...options
    };

    let circuitBreaker: CircuitBreaker | undefined;
    
    if (opts.enableCircuitBreaker) {
      circuitBreaker = this.circuitBreakerRegistry.register(
        operationName,
        opts.circuitBreakerOptions!
      );
    }

    const executeOperation = async (): Promise<T> => {
      if (circuitBreaker) {
        return await circuitBreaker.execute(operation);
      }
      return await operation();
    };

    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        const result = await executeOperation();
        
        if (attempt > 1) {
          this.logger.info(`Operation ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        this.logger.warn(`Operation ${operationName} failed on attempt ${attempt}`, {
          error: lastError.message,
          attempt,
          maxRetries: opts.maxRetries
        });

        if (attempt < opts.maxRetries) {
          await this.delay(opts.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed, try fallback
    return await this.executeFallback(operationName, opts, lastError!);
  }

  private async executeFallback<T>(
    operationName: string,
    options: FallbackOptions,
    error: Error
  ): Promise<T> {
    this.logger.error(`All retries failed for ${operationName}, executing fallback`, error);

    // Mark feature as degraded
    this.degradedFeatures.add(operationName);

    if (options.fallbackFunction) {
      try {
        const result = await options.fallbackFunction();
        this.logger.info(`Fallback function executed successfully for ${operationName}`);
        return result;
      } catch (fallbackError) {
        this.logger.error(`Fallback function failed for ${operationName}`, fallbackError as Error);
      }
    }

    if (options.fallbackValue !== undefined) {
      this.logger.info(`Using fallback value for ${operationName}`);
      return options.fallbackValue;
    }

    // No fallback available, throw the original error
    throw error;
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const dependency = this.dependencies.get(serviceName);
    if (!dependency) {
      this.logger.warn(`Unknown service dependency: ${serviceName}`);
      return false;
    }

    const startTime = Date.now();
    
    try {
      if (dependency.healthCheckUrl) {
        // In a real implementation, you would make an HTTP request here
        // For now, we'll simulate the health check
        await this.simulateHealthCheck(dependency.healthCheckUrl);
      }

      const responseTime = Date.now() - startTime;
      
      this.serviceStatus.set(serviceName, {
        status: 'up',
        lastCheck: new Date(),
        responseTime
      });

      // Remove from degraded features if it was there
      this.degradedFeatures.delete(serviceName);

      return true;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.serviceStatus.set(serviceName, {
        status: 'down',
        lastCheck: new Date(),
        responseTime,
        error: (error as Error).message
      });

      this.handleServiceFailure(dependency);
      return false;
    }
  }

  private async simulateHealthCheck(url: string): Promise<void> {
    // Simulate network delay and potential failure
    await this.delay(Math.random() * 100);
    
    // Simulate 5% failure rate
    if (Math.random() < 0.05) {
      throw new Error(`Health check failed for ${url}`);
    }
  }

  private handleServiceFailure(dependency: ServiceDependency) {
    this.logger.error(`Service ${dependency.name} is down`, {
      critical: dependency.critical,
      fallbackBehavior: dependency.fallbackBehavior
    });

    switch (dependency.fallbackBehavior) {
      case 'degrade':
        this.degradedFeatures.add(dependency.name);
        this.logger.info(`Feature ${dependency.name} degraded due to service failure`);
        break;
      
      case 'fail':
        if (dependency.critical) {
          this.logger.error(`Critical service ${dependency.name} failed - system may be unstable`);
        }
        break;
      
      case 'cache':
        this.logger.info(`Using cached data for ${dependency.name}`);
        break;
      
      case 'mock':
        this.logger.info(`Using mock data for ${dependency.name}`);
        break;
    }
  }

  getSystemHealth(): SystemHealthStatus {
    const services: Record<string, any> = {};
    let healthyServices = 0;
    let totalServices = 0;

    for (const [name, status] of this.serviceStatus) {
      services[name] = status;
      totalServices++;
      if (status.status === 'up') {
        healthyServices++;
      }
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    const healthRatio = totalServices > 0 ? healthyServices / totalServices : 1;

    if (healthRatio >= 0.9) {
      overall = 'healthy';
    } else if (healthRatio >= 0.5) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    const availableFeatures = Array.from(this.dependencies.keys())
      .filter(name => !this.degradedFeatures.has(name));

    return {
      overall,
      services,
      degradedFeatures: Array.from(this.degradedFeatures),
      availableFeatures
    };
  }

  isFeatureAvailable(featureName: string): boolean {
    return !this.degradedFeatures.has(featureName);
  }

  async recoverFeature(featureName: string): Promise<boolean> {
    const dependency = this.dependencies.get(featureName);
    if (!dependency) {
      return false;
    }

    const isHealthy = await this.checkServiceHealth(featureName);
    if (isHealthy) {
      this.degradedFeatures.delete(featureName);
      this.logger.info(`Feature ${featureName} recovered`);
      return true;
    }

    return false;
  }

  private startHealthChecks() {
    // Check service health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      for (const serviceName of this.dependencies.keys()) {
        await this.checkServiceHealth(serviceName);
      }
    }, 30000);

    this.logger.info('Started periodic health checks');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.logger.info('Stopped health checks');
    }
  }
}

// Utility decorator for automatic fallback handling
export function withFallback<T extends any[], R>(
  operationName: string,
  options: Partial<FallbackOptions> = {}
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = async function (...args: T): Promise<R> {
      const degradationManager = GracefulDegradationManager.getInstance();
      
      return await degradationManager.executeWithFallback(
        `${target.constructor.name}.${propertyName}`,
        () => method.apply(this, args),
        options
      );
    };
  };
}

// Utility function for creating fallback functions
export const createFallbackFunction = <T>(
  fallbackValue: T,
  logMessage?: string
) => {
  return async (): Promise<T> => {
    if (logMessage) {
      const logger = new Logger('FallbackFunction');
      logger.info(logMessage);
    }
    return fallbackValue;
  };
};