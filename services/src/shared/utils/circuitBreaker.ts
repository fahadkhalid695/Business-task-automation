import { Logger } from './logger';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  failureRate: number;
  state: CircuitBreakerState;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private logger: Logger;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {
    this.logger = new Logger(`CircuitBreaker:${name}`);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN. Next attempt at ${this.nextAttemptTime}`);
      }
    }

    try {
      this.totalRequests++;
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.reset();
      this.logger.info(`Circuit breaker ${this.name} reset to CLOSED after successful request`);
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    // Check if this is an expected error that shouldn't trigger circuit breaker
    if (this.options.expectedErrors?.includes(error.name)) {
      return;
    }

    const failureRate = this.failureCount / this.totalRequests;
    
    if (failureRate >= this.options.failureThreshold && this.state === CircuitBreakerState.CLOSED) {
      this.trip();
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.options.recoveryTimeout);
    
    this.logger.warn(`Circuit breaker ${this.name} tripped to OPEN state`, {
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
      failureRate: this.failureCount / this.totalRequests,
      nextAttemptTime: this.nextAttemptTime
    });
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failureCount,
      successfulRequests: this.successCount,
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0,
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  getName(): string {
    return this.name;
  }
}

export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private logger = new Logger('CircuitBreakerRegistry');

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  register(name: string, options: CircuitBreakerOptions): CircuitBreaker {
    if (this.circuitBreakers.has(name)) {
      return this.circuitBreakers.get(name)!;
    }

    const circuitBreaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, circuitBreaker);
    
    this.logger.info(`Registered circuit breaker: ${name}`, options);
    return circuitBreaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    for (const [name, breaker] of this.circuitBreakers) {
      metrics[name] = breaker.getMetrics();
    }
    
    return metrics;
  }

  getHealthStatus(): { healthy: boolean; details: Record<string, any> } {
    const metrics = this.getAllMetrics();
    const unhealthyBreakers = Object.entries(metrics)
      .filter(([_, metric]) => metric.state === CircuitBreakerState.OPEN)
      .map(([name, metric]) => ({ name, ...metric }));

    return {
      healthy: unhealthyBreakers.length === 0,
      details: {
        totalBreakers: this.circuitBreakers.size,
        unhealthyBreakers,
        allMetrics: metrics
      }
    };
  }
}