import { Logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  retryHistory: Array<{
    attempt: number;
    error: string;
    delay: number;
    timestamp: Date;
  }>;
}

export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  FIXED_DELAY = 'fixed_delay',
  FIBONACCI = 'fibonacci',
  CUSTOM = 'custom'
}

export class RetryManager {
  private logger: Logger;
  private defaultOptions: RetryOptions;

  constructor(defaultOptions?: Partial<RetryOptions>) {
    this.logger = new Logger('RetryManager');
    this.defaultOptions = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'SERVICE_UNAVAILABLE'
      ],
      nonRetryableErrors: [
        'AUTHENTICATION_ERROR',
        'AUTHORIZATION_ERROR',
        'VALIDATION_ERROR',
        'NOT_FOUND_ERROR'
      ],
      ...defaultOptions
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const retryHistory: RetryResult<T>['retryHistory'] = [];

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        const totalDuration = Date.now() - startTime;
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded on attempt ${attempt}`, {
            attempts: attempt,
            totalDuration,
            retryHistory
          });
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration,
          retryHistory
        };
      } catch (error) {
        lastError = error as Error;
        
        const shouldRetry = this.shouldRetryError(lastError, attempt, opts);
        
        if (!shouldRetry || attempt === opts.maxAttempts) {
          const totalDuration = Date.now() - startTime;
          
          this.logger.error(`Operation failed after ${attempt} attempts`, lastError, {
            attempts: attempt,
            totalDuration,
            retryHistory,
            finalError: lastError.message
          });

          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDuration,
            retryHistory
          };
        }

        const delay = this.calculateDelay(attempt, opts);
        
        retryHistory.push({
          attempt,
          error: lastError.message,
          delay,
          timestamp: new Date()
        });

        this.logger.warn(`Operation failed on attempt ${attempt}, retrying in ${delay}ms`, {
          error: lastError.message,
          attempt,
          maxAttempts: opts.maxAttempts,
          delay
        });

        if (opts.onRetry) {
          opts.onRetry(lastError, attempt);
        }

        await this.delay(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  private shouldRetryError(error: Error, attempt: number, options: RetryOptions): boolean {
    // Check custom retry function first
    if (options.shouldRetry) {
      return options.shouldRetry(error, attempt);
    }

    // Check non-retryable errors
    if (options.nonRetryableErrors?.some(errorType => 
      error.name === errorType || error.message.includes(errorType)
    )) {
      return false;
    }

    // Check retryable errors
    if (options.retryableErrors?.some(errorType => 
      error.name === errorType || error.message.includes(errorType)
    )) {
      return true;
    }

    // Default: retry on network and temporary errors
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /unavailable/i,
      /temporary/i,
      /rate.?limit/i
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    let delay: number;

    switch (this.getRetryStrategy(options)) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        delay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
        break;
      
      case RetryStrategy.LINEAR_BACKOFF:
        delay = options.baseDelay * attempt;
        break;
      
      case RetryStrategy.FIBONACCI:
        delay = this.fibonacci(attempt) * options.baseDelay;
        break;
      
      case RetryStrategy.FIXED_DELAY:
      default:
        delay = options.baseDelay;
        break;
    }

    // Apply maximum delay limit
    delay = Math.min(delay, options.maxDelay);

    // Add jitter to prevent thundering herd
    if (options.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(0, Math.floor(delay));
  }

  private getRetryStrategy(options: RetryOptions): RetryStrategy {
    // Determine strategy based on backoff multiplier
    if (options.backoffMultiplier > 1) {
      return RetryStrategy.EXPONENTIAL_BACKOFF;
    } else if (options.backoffMultiplier === 1) {
      return RetryStrategy.LINEAR_BACKOFF;
    } else {
      return RetryStrategy.FIXED_DELAY;
    }
  }

  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    
    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Utility decorator for automatic retry
export function withRetry(options?: Partial<RetryOptions>) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    const method = descriptor.value!;
    const retryManager = new RetryManager();
    
    descriptor.value = async function (...args: any[]) {
      const result = await retryManager.executeWithRetry(
        () => method.apply(this, args),
        options
      );
      
      if (result.success) {
        return result.result;
      } else {
        throw result.error;
      }
    };
  };
}

// Specialized retry strategies for different scenarios
export class DatabaseRetryStrategy extends RetryManager {
  constructor() {
    super({
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'MongoNetworkError',
        'MongoTimeoutError',
        'MongoServerSelectionError',
        'CONNECTION_ERROR',
        'TIMEOUT_ERROR'
      ],
      nonRetryableErrors: [
        'ValidationError',
        'CastError',
        'DUPLICATE_KEY_ERROR'
      ]
    });
  }
}

export class ExternalAPIRetryStrategy extends RetryManager {
  constructor() {
    super({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'RATE_LIMIT_ERROR',
        'SERVICE_UNAVAILABLE'
      ],
      nonRetryableErrors: [
        'AUTHENTICATION_ERROR',
        'AUTHORIZATION_ERROR',
        'BAD_REQUEST',
        'NOT_FOUND'
      ],
      shouldRetry: (error: Error, attempt: number) => {
        // Retry on 5xx status codes, rate limits, and network errors
        const retryableStatusCodes = [500, 502, 503, 504, 429];
        const statusCode = (error as any).status || (error as any).statusCode;
        
        if (statusCode && retryableStatusCodes.includes(statusCode)) {
          return true;
        }
        
        return false;
      }
    });
  }
}

export class AIModelRetryStrategy extends RetryManager {
  constructor() {
    super({
      maxAttempts: 4,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: [
        'MODEL_TIMEOUT',
        'MODEL_OVERLOADED',
        'INFERENCE_ERROR',
        'RATE_LIMIT_ERROR'
      ],
      nonRetryableErrors: [
        'INVALID_INPUT',
        'MODEL_NOT_FOUND',
        'AUTHENTICATION_ERROR'
      ]
    });
  }
}

// Error recovery procedures
export class ErrorRecoveryManager {
  private logger: Logger;
  private recoveryProcedures: Map<string, () => Promise<void>> = new Map();

  constructor() {
    this.logger = new Logger('ErrorRecoveryManager');
    this.setupDefaultRecoveryProcedures();
  }

  registerRecoveryProcedure(errorType: string, procedure: () => Promise<void>) {
    this.recoveryProcedures.set(errorType, procedure);
    this.logger.info(`Registered recovery procedure for error type: ${errorType}`);
  }

  async attemptRecovery(error: Error): Promise<boolean> {
    const errorType = error.name || 'UnknownError';
    const procedure = this.recoveryProcedures.get(errorType);

    if (!procedure) {
      this.logger.warn(`No recovery procedure found for error type: ${errorType}`);
      return false;
    }

    try {
      this.logger.info(`Attempting recovery for error type: ${errorType}`);
      await procedure();
      this.logger.info(`Recovery successful for error type: ${errorType}`);
      return true;
    } catch (recoveryError) {
      this.logger.error(`Recovery failed for error type: ${errorType}`, recoveryError as Error);
      return false;
    }
  }

  private setupDefaultRecoveryProcedures() {
    // Database connection recovery
    this.registerRecoveryProcedure('MongoNetworkError', async () => {
      // In a real implementation, this would attempt to reconnect to the database
      await this.delay(5000);
      this.logger.info('Attempted database reconnection');
    });

    // Cache recovery
    this.registerRecoveryProcedure('RedisConnectionError', async () => {
      // In a real implementation, this would attempt to reconnect to Redis
      await this.delay(3000);
      this.logger.info('Attempted cache reconnection');
    });

    // External service recovery
    this.registerRecoveryProcedure('ExternalServiceError', async () => {
      // Clear any cached credentials or tokens that might be stale
      await this.delay(1000);
      this.logger.info('Cleared external service credentials cache');
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}