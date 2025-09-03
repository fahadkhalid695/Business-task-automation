import { CircuitBreaker, CircuitBreakerState, CircuitBreakerRegistry } from '../shared/utils/circuitBreaker';
import { MetricsCollector } from '../shared/utils/metrics';
import { GracefulDegradationManager } from '../shared/utils/gracefulDegradation';
import { DistributedTracer } from '../shared/utils/tracing';
import { RetryManager, DatabaseRetryStrategy, ExternalAPIRetryStrategy } from '../shared/utils/retryStrategies';
import { ErrorTracker } from '../shared/utils/logger';

describe('Error Handling and Monitoring System', () => {
  
  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test-service', {
        failureThreshold: 0.5,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000
      });
    });

    it('should start in CLOSED state', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should trip to OPEN state after failure threshold', async () => {
      const failingOperation = () => Promise.reject(new Error('Service failure'));

      // Execute failing operations to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      expect(metrics.failureRate).toBeGreaterThanOrEqual(0.5);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      const failingOperation = () => Promise.reject(new Error('Service failure'));

      // Trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next operation should transition to HALF_OPEN
      const successfulOperation = () => Promise.resolve('success');
      const result = await circuitBreaker.execute(successfulOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should not trip for expected errors', async () => {
      const circuitBreakerWithExpectedErrors = new CircuitBreaker('test-service-2', {
        failureThreshold: 0.5,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000,
        expectedErrors: ['ValidationError']
      });

      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      const failingOperation = () => Promise.reject(validationError);

      // Execute multiple validation errors
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerWithExpectedErrors.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const metrics = circuitBreakerWithExpectedErrors.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('MetricsCollector', () => {
    let metricsCollector: MetricsCollector;

    beforeEach(() => {
      metricsCollector = MetricsCollector.getInstance();
    });

    it('should increment counters correctly', () => {
      metricsCollector.incrementCounter('test_counter', 5);
      metricsCollector.incrementCounter('test_counter', 3);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.counters['test_counter']).toBe(8);
    });

    it('should set gauge values correctly', () => {
      metricsCollector.setGauge('test_gauge', 42.5);
      metricsCollector.setGauge('test_gauge', 37.2);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.gauges['test_gauge']).toBe(37.2);
    });

    it('should record histogram values and calculate statistics', () => {
      const values = [10, 20, 30, 40, 50];
      values.forEach(value => {
        metricsCollector.recordHistogram('test_histogram', value);
      });

      const metrics = metricsCollector.getMetrics();
      const histogramStats = metrics.histograms['test_histogram'];

      expect(histogramStats.count).toBe(5);
      expect(histogramStats.min).toBe(10);
      expect(histogramStats.max).toBe(50);
      expect(histogramStats.mean).toBe(30);
    });

    it('should record response time metrics correctly', () => {
      metricsCollector.recordResponseTime('/api/users', 'GET', 200, 150);
      metricsCollector.recordResponseTime('/api/users', 'GET', 500, 300);

      const metrics = metricsCollector.getMetrics();
      
      expect(metrics.counters['http_requests_total{endpoint="/api/users",method="GET",status_code="200"}']).toBe(1);
      expect(metrics.counters['http_requests_total{endpoint="/api/users",method="GET",status_code="500"}']).toBe(1);
      expect(metrics.counters['http_errors_total{endpoint="/api/users",method="GET",status_code="500"}']).toBe(1);
    });

    it('should record task completion metrics', () => {
      metricsCollector.recordTaskCompletion('email_processing', true, 1500);
      metricsCollector.recordTaskCompletion('email_processing', false, 2000);

      const metrics = metricsCollector.getMetrics();
      
      expect(metrics.counters['tasks_completed_total{task_type="email_processing",success="true"}']).toBe(1);
      expect(metrics.counters['tasks_completed_total{task_type="email_processing",success="false"}']).toBe(1);
      expect(metrics.counters['tasks_successful_total{task_type="email_processing"}']).toBe(1);
      expect(metrics.counters['tasks_failed_total{task_type="email_processing"}']).toBe(1);
    });

    it('should measure operation duration with timer', () => {
      const timer = metricsCollector.startTimer('test_operation');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait for at least 10ms
      }
      
      const duration = timer.end();
      
      expect(duration).toBeGreaterThan(0);
      
      const metrics = metricsCollector.getMetrics();
      expect(metrics.histograms['test_operation_duration_ms']).toBeDefined();
    });
  });

  describe('GracefulDegradationManager', () => {
    let degradationManager: GracefulDegradationManager;

    beforeEach(() => {
      degradationManager = GracefulDegradationManager.getInstance();
    });

    it('should register service dependencies', () => {
      degradationManager.registerDependency({
        name: 'test-service',
        critical: true,
        fallbackBehavior: 'degrade'
      });

      const health = degradationManager.getSystemHealth();
      expect(health.services['test-service']).toBeDefined();
    });

    it('should execute operations with fallback on failure', async () => {
      const failingOperation = () => Promise.reject(new Error('Operation failed'));
      const fallbackValue = 'fallback-result';

      const result = await degradationManager.executeWithFallback(
        'test-operation',
        failingOperation,
        {
          maxRetries: 2,
          fallbackValue
        }
      );

      expect(result).toBe(fallbackValue);
    });

    it('should execute fallback function when operation fails', async () => {
      const failingOperation = () => Promise.reject(new Error('Operation failed'));
      const fallbackFunction = async () => 'fallback-function-result';

      const result = await degradationManager.executeWithFallback(
        'test-operation',
        failingOperation,
        {
          maxRetries: 1,
          fallbackFunction
        }
      );

      expect(result).toBe('fallback-function-result');
    });

    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const eventuallySuccessfulOperation = () => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve('success');
      };

      const result = await degradationManager.executeWithFallback(
        'test-operation',
        eventuallySuccessfulOperation,
        {
          maxRetries: 3,
          retryDelay: 100
        }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('DistributedTracer', () => {
    let tracer: DistributedTracer;

    beforeEach(() => {
      tracer = DistributedTracer.getInstance();
    });

    it('should create spans with correct hierarchy', () => {
      const parentSpan = tracer.startSpan('parent-operation');
      const parentContext = parentSpan.getContext();
      
      const childSpan = tracer.startSpan('child-operation', parentContext);
      const childContext = childSpan.getContext();

      expect(childContext.traceId).toBe(parentContext.traceId);
      expect(childContext.parentSpanId).toBe(parentContext.spanId);
      expect(childContext.spanId).not.toBe(parentContext.spanId);

      parentSpan.finish();
      childSpan.finish();
    });

    it('should record span tags and logs', () => {
      const span = tracer.startSpan('test-operation');
      
      span.setTag('user.id', '12345');
      span.setTag('operation.type', 'database');
      span.log({ message: 'Operation started', level: 'info' });

      const spanData = span.finish();

      expect(spanData.tags['user.id']).toBe('12345');
      expect(spanData.tags['operation.type']).toBe('database');
      expect(spanData.logs).toHaveLength(1);
      expect(spanData.logs[0].fields.message).toBe('Operation started');
    });

    it('should handle span errors correctly', () => {
      const span = tracer.startSpan('failing-operation');
      const error = new Error('Operation failed');
      
      span.logError(error);
      const spanData = span.finish();

      expect(spanData.status).toBe('error');
      expect(spanData.tags.error).toBe(true);
      expect(spanData.tags['error.message']).toBe('Operation failed');
    });

    it('should extract and inject trace context', () => {
      const span = tracer.startSpan('test-operation');
      const context = span.getContext();
      
      const headers = tracer.injectContext(context);
      const extractedContext = tracer.extractContext(headers);

      expect(extractedContext?.traceId).toBe(context.traceId);
      expect(extractedContext?.spanId).toBe(context.spanId);

      span.finish();
    });

    it('should provide trace statistics', () => {
      const span1 = tracer.startSpan('operation-1');
      const span2 = tracer.startSpan('operation-2');
      
      span1.finish();
      span2.finish();

      const stats = tracer.getTraceStats();
      expect(stats.completedTraces).toBeGreaterThanOrEqual(2);
    });
  });

  describe('RetryManager', () => {
    let retryManager: RetryManager;

    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        baseDelay: 100,
        backoffMultiplier: 2
      });
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      const eventuallySuccessfulOperation = () => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve('success');
      };

      const result = await retryManager.executeWithRetry(eventuallySuccessfulOperation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      const failingOperation = () => Promise.reject(validationError);

      const result = await retryManager.executeWithRetry(failingOperation, {
        nonRetryableErrors: ['ValidationError']
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should apply exponential backoff', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const failingOperation = () => {
        attempts++;
        timestamps.push(Date.now());
        return Promise.reject(new Error('Always fails'));
      };

      await retryManager.executeWithRetry(failingOperation);

      expect(attempts).toBe(3);
      expect(timestamps).toHaveLength(3);
      
      // Check that delays are increasing (with some tolerance for timing)
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThan(delay1 * 1.5); // Should be roughly 2x with some tolerance
    });
  });

  describe('Specialized Retry Strategies', () => {
    it('should handle database-specific errors', async () => {
      const dbRetryStrategy = new DatabaseRetryStrategy();
      
      const mongoError = new Error('Connection failed');
      mongoError.name = 'MongoNetworkError';
      
      let attempts = 0;
      const dbOperation = () => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(mongoError);
        }
        return Promise.resolve('connected');
      };

      const result = await dbRetryStrategy.executeWithRetry(dbOperation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should handle API-specific errors', async () => {
      const apiRetryStrategy = new ExternalAPIRetryStrategy();
      
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      
      let attempts = 0;
      const apiOperation = () => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(rateLimitError);
        }
        return Promise.resolve('api-response');
      };

      const result = await apiRetryStrategy.executeWithRetry(apiOperation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  describe('ErrorTracker', () => {
    let errorTracker: ErrorTracker;

    beforeEach(() => {
      errorTracker = ErrorTracker.getInstance();
    });

    it('should track error occurrences', () => {
      const error1 = new Error('Database connection failed');
      const error2 = new Error('Validation failed');
      const error3 = new Error('Database connection failed'); // Same as error1

      errorTracker.trackError(error1, 'database');
      errorTracker.trackError(error2, 'validation');
      errorTracker.trackError(error3, 'database');

      const stats = errorTracker.getErrorStats();
      
      expect(stats.totalUniqueErrors).toBe(2);
      expect(stats.totalErrorOccurrences).toBe(3);
    });

    it('should provide error statistics by context', () => {
      const error = new Error('Test error');
      
      errorTracker.trackError(error, 'context1');
      errorTracker.trackError(error, 'context1');
      errorTracker.trackError(error, 'context2');

      const stats = errorTracker.getErrorStats();
      
      expect(stats.errorsByContext['context1']).toBe(2);
      expect(stats.errorsByContext['context2']).toBe(1);
    });

    it('should identify top errors', () => {
      const frequentError = new Error('Frequent error');
      const rareError = new Error('Rare error');

      // Track frequent error multiple times
      for (let i = 0; i < 5; i++) {
        errorTracker.trackError(frequentError, 'test');
      }
      
      // Track rare error once
      errorTracker.trackError(rareError, 'test');

      const stats = errorTracker.getErrorStats();
      
      expect(stats.topErrors[0].error).toContain('Frequent error');
      expect(stats.topErrors[0].count).toBe(5);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error flow with monitoring', async () => {
      const metricsCollector = MetricsCollector.getInstance();
      const circuitBreaker = new CircuitBreaker('integration-test', {
        failureThreshold: 0.5,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000
      });

      let attempts = 0;
      const unreliableOperation = () => {
        attempts++;
        metricsCollector.incrementCounter('operation_attempts', 1);
        
        if (attempts <= 2) {
          const error = new Error('Service temporarily unavailable');
          metricsCollector.incrementCounter('operation_failures', 1);
          return Promise.reject(error);
        }
        
        metricsCollector.incrementCounter('operation_successes', 1);
        return Promise.resolve('operation completed');
      };

      // First two attempts should fail
      try {
        await circuitBreaker.execute(unreliableOperation);
      } catch (error) {
        // Expected failure
      }

      try {
        await circuitBreaker.execute(unreliableOperation);
      } catch (error) {
        // Expected failure
      }

      // Circuit breaker should be open now
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Third attempt should succeed and reset circuit breaker
      const result = await circuitBreaker.execute(unreliableOperation);
      
      expect(result).toBe('operation completed');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);

      // Verify metrics were recorded
      const metrics = metricsCollector.getMetrics();
      expect(metrics.counters['operation_attempts']).toBe(3);
      expect(metrics.counters['operation_failures']).toBe(2);
      expect(metrics.counters['operation_successes']).toBe(1);
    });
  });
});