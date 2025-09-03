import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';
import { GracefulDegradationManager } from '../utils/gracefulDegradation';
import { DistributedTracer } from '../utils/tracing';
import { ErrorTracker } from '../utils/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    responseTime?: number;
    details?: any;
  }>;
  metrics?: {
    memory: NodeJS.MemoryUsage;
    cpu?: number;
    activeConnections?: number;
    requestsPerSecond?: number;
    errorRate?: number;
  };
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, any>;
  circuitBreakers: Record<string, any>;
  errors: Record<string, any>;
  traces: Record<string, any>;
  performance: Record<string, any>;
}

export class MonitoringService {
  private logger: Logger;
  private metricsCollector: MetricsCollector;
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private degradationManager: GracefulDegradationManager;
  private tracer: DistributedTracer;
  private errorTracker: ErrorTracker;
  private startTime: number;

  constructor() {
    this.logger = new Logger('MonitoringService');
    this.metricsCollector = MetricsCollector.getInstance();
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.degradationManager = GracefulDegradationManager.getInstance();
    this.tracer = DistributedTracer.getInstance();
    this.errorTracker = ErrorTracker.getInstance();
    this.startTime = Date.now();
  }

  // Health check endpoint
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      const healthResult = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;
      
      // Record health check metrics
      this.metricsCollector.recordResponseTime('/health', 'GET', 200, responseTime);
      this.metricsCollector.incrementCounter('health_checks_total', 1, {
        status: healthResult.status
      });

