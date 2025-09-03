import { Express } from 'express';
import { MonitoringService, requestLoggingMiddleware, performanceMiddleware } from '../middleware/monitoring';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import { tracingMiddleware } from './tracing';
import { GracefulDegradationManager } from './gracefulDegradation';
import { CircuitBreakerRegistry } from './circuitBreaker';
import { MetricsCollector } from './metrics';
import { Logger } from './logger';

export class MonitoringIntegration {
  private logger: Logger;
  private monitoringService: MonitoringService;
  private degradationManager: GracefulDegradationManager;
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private metricsCollector: MetricsCollector;

  constructor() {
    this.logger = new Logger('MonitoringIntegration');
    this.monitoringService = new MonitoringService();
    this.degradationManager = GracefulDegradationManager.getInstance();
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.metricsCollector = MetricsCollector.getInstance();
  }

  setupMonitoring(app: Express): void {
    this.logger.info('Setting up comprehensive monitoring and error handling');

    // Setup middleware in correct order
    this.setupMiddleware(app);
    
    // Setup monitoring endpoints
    this.setupMonitoringEndpoints(app);
    
    // Setup service dependencies
    this.setupServiceDependencies();
    
    // Setup circuit breakers for external services
    this.setupCircuitBreakers();
    
    // Setup error handlers (must be last)
    this.setupErrorHandlers(app);

    this.logger.info('Monitoring and error handling setup complete');
  }

  private setupMiddleware(app: Express): void {
    // Request tracing (should be first)
    app.use(tracingMiddleware);
    
    // Request logging
    app.use(requestLoggingMiddleware);
    
    // Performance monitoring
    app.use(performanceMiddleware);
  }

  private setupMonitoringEndpoints(app: Express): void {
    // Health check endpoints
    app.get('/health', this.monitoringService.healthCheck);
    app.get('/health/ready', this.monitoringService.readinessCheck);
    app.get('/health/live', this.monitoringService.livenessCheck);
    
    // Metrics and monitoring endpoints
    app.get('/metrics', this.monitoringService.metricsEndpoint);
    app.get('/status', this.monitoringService.systemStatus);
    
    // Circuit breaker status
    app.get('/circuit-breakers', (req, res) => {
      const metrics = this.circuitBreakerRegistry.getAllMetrics();
      const health = this.circuitBreakerRegistry.getHealthStatus();
      
      res.json({
        metrics,
        health,
        timestamp: new Date().toISOString()
      });
    });

    this.logger.info('Monitoring endpoints configured');
  }

  private setupServiceDependencies(): void {
    // Register critical service dependencies
    this.degradationManager.registerDependency({
      name: 'database',
      critical: true,
      healthCheckUrl: process.env.DATABASE_HEALTH_URL,
      fallbackBehavior: 'fail'
    });

    this.degradationManager.registerDependency({
      name: 'cache',
      critical: false,
      healthCheckUrl: process.env.REDIS_HEALTH_URL,
      fallbackBehavior: 'degrade'
    });

    this.degradationManager.registerDependency({
      name: 'ai-service',
      critical: false,
      healthCheckUrl: process.env.AI_SERVICE_HEALTH_URL,
      fallbackBehavior: 'cache',
      fallbackData: { message: 'AI service temporarily unavailable' }
    });

    this.degradationManager.registerDependency({
      name: 'email-service',
      critical: false,
      healthCheckUrl: process.env.EMAIL_SERVICE_HEALTH_URL,
      fallbackBehavior: 'degrade'
    });

    this.logger.info('Service dependencies registered');
  }

  private setupCircuitBreakers(): void {
    // Database circuit breaker
    this.circuitBreakerRegistry.register('database', {
      failureThreshold: 0.5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      expectedErrors: ['ValidationError', 'CastError']
    });

    // External API circuit breaker
    this.circuitBreakerRegistry.register('external-api', {
      failureThreshold: 0.6,
      recoveryTimeout: 60000,
      monitoringPeriod: 120000,
      expectedErrors: ['AuthenticationError', 'ValidationError']
    });

    // AI service circuit breaker
    this.circuitBreakerRegistry.register('ai-service', {
      failureThreshold: 0.4,
      recoveryTimeout: 45000,
      monitoringPeriod: 90000
    });

    // Email service circuit breaker
    this.circuitBreakerRegistry.register('email-service', {
      failureThreshold: 0.7,
      recoveryTimeout: 120000,
      monitoringPeriod: 180000
    });

    this.logger.info('Circuit breakers configured');
  }

  private setupErrorHandlers(app: Express): void {
    // 404 handler (must be before error handler)
    app.use(notFoundHandler);
    
    // Global error handler (must be last)
    app.use(errorHandler);

    this.logger.info('Error handlers configured');
  }

  // Utility method to get comprehensive system status
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    components: Record<string, any>;
  }> {
    const [
      systemHealth,
      circuitBreakerHealth,
      metrics
    ] = await Promise.all([
      this.degradationManager.getSystemHealth(),
      this.circuitBreakerRegistry.getHealthStatus(),
      this.metricsCollector.getMetrics()
    ]);

    // Determine overall system status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (systemHealth.overall === 'unhealthy' || !circuitBreakerHealth.healthy) {
      overallStatus = 'unhealthy';
    } else if (systemHealth.overall === 'degraded' || systemHealth.degradedFeatures.length > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        services: systemHealth,
        circuitBreakers: {
          healthy: circuitBreakerHealth.healthy,
          details: circuitBreakerHealth.details
        },
        performance: {
          errorRate: metrics.gauges['http_error_rate_percent'] || 0,
          taskSuccessRate: metrics.gauges['task_success_rate_percent'] || 100,
          memoryUsage: metrics.gauges['system_memory_usage_percent'] || 0,
          cpuUsage: metrics.gauges['system_cpu_usage_percent'] || 0
        }
      }
    };
  }

  // Method to trigger alerts for testing
  triggerTestAlert(alertType: 'performance' | 'error' | 'security' = 'performance'): void {
    switch (alertType) {
      case 'performance':
        this.metricsCollector.setGauge('system_memory_usage_percent', 95);
        this.logger.warn('Test performance alert triggered');
        break;
      
      case 'error':
        for (let i = 0; i < 15; i++) {
          this.metricsCollector.incrementCounter('http_errors_total', 1);
        }
        this.logger.warn('Test error alert triggered');
        break;
      
      case 'security':
        this.logger.security('Test security alert triggered', 'high', {
          testAlert: true,
          timestamp: new Date().toISOString()
        });
        break;
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down monitoring systems');
    
    try {
      this.degradationManager.shutdown();
      this.logger.info('Monitoring systems shut down successfully');
    } catch (error) {
      this.logger.error('Error during monitoring shutdown', error as Error);
    }
  }
}

// Export singleton instance
export const monitoringIntegration = new MonitoringIntegration();

// Utility function to setup monitoring in Express app
export const setupMonitoring = (app: Express): void => {
  monitoringIntegration.setupMonitoring(app);
};

// Utility function for graceful shutdown
export const shutdownMonitoring = async (): Promise<void> => {
  await monitoringIntegration.shutdown();
};