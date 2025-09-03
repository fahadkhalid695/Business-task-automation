import { Request, Response, NextFunction } from 'express';
import { Logger, ErrorTracker } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { ErrorRecoveryManager } from '../utils/retryStrategies';
import { randomBytes } from 'crypto';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  context?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recoverable?: boolean;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    timestamp: string;
    path: string;
    method: string;
    stack?: string;
    context?: Record<string, any>;
  };
  recovery?: {
    suggestions: string[];
    retryAfter?: number;
    supportContact?: string;
  };
}

export class EnhancedErrorHandler {
  private logger: Logger;
  private errorTracker: ErrorTracker;
  private metricsCollector: MetricsCollector;
  private recoveryManager: ErrorRecoveryManager;

  constructor() {
    this.logger = new Logger('ErrorHandler');
    this.errorTracker = ErrorTracker.getInstance();
    this.metricsCollector = MetricsCollector.getInstance();
    this.recoveryManager = new ErrorRecoveryManager();
  }

  handleError = (
    error: AppError,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Enrich error with context
    const enrichedError = this.enrichError(error, req, requestId);

    // Track error for analytics
    this.errorTracker.trackError(enrichedError, 'http-request', {
      requestId,
      userId: (req as any).user?.id,
      traceId: (req as any).traceContext?.traceId
    });

    // Record metrics
    this.recordErrorMetrics(enrichedError, req);

    // Log error with full context
    this.logError(enrichedError, req, requestId);

    // Attempt recovery if applicable
    this.attemptErrorRecovery(enrichedError);

    // Send response
    const response = this.createErrorResponse(enrichedError, req, requestId);
    res.status(enrichedError.statusCode || 500).json(response);

    // Record response time
    const duration = Date.now() - startTime;
    this.metricsCollector.recordResponseTime(
      req.path,
      req.method,
      enrichedError.statusCode || 500,
      duration
    );
  };

  private enrichError(error: AppError, req: Request, requestId: string): AppError {
    const enriched = error as AppError;

    // Set default values
    enriched.statusCode = enriched.statusCode || this.determineStatusCode(error);
    enriched.code = enriched.code || this.determineErrorCode(error);
    enriched.severity = enriched.severity || this.determineSeverity(error);
    enriched.isOperational = enriched.isOperational ?? this.isOperationalError(error);
    enriched.recoverable = enriched.recoverable ?? this.isRecoverableError(error);

    // Add request context
    enriched.context = {
      ...enriched.context,
      requestId,
      method: req.method,
      path: req.path,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionId,
      traceId: (req as any).traceContext?.traceId,
      timestamp: new Date().toISOString()
    };

    return enriched;
  }