      const statusCode = healthResult.status === 'healthy' ? 200 : 
                        healthResult.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(healthResult);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error('Health check failed', error as Error);
      this.metricsCollector.recordResponseTime('/health', 'GET', 500, responseTime);
      this.metricsCollector.incrementCounter('health_checks_total', 1, {
        status: 'error'
      });

      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  };

  // Readiness probe
  readinessCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const isReady = await this.checkReadiness();
      
      if (isReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Readiness check failed', error as Error);
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  };

  // Liveness probe
  livenessCheck = (req: Request, res: Response): void => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime
    });
  };

  // Metrics endpoint
  metricsEndpoint = (req: Request, res: Response): void => {
    try {
      const metrics = this.metricsCollector.getMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      this.logger.error('Failed to retrieve metrics', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve metrics'
      });
    }
  };

  // System status endpoint
  systemStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.getSystemStatus();
      res.status(200).json(status);
    } catch (error) {
      this.logger.error('Failed to retrieve system status', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve system status'
      });
    }
  };

  private async performHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    
    // Database health check
    checks.database = await this.checkDatabase();
    
    // Cache health check
    checks.cache = await this.checkCache();
    
    // External services health check
    checks.externalServices = await this.checkExternalServices();
    
    // Memory health check
    checks.memory = this.checkMemory();
    
    // Circuit breakers health check
    checks.circuitBreakers = this.checkCircuitBreakers();

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail');
    const warnChecks = Object.values(checks).filter(check => check.status === 'warn');
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length > 0) {
      status = 'unhealthy';
    } else if (warnChecks.length > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      metrics: {
        memory: process.memoryUsage(),
        activeConnections: this.getActiveConnections(),
        requestsPerSecond: this.getRequestsPerSecond(),
        errorRate: this.getErrorRate()
      }
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, this would ping the database
      // For now, we'll simulate it
      await this.simulateAsyncCheck('database', 50);
      
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: 'Database connection healthy'
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Database check failed: ${(error as Error).message}`
      };
    }
  }

  private async checkCache(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, this would ping Redis
      await this.simulateAsyncCheck('cache', 20);
      
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: 'Cache connection healthy'
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Cache check failed: ${(error as Error).message}`
      };
    }
  }

  private async checkExternalServices(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      const systemHealth = this.degradationManager.getSystemHealth();
      const healthyServices = Object.values(systemHealth.services)
        .filter(service => service.status === 'up').length;
      const totalServices = Object.keys(systemHealth.services).length;
      
      if (totalServices === 0) {
        return {
          status: 'pass',
          responseTime: Date.now() - startTime,
          message: 'No external services configured'
        };
      }
      
      const healthRatio = healthyServices / totalServices;
      
      if (healthRatio >= 0.8) {
        return {
          status: 'pass',
          responseTime: Date.now() - startTime,
          message: `${healthyServices}/${totalServices} external services healthy`,
          details: systemHealth.services
        };
      } else if (healthRatio >= 0.5) {
        return {
          status: 'warn',
          responseTime: Date.now() - startTime,
          message: `${healthyServices}/${totalServices} external services healthy`,
          details: systemHealth.services
        };
      } else {
        return {
          status: 'fail',
          responseTime: Date.now() - startTime,
          message: `Only ${healthyServices}/${totalServices} external services healthy`,
          details: systemHealth.services
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `External services check failed: ${(error as Error).message}`
      };
    }
  }

  private checkMemory(): HealthCheckResult['checks'][string] {
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memUsagePercent > 90) {
      return {
        status: 'fail',
        message: `Memory usage critical: ${memUsagePercent.toFixed(1)}%`,
        details: memUsage
      };
    } else if (memUsagePercent > 75) {
      return {
        status: 'warn',
        message: `Memory usage high: ${memUsagePercent.toFixed(1)}%`,
        details: memUsage
      };
    } else {
      return {
        status: 'pass',
        message: `Memory usage normal: ${memUsagePercent.toFixed(1)}%`,
        details: memUsage
      };
    }
  }

  private checkCircuitBreakers(): HealthCheckResult['checks'][string] {
    const circuitBreakerHealth = this.circuitBreakerRegistry.getHealthStatus();
    
    if (circuitBreakerHealth.healthy) {
      return {
        status: 'pass',
        message: 'All circuit breakers healthy',
        details: circuitBreakerHealth.details
      };
    } else {
      return {
        status: 'warn',
        message: `${circuitBreakerHealth.details.unhealthyBreakers.length} circuit breakers open`,
        details: circuitBreakerHealth.details
      };
    }
  }

  private async checkReadiness(): Promise<boolean> {
    // Check if all critical services are available
    const dbCheck = await this.checkDatabase();
    const cacheCheck = await this.checkCache();
    
    return dbCheck.status === 'pass' && cacheCheck.status === 'pass';
  }

  private async getSystemStatus(): Promise<SystemStatus> {
    const systemHealth = this.degradationManager.getSystemHealth();
    const circuitBreakerMetrics = this.circuitBreakerRegistry.getAllMetrics();
    const errorStats = this.errorTracker.getErrorStats();
    const traceStats = this.tracer.getTraceStats();
    const performanceMetrics = this.metricsCollector.getMetrics();

    return {
      overall: systemHealth.overall,
      services: systemHealth.services,
      circuitBreakers: circuitBreakerMetrics,
      errors: errorStats,
      traces: traceStats,
      performance: performanceMetrics
    };
  }

  private getActiveConnections(): number {
    // In a real implementation, this would return actual connection count
    return Math.floor(Math.random() * 100);
  }

  private getRequestsPerSecond(): number {
    // Calculate from metrics
    const metrics = this.metricsCollector.getMetrics();
    const totalRequests = metrics.counters['http_requests_total'] || 0;
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    
    return uptimeSeconds > 0 ? totalRequests / uptimeSeconds : 0;
  }

  private getErrorRate(): number {
    const metrics = this.metricsCollector.getMetrics();
    const totalRequests = metrics.counters['http_requests_total'] || 0;
    const totalErrors = metrics.counters['http_errors_total'] || 0;
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  private async simulateAsyncCheck(service: string, delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate occasional failures
    if (Math.random() < 0.05) {
      throw new Error(`${service} check failed`);
    }
  }
}

// Request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const logger = new Logger('RequestLogger');
  const startTime = Date.now();
  
  // Log incoming request
  logger.info(`Incoming request: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    traceId: (req as any).traceContext?.traceId
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info(`Request completed: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length'),
      userId: (req as any).user?.id,
      traceId: (req as any).traceContext?.traceId
    });
  });

  next();
};

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const metricsCollector = MetricsCollector.getInstance();
  const timer = metricsCollector.startTimer('http_request_duration');
  
  res.on('finish', () => {
    const duration = timer.end();
    
    // Record detailed performance metrics
    metricsCollector.recordResponseTime(
      req.path,
      req.method,
      res.statusCode,
      duration
    );
    
    // Record slow requests
    if (duration > 5000) { // > 5 seconds
      const logger = new Logger('PerformanceMonitor');
      logger.warn(`Slow request detected: ${req.method} ${req.path}`, {
        duration,
        statusCode: res.statusCode,
        path: req.path,
        method: req.method
      });
    }
  });

  next();
};