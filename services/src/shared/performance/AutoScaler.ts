import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { CapacityPlanner } from '../monitoring/CapacityPlanner';

const logger = new Logger('AutoScaler');
const metrics = MetricsCollector.getInstance();

export interface ScalingRule {
  name: string;
  metric: string;
  threshold: number;
  comparison: 'greater' | 'less' | 'equal';
  action: 'scale_up' | 'scale_down';
  cooldownPeriod: number; // milliseconds
  minInstances: number;
  maxInstances: number;
  scaleStep: number;
  enabled: boolean;
}

export interface ScalingEvent {
  timestamp: Date;
  rule: string;
  action: 'scale_up' | 'scale_down';
  fromInstances: number;
  toInstances: number;
  metric: string;
  metricValue: number;
  threshold: number;
  reason: string;
}

export interface AutoScalerConfig {
  evaluationInterval: number; // milliseconds
  defaultCooldownPeriod: number; // milliseconds
  enablePredictiveScaling: boolean;
  predictionWindow: number; // milliseconds
  kubernetesEnabled: boolean;
  kubernetesNamespace: string;
}

export interface ServiceScalingConfig {
  serviceName: string;
  currentInstances: number;
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  targetRequestsPerSecond: number;
  customMetrics: Array<{
    name: string;
    target: number;
    weight: number;
  }>;
}

export class AutoScaler {
  private static instance: AutoScaler;
  private config: AutoScalerConfig;
  private scalingRules: Map<string, ScalingRule[]> = new Map();
  private scalingHistory: Map<string, ScalingEvent[]> = new Map();
  private lastScalingAction: Map<string, Date> = new Map();
  private currentInstances: Map<string, number> = new Map();
  private evaluationTimer?: NodeJS.Timeout;
  private capacityPlanner: CapacityPlanner;

  private constructor(config: Partial<AutoScalerConfig> = {}) {
    this.config = {
      evaluationInterval: 30000, // 30 seconds
      defaultCooldownPeriod: 300000, // 5 minutes
      enablePredictiveScaling: true,
      predictionWindow: 600000, // 10 minutes
      kubernetesEnabled: true,
      kubernetesNamespace: 'default',
      ...config
    };

    this.capacityPlanner = CapacityPlanner.getInstance();
    this.startEvaluationLoop();
  }

  static getInstance(config?: Partial<AutoScalerConfig>): AutoScaler {
    if (!AutoScaler.instance) {
      AutoScaler.instance = new AutoScaler(config);
    }
    return AutoScaler.instance;
  }