  private determineStatusCode(error: Error): number {
    const errorMappings: Record<string, number> = {
      'ValidationError': 400,
      'CastError': 400,
      'SyntaxError': 400,
      'UnauthorizedError': 401,
      'AuthenticationError': 401,
      'JsonWebTokenError': 401,
      'TokenExpiredError': 401,
      'AuthorizationError': 403,
      'ForbiddenError': 403,
      'NotFoundError': 404,
      'ConflictError': 409,
      'RateLimitError': 429,
      'ExternalServiceError': 502,
      'ServiceUnavailableError': 503,
      'TimeoutError': 504
    };

    // Check by error name
    if (errorMappings[error.name]) {
      return errorMappings[error.name];
    }

    // Check by error message patterns
    if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
      return 409;
    }

    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return 504;
    }

    if (error.message.includes('not found')) {
      return 404;
    }

    return 500;
  }

  private determineErrorCode(error: Error): string {
    const codeMappings: Record<string, string> = {
      'ValidationError': 'VALIDATION_ERROR',
      'CastError': 'INVALID_ID_FORMAT',
      'UnauthorizedError': 'UNAUTHORIZED',
      'AuthenticationError': 'AUTHENTICATION_FAILED',
      'AuthorizationError': 'ACCESS_DENIED',
      'NotFoundError': 'RESOURCE_NOT_FOUND',
      'ConflictError': 'RESOURCE_CONFLICT',
      'RateLimitError': 'RATE_LIMIT_EXCEEDED',
      'ExternalServiceError': 'EXTERNAL_SERVICE_ERROR',
      'TimeoutError': 'REQUEST_TIMEOUT'
    };

    return codeMappings[error.name] || 'INTERNAL_SERVER_ERROR';
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const statusCode = this.determineStatusCode(error);

    if (statusCode >= 500) {
      return 'critical';
    } else if (statusCode >= 400) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private isOperationalError(error: Error): boolean {
    const operationalErrors = [
      'ValidationError',
      'CastError',
      'UnauthorizedError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFoundError',
      'ConflictError',
      'RateLimitError'
    ];

    return operationalErrors.includes(error.name);
  }

  private isRecoverableError(error: Error): boolean {
    const recoverableErrors = [
      'TimeoutError',
      'ExternalServiceError',
      'RateLimitError',
      'ServiceUnavailableError',
      'MongoNetworkError',
      'RedisConnectionError'
    ];

    return recoverableErrors.includes(error.name) ||
           error.message.includes('timeout') ||
           error.message.includes('network') ||
           error.message.includes('connection');
  }

  private recordErrorMetrics(error: AppError, req: Request): void {
    // Record error by type
    this.metricsCollector.incrementCounter('errors_total', 1, {
      error_type: error.name,
      error_code: error.code || 'unknown',
      status_code: (error.statusCode || 500).toString(),
      method: req.method,
      path: req.path,
      severity: error.severity || 'unknown'
    });

    // Record error by endpoint
    this.metricsCollector.incrementCounter('endpoint_errors_total', 1, {
      endpoint: req.path,
      method: req.method,
      status_code: (error.statusCode || 500).toString()
    });

    // Record security-related errors
    if (error.statusCode === 401 || error.statusCode === 403) {
      this.metricsCollector.incrementCounter('security_errors_total', 1, {
        error_type: error.name,
        ip: req.ip,
        user_agent: req.get('User-Agent') || 'unknown'
      });
    }
  }

  private logError(error: AppError, req: Request, requestId: string): void {
    const logLevel = error.severity === 'critical' || error.severity === 'high' ? 'error' : 'warn';
    
    this.logger[logLevel](`Request error: ${error.message}`, error, {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: error.statusCode,
      errorCode: error.code,
      severity: error.severity,
      recoverable: error.recoverable,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      traceId: (req as any).traceContext?.traceId,
      context: error.context
    });

    // Log security events separately
    if (error.statusCode === 401 || error.statusCode === 403) {
      this.logger.security(`Authentication/Authorization failure: ${error.message}`, 
        error.severity || 'medium', {
          requestId,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
    }
  }

  private async attemptErrorRecovery(error: AppError): Promise<void> {
    if (!error.recoverable) {
      return;
    }

    try {
      const recovered = await this.recoveryManager.attemptRecovery(error);
      if (recovered) {
        this.logger.info(`Successfully recovered from error: ${error.name}`, {
          errorCode: error.code,
          context: error.context
        });
        
        this.metricsCollector.incrementCounter('error_recoveries_successful', 1, {
          error_type: error.name
        });
      }
    } catch (recoveryError) {
      this.logger.error('Error recovery failed', recoveryError as Error, {
        originalError: error.name,
        originalMessage: error.message
      });
      
      this.metricsCollector.incrementCounter('error_recoveries_failed', 1, {
        error_type: error.name
      });
    }
  }

  private createErrorResponse(error: AppError, req: Request, requestId: string): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: this.sanitizeErrorMessage(error, req),
        requestId,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = error.stack;
      response.error.context = error.context;
    }

    // Add recovery suggestions for recoverable errors
    if (error.recoverable) {
      response.recovery = {
        suggestions: this.getRecoverySuggestions(error),
        retryAfter: this.getRetryAfter(error),
        supportContact: process.env.SUPPORT_EMAIL || 'support@company.com'
      };
    }

    return response;
  }

  private sanitizeErrorMessage(error: AppError, req: Request): string {
    // Don't leak sensitive information in production
    if (process.env.NODE_ENV === 'production' && error.statusCode === 500) {
      return 'An internal server error occurred. Please try again later.';
    }

    // Sanitize database errors
    if (error.message.includes('E11000') || error.message.includes('duplicate key')) {
      return 'A resource with this information already exists.';
    }

    return error.message;
  }

  private getRecoverySuggestions(error: AppError): string[] {
    const suggestions: string[] = [];

    switch (error.name) {
      case 'TimeoutError':
        suggestions.push('The request timed out. Please try again.');
        suggestions.push('Check your network connection.');
        break;
      
      case 'RateLimitError':
        suggestions.push('You have exceeded the rate limit. Please wait before trying again.');
        suggestions.push('Consider reducing the frequency of your requests.');
        break;
      
      case 'ExternalServiceError':
        suggestions.push('An external service is temporarily unavailable.');
        suggestions.push('Please try again in a few minutes.');
        break;
      
      case 'ValidationError':
        suggestions.push('Please check your input data and try again.');
        suggestions.push('Ensure all required fields are provided.');
        break;
      
      default:
        suggestions.push('Please try again later.');
        suggestions.push('If the problem persists, contact support.');
    }

    return suggestions;
  }

  private getRetryAfter(error: AppError): number | undefined {
    switch (error.name) {
      case 'RateLimitError':
        return 60; // 1 minute
      case 'ExternalServiceError':
        return 300; // 5 minutes
      case 'TimeoutError':
        return 30; // 30 seconds
      default:
        return undefined;
    }
  }

  private generateRequestId(): string {
    return randomBytes(16).toString('hex');
  }
}

// Create singleton instance
const enhancedErrorHandler = new EnhancedErrorHandler();

// Export middleware function
export const errorHandler = enhancedErrorHandler.handleError;

// Utility functions
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const createError = (
  message: string, 
  statusCode: number = 500, 
  code?: string,
  context?: Record<string, any>
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  error.code = code;
  error.context = context;
  return error;
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = createError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'ROUTE_NOT_FOUND',
    {
      method: req.method,
      path: req.path,
      availableRoutes: [] // Could be populated with actual available routes
    }
  );
  next(error);
};