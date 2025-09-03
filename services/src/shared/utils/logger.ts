import winston from 'winston';
import { performance } from 'perf_hooks';

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  service?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

export interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  context: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  service: string;
  environment: string;
  version: string;
  stack?: string;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    memory: NodeJS.MemoryUsage;
    cpu?: number;
  };
  metadata?: Record<string, any>;
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const structuredLog: StructuredLog = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      context: info.context || 'unknown',
      service: process.env.SERVICE_NAME || 'business-automation',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.SERVICE_VERSION || '1.0.0',
      requestId: info.requestId,
      traceId: info.traceId,
      userId: info.userId,
      stack: info.stack,
      error: info.error ? {
        name: info.error.name || 'Error',
        message: info.error.message || info.error,
        code: info.error.code,
        stack: info.error.stack
      } : undefined,
      performance: info.performance,
      metadata: info.metadata
    };

    return JSON.stringify(structuredLog);
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: process.env.SERVICE_NAME || 'business-automation',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '1.0.0'
  },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export class Logger {
  private context: string;
  private defaultMeta: LogContext;

  constructor(context: string, defaultMeta: LogContext = {}) {
    this.context = context;
    this.defaultMeta = defaultMeta;
  }

  private enrichMeta(meta: LogContext = {}): LogContext {
    return {
      ...this.defaultMeta,
      ...meta,
      context: this.context,
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage()
    };
  }

  info(message: string, meta: LogContext = {}) {
    logger.info(message, this.enrichMeta(meta));
  }

  error(message: string, error?: Error | string, meta: LogContext = {}) {
    const errorInfo = typeof error === 'string' ? { message: error } : error;
    logger.error(message, this.enrichMeta({
      ...meta,
      error: errorInfo
    }));
  }

  warn(message: string, meta: LogContext = {}) {
    logger.warn(message, this.enrichMeta(meta));
  }

  debug(message: string, meta: LogContext = {}) {
    logger.debug(message, this.enrichMeta(meta));
  }

  performance(operation: string, startTime: number, meta: LogContext = {}) {
    const duration = performance.now() - startTime;
    this.info(`Performance: ${operation}`, {
      ...meta,
      performance: {
        duration,
        memory: process.memoryUsage()
      },
      operation
    });
  }

  audit(action: string, resource: string, meta: LogContext = {}) {
    this.info(`Audit: ${action} on ${resource}`, {
      ...meta,
      audit: {
        action,
        resource,
        timestamp: new Date().toISOString()
      }
    });
  }

  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta: LogContext = {}) {
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    logger[logLevel](`Security: ${event}`, this.enrichMeta({
      ...meta,
      security: {
        event,
        severity,
        timestamp: new Date().toISOString()
      }
    }));
  }

  business(metric: string, value: number | string, meta: LogContext = {}) {
    this.info(`Business Metric: ${metric}`, {
      ...meta,
      businessMetric: {
        metric,
        value,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private logger: Logger;
  private errorCounts: Map<string, number> = new Map();
  private errorHistory: Array<{ error: string; timestamp: Date; context: string }> = [];

  private constructor() {
    this.logger = new Logger('ErrorTracker');
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  trackError(error: Error, context: string, meta: LogContext = {}) {
    const errorKey = `${error.name}:${error.message}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    this.errorHistory.push({
      error: errorKey,
      timestamp: new Date(),
      context
    });

    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }

    this.logger.error(`Tracked error: ${error.message}`, error, {
      ...meta,
      errorCount: currentCount + 1,
      context
    });

    // Alert on high frequency errors
    if (currentCount + 1 >= 10) {
      this.logger.security(`High frequency error detected: ${errorKey}`, 'high', {
        errorCount: currentCount + 1,
        context
      });
    }
  }

  getErrorStats(): Record<string, any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= oneHourAgo);
    const errorsByContext = recentErrors.reduce((acc, error) => {
      acc[error.context] = (acc[error.context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUniqueErrors: this.errorCounts.size,
      totalErrorOccurrences: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      recentErrorsLastHour: recentErrors.length,
      errorsByContext,
      topErrors: Array.from(this.errorCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([error, count]) => ({ error, count }))
    };
  }
}