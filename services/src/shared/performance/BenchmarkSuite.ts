import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { PerformanceProfiler } from './PerformanceProfiler';

const logger = new Logger('BenchmarkSuite');
const metrics = MetricsCollector.getInstance();

export interface BenchmarkConfig {
  name: string;
  description: string;
  iterations: number;
  warmupIterations: number;
  timeout: number; // milliseconds
  concurrent: boolean;
  concurrency?: number;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number; // operations per second
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
  cpuUsage: {
    before: NodeJS.CpuUsage;
    after: NodeJS.CpuUsage;
  };
  errors: number;
  success: boolean;
  timestamp: Date;
}

export interface LoadTestConfig {
  name: string;
  targetFunction: (...args: any[]) => Promise<any>;
  args: any[];
  duration: number; // milliseconds
  rampUpTime: number; // milliseconds
  maxConcurrency: number;
  targetRPS?: number; // requests per second
  thresholds: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number; // percentage
  };
}

export interface LoadTestResult {
  name: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  concurrencyLevels: number[];
  responseTimeDistribution: number[];
  thresholdsPassed: boolean;
  timestamp: Date;
}

export class BenchmarkSuite {
  private static instance: BenchmarkSuite;
  private profiler: PerformanceProfiler;
  private results: Map<string, BenchmarkResult[]> = new Map();
  private loadTestResults: Map<string, LoadTestResult[]> = new Map();

  private constructor() {
    this.profiler = PerformanceProfiler.getInstance();
  }

  static getInstance(): BenchmarkSuite {
    if (!BenchmarkSuite.instance) {
      BenchmarkSuite.instance = new BenchmarkSuite();
    }
    return BenchmarkSuite.instance;
  }

  async runBenchmark(
    name: string,
    testFunction: () => Promise<any> | any,
    config: Partial<BenchmarkConfig> = {}
  ): Promise<BenchmarkResult> {
    const fullConfig: BenchmarkConfig = {
      name,
      description: '',
      iterations: 1000,
      warmupIterations: 100,
      timeout: 30000,
      concurrent: false,
      concurrency: 10,
      ...config
    };

    logger.info(`Starting benchmark: ${name}`, { config: fullConfig });

    try {
      // Setup
      if (fullConfig.setup) {
        await fullConfig.setup();
      }

      // Warmup
      await this.performWarmup(testFunction, fullConfig.warmupIterations);

      // Collect initial metrics
      const memoryBefore = process.memoryUsage();
      const cpuBefore = process.cpuUsage();

      // Run benchmark
      const executionTimes: number[] = [];
      let errors = 0;
      let peakMemory = memoryBefore;

      const startTime = Date.now();

      if (fullConfig.concurrent && fullConfig.concurrency) {
        // Concurrent execution
        const batches = Math.ceil(fullConfig.iterations / fullConfig.concurrency);
        
        for (let batch = 0; batch < batches; batch++) {
          const batchSize = Math.min(
            fullConfig.concurrency,
            fullConfig.iterations - batch * fullConfig.concurrency
          );

          const promises = Array(batchSize).fill(null).map(async () => {
            const iterationStart = performance.now();
            try {
              await testFunction();
              return performance.now() - iterationStart;
            } catch (error) {
              errors++;
              return -1; // Mark as error
            }
          });

          const batchResults = await Promise.allSettled(promises);
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value > 0) {
              executionTimes.push(result.value);
            }
          }

          // Track peak memory usage
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } else {
        // Sequential execution
        for (let i = 0; i < fullConfig.iterations; i++) {
          const iterationStart = performance.now();
          
          try {
            await testFunction();
            const executionTime = performance.now() - iterationStart;
            executionTimes.push(executionTime);
          } catch (error) {
            errors++;
          }

          // Track peak memory usage
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }

          // Check timeout
          if (Date.now() - startTime > fullConfig.timeout) {
            logger.warn(`Benchmark timeout reached: ${name}`);
            break;
          }
        }
      }

      const totalTime = Date.now() - startTime;

      // Collect final metrics
      const memoryAfter = process.memoryUsage();
      const cpuAfter = process.cpuUsage(cpuBefore);