  private startEvaluationLoop(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateScalingRules();
    }, this.config.evaluationInterval);

    logger.info('Auto-scaler evaluation loop started', {
      interval: this.config.evaluationInterval
    });
  }

  registerService(serviceName: string, config: ServiceScalingConfig): void {
    // Create default scaling rules based on service config
    const rules: ScalingRule[] = [
      {
        name: `${serviceName}_cpu_scale_up`,
        metric: 'cpu_utilization',
        threshold: config.targetCpuUtilization,
        comparison: 'greater',
        action: 'scale_up',
        cooldownPeriod: this.config.defaultCooldownPeriod,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        scaleStep: Math.max(1, Math.ceil(config.currentInstances * 0.5)), // Scale by 50%
        enabled: true
      },
      {
        name: `${serviceName}_cpu_scale_down`,
        metric: 'cpu_utilization',
        threshold: config.targetCpuUtilization * 0.5, // Scale down at 50% of target
        comparison: 'less',
        action: 'scale_down',
        cooldownPeriod: this.config.defaultCooldownPeriod * 2, // Longer cooldown for scale down
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        scaleStep: Math.max(1, Math.ceil(config.currentInstances * 0.25)), // Scale down by 25%
        enabled: true
      },
      {
        name: `${serviceName}_memory_scale_up`,
        metric: 'memory_utilization',
        threshold: config.targetMemoryUtilization,
        comparison: 'greater',
        action: 'scale_up',
        cooldownPeriod: this.config.defaultCooldownPeriod,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        scaleStep: Math.max(1, Math.ceil(config.currentInstances * 0.5)),
        enabled: true
      },
      {
        name: `${serviceName}_rps_scale_up`,
        metric: 'requests_per_second',
        threshold: config.targetRequestsPerSecond,
        comparison: 'greater',
        action: 'scale_up',
        cooldownPeriod: this.config.defaultCooldownPeriod / 2, // Faster response to traffic spikes
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        scaleStep: Math.max(2, Math.ceil(config.currentInstances * 0.75)), // Aggressive scaling for traffic
        enabled: true
      }
    ];

    // Add custom metric rules
    for (const customMetric of config.customMetrics) {
      rules.push({
        name: `${serviceName}_${customMetric.name}_scale_up`,
        metric: customMetric.name,
        threshold: customMetric.target,
        comparison: 'greater',
        action: 'scale_up',
        cooldownPeriod: this.config.defaultCooldownPeriod,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        scaleStep: Math.max(1, Math.ceil(config.currentInstances * (customMetric.weight / 100))),
        enabled: true
      });
    }

    this.scalingRules.set(serviceName, rules);
    this.currentInstances.set(serviceName, config.currentInstances);

    logger.info(`Registered service for auto-scaling: ${serviceName}`, {
      rules: rules.length,
      currentInstances: config.currentInstances
    });

    metrics.setGauge('autoscaler_registered_services', this.scalingRules.size);
  }

  addScalingRule(serviceName: string, rule: ScalingRule): void {
    const existingRules = this.scalingRules.get(serviceName) || [];
    existingRules.push(rule);
    this.scalingRules.set(serviceName, existingRules);

    logger.info(`Added scaling rule: ${rule.name} for service: ${serviceName}`);
  }

  removeScalingRule(serviceName: string, ruleName: string): void {
    const existingRules = this.scalingRules.get(serviceName) || [];
    const filteredRules = existingRules.filter(rule => rule.name !== ruleName);
    this.scalingRules.set(serviceName, filteredRules);

    logger.info(`Removed scaling rule: ${ruleName} for service: ${serviceName}`);
  }

  enableRule(serviceName: string, ruleName: string): void {
    const rules = this.scalingRules.get(serviceName) || [];
    const rule = rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = true;
      logger.info(`Enabled scaling rule: ${ruleName} for service: ${serviceName}`);
    }
  }

  disableRule(serviceName: string, ruleName: string): void {
    const rules = this.scalingRules.get(serviceName) || [];
    const rule = rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = false;
      logger.info(`Disabled scaling rule: ${ruleName} for service: ${serviceName}`);
    }
  }

  private async evaluateScalingRules(): Promise<void> {
    for (const [serviceName, rules] of this.scalingRules) {
      try {
        await this.evaluateServiceRules(serviceName, rules);
      } catch (error) {
        logger.error(`Failed to evaluate scaling rules for service: ${serviceName}`, error);
      }
    }
  }

  private async evaluateServiceRules(serviceName: string, rules: ScalingRule[]): Promise<void> {
    const currentMetrics = await this.getCurrentMetrics(serviceName);
    const currentInstances = this.currentInstances.get(serviceName) || 1;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check cooldown period
      const lastAction = this.lastScalingAction.get(`${serviceName}:${rule.name}`);
      if (lastAction && Date.now() - lastAction.getTime() < rule.cooldownPeriod) {
        continue;
      }

      const metricValue = currentMetrics[rule.metric];
      if (metricValue === undefined) {
        logger.debug(`Metric ${rule.metric} not available for service: ${serviceName}`);
        continue;
      }

      const shouldScale = this.evaluateRule(rule, metricValue);
      if (shouldScale) {
        await this.executeScalingAction(serviceName, rule, metricValue, currentInstances);
      }
    }

    // Predictive scaling
    if (this.config.enablePredictiveScaling) {
      await this.evaluatePredictiveScaling(serviceName, currentMetrics, currentInstances);
    }
  }

  private evaluateRule(rule: ScalingRule, metricValue: number): boolean {
    switch (rule.comparison) {
      case 'greater':
        return metricValue > rule.threshold;
      case 'less':
        return metricValue < rule.threshold;
      case 'equal':
        return Math.abs(metricValue - rule.threshold) < 0.01; // Small tolerance for floating point
      default:
        return false;
    }
  }

  private async executeScalingAction(
    serviceName: string,
    rule: ScalingRule,
    metricValue: number,
    currentInstances: number
  ): Promise<void> {
    let targetInstances: number;

    if (rule.action === 'scale_up') {
      targetInstances = Math.min(
        rule.maxInstances,
        currentInstances + rule.scaleStep
      );
    } else {
      targetInstances = Math.max(
        rule.minInstances,
        currentInstances - rule.scaleStep
      );
    }

    if (targetInstances === currentInstances) {
      logger.debug(`No scaling needed for ${serviceName}, already at limits`);
      return;
    }

    const scalingEvent: ScalingEvent = {
      timestamp: new Date(),
      rule: rule.name,
      action: rule.action,
      fromInstances: currentInstances,
      toInstances: targetInstances,
      metric: rule.metric,
      metricValue,
      threshold: rule.threshold,
      reason: `${rule.metric} (${metricValue.toFixed(2)}) ${rule.comparison} threshold (${rule.threshold})`
    };

    try {
      // Execute the scaling action
      if (this.config.kubernetesEnabled) {
        await this.scaleKubernetesDeployment(serviceName, targetInstances);
      } else {
        await this.scaleService(serviceName, targetInstances);
      }

      // Update state
      this.currentInstances.set(serviceName, targetInstances);
      this.lastScalingAction.set(`${serviceName}:${rule.name}`, new Date());

      // Record event
      const history = this.scalingHistory.get(serviceName) || [];
      history.push(scalingEvent);
      
      // Keep only last 100 events
      if (history.length > 100) {
        history.shift();
      }
      
      this.scalingHistory.set(serviceName, history);

      logger.info(`Scaled service: ${serviceName}`, {
        action: rule.action,
        fromInstances: currentInstances,
        toInstances: targetInstances,
        rule: rule.name,
        metric: rule.metric,
        metricValue,
        threshold: rule.threshold
      });

      metrics.incrementCounter('autoscaler_scaling_actions_total', 1, {
        service: serviceName,
        action: rule.action,
        rule: rule.name
      });

      metrics.setGauge('autoscaler_current_instances', targetInstances, {
        service: serviceName
      });

    } catch (error) {
      logger.error(`Failed to scale service: ${serviceName}`, error, {
        targetInstances,
        rule: rule.name
      });

      metrics.incrementCounter('autoscaler_scaling_errors_total', 1, {
        service: serviceName,
        action: rule.action
      });
    }
  }

  private async evaluatePredictiveScaling(
    serviceName: string,
    currentMetrics: Record<string, number>,
    currentInstances: number
  ): Promise<void> {
    try {
      // Use capacity planner to predict future resource needs
      const forecasts = await this.capacityPlanner.generateForecasts();
      
      for (const forecast of forecasts) {
        if (forecast.timeToCapacity < this.config.predictionWindow / (24 * 60 * 60 * 1000)) { // Convert to days
          const recommendedAction = this.getPredictiveScalingAction(forecast, currentInstances);
          
          if (recommendedAction) {
            logger.info(`Predictive scaling recommendation for ${serviceName}`, {
              resource: forecast.resource,
              currentUsage: forecast.currentUsage,
              projectedUsage: forecast.projectedUsage,
              timeToCapacity: forecast.timeToCapacity,
              recommendedAction
            });

            // Execute predictive scaling with lower priority (smaller steps)
            if (recommendedAction === 'scale_up') {
              const targetInstances = Math.min(
                currentInstances + 1, // Conservative predictive scaling
                currentInstances * 1.2 // Max 20% increase
              );
              
              if (targetInstances > currentInstances) {
                await this.executeScalingAction(
                  serviceName,
                  {
                    name: 'predictive_scaling',
                    metric: forecast.resource,
                    threshold: forecast.projectedUsage,
                    comparison: 'greater',
                    action: 'scale_up',
                    cooldownPeriod: this.config.defaultCooldownPeriod * 2, // Longer cooldown for predictive
                    minInstances: 1,
                    maxInstances: 100,
                    scaleStep: 1,
                    enabled: true
                  },
                  forecast.projectedUsage,
                  currentInstances
                );
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Predictive scaling evaluation failed for ${serviceName}`, error);
    }
  }

  private getPredictiveScalingAction(forecast: any, currentInstances: number): 'scale_up' | 'scale_down' | null {
    if (forecast.recommendedAction === 'scale_up' && forecast.confidence > 0.7) {
      return 'scale_up';
    }
    
    if (forecast.recommendedAction === 'scale_out' && forecast.confidence > 0.8) {
      return 'scale_up';
    }

    return null;
  }

  private async getCurrentMetrics(serviceName: string): Promise<Record<string, number>> {
    // Get metrics from the metrics collector
    const metricsData = metrics.getMetrics();
    
    return {
      cpu_utilization: metricsData.gauges[`service_cpu_utilization_${serviceName}`] || 0,
      memory_utilization: metricsData.gauges[`service_memory_utilization_${serviceName}`] || 0,
      requests_per_second: metricsData.gauges[`service_requests_per_second_${serviceName}`] || 0,
      response_time: metricsData.gauges[`service_response_time_${serviceName}`] || 0,
      error_rate: metricsData.gauges[`service_error_rate_${serviceName}`] || 0,
      queue_length: metricsData.gauges[`service_queue_length_${serviceName}`] || 0,
      active_connections: metricsData.gauges[`service_active_connections_${serviceName}`] || 0
    };
  }

  private async scaleKubernetesDeployment(serviceName: string, targetInstances: number): Promise<void> {
    // In a real implementation, this would use the Kubernetes API
    // For now, we'll simulate the scaling action
    
    logger.info(`Scaling Kubernetes deployment: ${serviceName} to ${targetInstances} instances`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In production, you would use something like:
    // const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    // await k8sApi.patchNamespacedDeploymentScale(
    //   serviceName,
    //   this.config.kubernetesNamespace,
    //   { spec: { replicas: targetInstances } }
    // );
  }

  private async scaleService(serviceName: string, targetInstances: number): Promise<void> {
    // Custom scaling logic for non-Kubernetes environments
    logger.info(`Scaling service: ${serviceName} to ${targetInstances} instances`);
    
    // Implement your custom scaling logic here
    // This could involve starting/stopping Docker containers,
    // updating load balancer configuration, etc.
  }

  // Manual scaling
  async manualScale(serviceName: string, targetInstances: number, reason: string): Promise<void> {
    const currentInstances = this.currentInstances.get(serviceName) || 1;
    
    if (targetInstances === currentInstances) {
      logger.info(`Service ${serviceName} already at target instances: ${targetInstances}`);
      return;
    }

    const scalingEvent: ScalingEvent = {
      timestamp: new Date(),
      rule: 'manual',
      action: targetInstances > currentInstances ? 'scale_up' : 'scale_down',
      fromInstances: currentInstances,
      toInstances: targetInstances,
      metric: 'manual',
      metricValue: targetInstances,
      threshold: currentInstances,
      reason
    };

    try {
      if (this.config.kubernetesEnabled) {
        await this.scaleKubernetesDeployment(serviceName, targetInstances);
      } else {
        await this.scaleService(serviceName, targetInstances);
      }

      this.currentInstances.set(serviceName, targetInstances);

      const history = this.scalingHistory.get(serviceName) || [];
      history.push(scalingEvent);
      this.scalingHistory.set(serviceName, history);

      logger.info(`Manually scaled service: ${serviceName}`, {
        fromInstances: currentInstances,
        toInstances: targetInstances,
        reason
      });

      metrics.incrementCounter('autoscaler_manual_scaling_total', 1, {
        service: serviceName,
        action: scalingEvent.action
      });

    } catch (error) {
      logger.error(`Manual scaling failed for service: ${serviceName}`, error);
      throw error;
    }
  }

  // Status and monitoring
  getServiceStatus(serviceName: string): {
    currentInstances: number;
    rules: ScalingRule[];
    recentEvents: ScalingEvent[];
    lastEvaluation: Date;
  } | null {
    const rules = this.scalingRules.get(serviceName);
    if (!rules) return null;

    const history = this.scalingHistory.get(serviceName) || [];
    
    return {
      currentInstances: this.currentInstances.get(serviceName) || 0,
      rules,
      recentEvents: history.slice(-10), // Last 10 events
      lastEvaluation: new Date() // This would be tracked in a real implementation
    };
  }

  getAllServicesStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const serviceName of this.scalingRules.keys()) {
      status[serviceName] = this.getServiceStatus(serviceName);
    }

    return status;
  }

  getScalingHistory(serviceName?: string, limit = 50): ScalingEvent[] {
    if (serviceName) {
      const history = this.scalingHistory.get(serviceName) || [];
      return history.slice(-limit);
    }

    // Return combined history for all services
    const allEvents: ScalingEvent[] = [];
    for (const history of this.scalingHistory.values()) {
      allEvents.push(...history);
    }

    return allEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  shutdown(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }

    logger.info('Auto-scaler shutdown complete');
  }
}