      // Calculate statistics
      const sortedTimes = executionTimes.sort((a, b) => a - b);
      const result: BenchmarkResult = {
        name,
        iterations: executionTimes.length,
        totalTime,
        averageTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
        minTime: Math.min(...executionTimes),
        maxTime: Math.max(...executionTimes),
        medianTime: this.calculatePercentile(sortedTimes, 50),
        p95Time: this.calculatePercentile(sortedTimes, 95),
        p99Time: this.calculatePercentile(sortedTimes, 99),
        throughput: (executionTimes.length / totalTime) * 1000, // ops/sec
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          peak: peakMemory
        },
        cpuUsage: {
          before: cpuBefore,
          after: cpuAfter
        },
        errors,
        success: errors === 0,
        timestamp: new Date()
      };

      // Store result
      const existingResults = this.results.get(name) || [];
      existingResults.push(result);
      this.results.set(name, existingResults);

      // Record metrics
      metrics.recordHistogram('benchmark_execution_time_ms', result.averageTime, {
        benchmark: name
      });
      metrics.setGauge('benchmark_throughput_ops_per_sec', result.throughput, {
        benchmark: name
      });
      metrics.setGauge('benchmark_error_rate', (errors / fullConfig.iterations) * 100, {
        benchmark: name
      });

      // Cleanup
      if (fullConfig.teardown) {
        await fullConfig.teardown();
      }

      logger.info(`Benchmark completed: ${name}`, {
        averageTime: result.averageTime,
        throughput: result.throughput,
        errors
      });

      return result;
    } catch (error) {
      logger.error(`Benchmark failed: ${name}`, error);
      throw error;
    }
  }

  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    logger.info(`Starting load test: ${config.name}`, { config });

    const startTime = Date.now();
    const endTime = startTime + config.duration;
    const responseTimes: number[] = [];
    const concurrencyLevels: number[] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let currentConcurrency = 1;

    // Ramp up phase
    const rampUpStep = config.rampUpTime / config.maxConcurrency;
    let lastRampUp = startTime;

    while (Date.now() < endTime) {
      const now = Date.now();

      // Increase concurrency during ramp-up
      if (now - lastRampUp > rampUpStep && currentConcurrency < config.maxConcurrency) {
        currentConcurrency++;
        lastRampUp = now;
      }

      concurrencyLevels.push(currentConcurrency);

      // Execute concurrent requests
      const promises = Array(currentConcurrency).fill(null).map(async () => {
        const requestStart = performance.now();
        totalRequests++;

        try {
          await config.targetFunction(...config.args);
          const responseTime = performance.now() - requestStart;
          responseTimes.push(responseTime);
          successfulRequests++;
          return responseTime;
        } catch (error) {
          failedRequests++;
          return -1;
        }
      });

      await Promise.allSettled(promises);

      // Rate limiting
      if (config.targetRPS) {
        const expectedInterval = 1000 / config.targetRPS;
        const actualInterval = Date.now() - now;
        if (actualInterval < expectedInterval) {
          await new Promise(resolve => 
            setTimeout(resolve, expectedInterval - actualInterval)
          );
        }
      }
    }

    const actualDuration = Date.now() - startTime;
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b);

    const result: LoadTestResult = {
      name: config.name,
      duration: actualDuration,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p50ResponseTime: this.calculatePercentile(sortedResponseTimes, 50),
      p95ResponseTime: this.calculatePercentile(sortedResponseTimes, 95),
      p99ResponseTime: this.calculatePercentile(sortedResponseTimes, 99),
      requestsPerSecond: (totalRequests / actualDuration) * 1000,
      errorRate: (failedRequests / totalRequests) * 100,
      concurrencyLevels,
      responseTimeDistribution: this.createDistribution(sortedResponseTimes),
      thresholdsPassed: this.checkThresholds(config, responseTimes, failedRequests, totalRequests),
      timestamp: new Date()
    };

    // Store result
    const existingResults = this.loadTestResults.get(config.name) || [];
    existingResults.push(result);
    this.loadTestResults.set(config.name, existingResults);

    // Record metrics
    metrics.recordHistogram('load_test_response_time_ms', result.averageResponseTime, {
      test: config.name
    });
    metrics.setGauge('load_test_rps', result.requestsPerSecond, {
      test: config.name
    });
    metrics.setGauge('load_test_error_rate', result.errorRate, {
      test: config.name
    });

    logger.info(`Load test completed: ${config.name}`, {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: result.averageResponseTime,
      requestsPerSecond: result.requestsPerSecond,
      thresholdsPassed: result.thresholdsPassed
    });

    return result;
  }

  private async performWarmup(testFunction: () => Promise<any> | any, iterations: number): Promise<void> {
    logger.debug(`Performing warmup: ${iterations} iterations`);
    
    for (let i = 0; i < iterations; i++) {
      try {
        await testFunction();
      } catch (error) {
        // Ignore warmup errors
      }
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private createDistribution(sortedTimes: number[]): number[] {
    const buckets = 10;
    const distribution = new Array(buckets).fill(0);
    
    if (sortedTimes.length === 0) return distribution;
    
    const min = sortedTimes[0];
    const max = sortedTimes[sortedTimes.length - 1];
    const bucketSize = (max - min) / buckets;

    for (const time of sortedTimes) {
      const bucketIndex = Math.min(
        Math.floor((time - min) / bucketSize),
        buckets - 1
      );
      distribution[bucketIndex]++;
    }

    return distribution;
  }

  private checkThresholds(
    config: LoadTestConfig,
    responseTimes: number[],
    failedRequests: number,
    totalRequests: number
  ): boolean {
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const p95Time = this.calculatePercentile(sortedTimes, 95);
    const errorRate = (failedRequests / totalRequests) * 100;

    return (
      averageTime <= config.thresholds.averageResponseTime &&
      p95Time <= config.thresholds.p95ResponseTime &&
      errorRate <= config.thresholds.errorRate
    );
  }

  // Stress testing
  async runStressTest(
    name: string,
    testFunction: () => Promise<any>,
    options: {
      startConcurrency: number;
      maxConcurrency: number;
      stepSize: number;
      stepDuration: number; // milliseconds
      breakOnFailure: boolean;
    }
  ): Promise<Array<{ concurrency: number; result: LoadTestResult }>> {
    logger.info(`Starting stress test: ${name}`, { options });

    const results: Array<{ concurrency: number; result: LoadTestResult }> = [];
    
    for (let concurrency = options.startConcurrency; 
         concurrency <= options.maxConcurrency; 
         concurrency += options.stepSize) {
      
      logger.info(`Testing concurrency level: ${concurrency}`);

      const loadTestConfig: LoadTestConfig = {
        name: `${name}_concurrency_${concurrency}`,
        targetFunction: testFunction,
        args: [],
        duration: options.stepDuration,
        rampUpTime: Math.min(1000, options.stepDuration / 4), // 25% ramp-up
        maxConcurrency: concurrency,
        thresholds: {
          averageResponseTime: 5000, // 5 seconds
          p95ResponseTime: 10000, // 10 seconds
          errorRate: 5 // 5%
        }
      };

      const result = await this.runLoadTest(loadTestConfig);
      results.push({ concurrency, result });

      // Break if thresholds are not met and breakOnFailure is true
      if (options.breakOnFailure && !result.thresholdsPassed) {
        logger.warn(`Stress test failed at concurrency ${concurrency}, stopping`);
        break;
      }

      // Brief pause between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`Stress test completed: ${name}`, {
      totalSteps: results.length,
      maxSuccessfulConcurrency: results
        .filter(r => r.result.thresholdsPassed)
        .map(r => r.concurrency)
        .pop() || 0
    });

    return results;
  }

  // Memory leak detection
  async detectMemoryLeaks(
    name: string,
    testFunction: () => Promise<any>,
    options: {
      iterations: number;
      samplingInterval: number;
      memoryThreshold: number; // bytes
    }
  ): Promise<{ hasLeak: boolean; memoryGrowth: number; samples: Array<{ iteration: number; memory: number }> }> {
    logger.info(`Starting memory leak detection: ${name}`, { options });

    const samples: Array<{ iteration: number; memory: number }> = [];
    let initialMemory = 0;

    for (let i = 0; i < options.iterations; i++) {
      await testFunction();

      if (i % options.samplingInterval === 0) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const memoryUsage = process.memoryUsage();
        const currentMemory = memoryUsage.heapUsed;

        if (i === 0) {
          initialMemory = currentMemory;
        }

        samples.push({
          iteration: i,
          memory: currentMemory
        });
      }
    }

    const finalMemory = samples[samples.length - 1]?.memory || 0;
    const memoryGrowth = finalMemory - initialMemory;
    const hasLeak = memoryGrowth > options.memoryThreshold;

    logger.info(`Memory leak detection completed: ${name}`, {
      hasLeak,
      memoryGrowth,
      initialMemory,
      finalMemory
    });

    return { hasLeak, memoryGrowth, samples };
  }

  // Comparison utilities
  compareBenchmarks(name: string, baseline?: BenchmarkResult): {
    current: BenchmarkResult;
    baseline?: BenchmarkResult;
    improvement: {
      averageTime: number; // percentage
      throughput: number; // percentage
      memoryUsage: number; // percentage
    };
  } | null {
    const results = this.results.get(name);
    if (!results || results.length === 0) return null;

    const current = results[results.length - 1];
    const baselineResult = baseline || (results.length > 1 ? results[results.length - 2] : undefined);

    if (!baselineResult) {
      return { current, improvement: { averageTime: 0, throughput: 0, memoryUsage: 0 } };
    }

    const improvement = {
      averageTime: ((baselineResult.averageTime - current.averageTime) / baselineResult.averageTime) * 100,
      throughput: ((current.throughput - baselineResult.throughput) / baselineResult.throughput) * 100,
      memoryUsage: ((baselineResult.memoryUsage.peak.heapUsed - current.memoryUsage.peak.heapUsed) / baselineResult.memoryUsage.peak.heapUsed) * 100
    };

    return { current, baseline: baselineResult, improvement };
  }

  // Results management
  getBenchmarkResults(name?: string): Map<string, BenchmarkResult[]> {
    if (name) {
      const results = this.results.get(name);
      return results ? new Map([[name, results]]) : new Map();
    }
    return new Map(this.results);
  }

  getLoadTestResults(name?: string): Map<string, LoadTestResult[]> {
    if (name) {
      const results = this.loadTestResults.get(name);
      return results ? new Map([[name, results]]) : new Map();
    }
    return new Map(this.loadTestResults);
  }

  clearResults(name?: string): void {
    if (name) {
      this.results.delete(name);
      this.loadTestResults.delete(name);
    } else {
      this.results.clear();
      this.loadTestResults.clear();
    }
    logger.info(`Cleared benchmark results${name ? ` for ${name}` : ''}`);
  }

  generateReport(): string {
    const report = ['# Performance Benchmark Report', ''];
    
    // Benchmark results
    if (this.results.size > 0) {
      report.push('## Benchmark Results', '');
      
      for (const [name, results] of this.results) {
        const latest = results[results.length - 1];
        report.push(`### ${name}`);
        report.push(`- Average Time: ${latest.averageTime.toFixed(2)}ms`);
        report.push(`- Throughput: ${latest.throughput.toFixed(2)} ops/sec`);
        report.push(`- P95 Time: ${latest.p95Time.toFixed(2)}ms`);
        report.push(`- Memory Peak: ${(latest.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        report.push(`- Errors: ${latest.errors}`);
        report.push('');
      }
    }

    // Load test results
    if (this.loadTestResults.size > 0) {
      report.push('## Load Test Results', '');
      
      for (const [name, results] of this.loadTestResults) {
        const latest = results[results.length - 1];
        report.push(`### ${name}`);
        report.push(`- Total Requests: ${latest.totalRequests}`);
        report.push(`- RPS: ${latest.requestsPerSecond.toFixed(2)}`);
        report.push(`- Average Response Time: ${latest.averageResponseTime.toFixed(2)}ms`);
        report.push(`- P95 Response Time: ${latest.p95ResponseTime.toFixed(2)}ms`);
        report.push(`- Error Rate: ${latest.errorRate.toFixed(2)}%`);
        report.push(`- Thresholds Passed: ${latest.thresholdsPassed ? '✅' : '❌'}`);
        report.push('');
      }
    }

    return report.join('\n');
  }
}