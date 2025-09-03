import { BenchmarkSuite } from '../../shared/performance/BenchmarkSuite';
import { PerformanceProfiler } from '../../shared/performance/PerformanceProfiler';
import { AutoScaler } from '../../shared/performance/AutoScaler';
import { CacheManager } from '../../shared/cache/CacheManager';
import { QueryOptimizer } from '../../shared/database/queryOptimizer';
import { LoadBalancer } from '../../shared/loadbalancer/LoadBalancer';
import { ResourceManager } from '../../shared/resources/ResourceManager';

describe('Performance Optimization and Scaling', () => {
  let benchmarkSuite: BenchmarkSuite;
  let profiler: PerformanceProfiler;
  let autoScaler: AutoScaler;
  let cacheManager: CacheManager;
  let queryOptimizer: QueryOptimizer;
  let loadBalancer: LoadBalancer;
  let resourceManager: ResourceManager;

  beforeAll(() => {
    benchmarkSuite = BenchmarkSuite.getInstance();
    profiler = PerformanceProfiler.getInstance();
    autoScaler = AutoScaler.getInstance();
    cacheManager = CacheManager.getInstance();
    queryOptimizer = QueryOptimizer.getInstance();
    loadBalancer = new LoadBalancer();
    resourceManager = ResourceManager.getInstance();
  });

  afterAll(() => {
    profiler.shutdown();
    autoScaler.shutdown();
    cacheManager.shutdown();
    loadBalancer.shutdown();
  });

  describe('Database Query Optimization', () => {
    test('should track and optimize slow queries', async () => {
      // Simulate a slow query
      const slowQuery = 'db.users.find({name: {$regex: "test"}}).sort({createdAt: -1})';
      const executionTime = 1500; // 1.5 seconds (slow)

      queryOptimizer.trackQuery(slowQuery, executionTime);

      const stats = queryOptimizer.getQueryStats();
      expect(stats.queries).toBeDefined();
      
      const slowQueries = queryOptimizer.getSlowQueries();
      expect(slowQueries.length).toBeGreaterThan(0);
    });

    test('should generate index recommendations', async () => {
      // Simulate multiple slow queries on the same collection
      const queries = [
        'db.users.find({email: "test@example.com"})',
        'db.users.find({status: "active"}).sort({createdAt: -1})',
        'db.users.find({role: "admin", department: "IT"})'
      ];

      for (const query of queries) {
        queryOptimizer.trackQuery(query, 800); // Slow enough to trigger recommendations
      }

      const recommendations = queryOptimizer.getIndexRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      
      const firstRecommendation = recommendations[0];
      expect(firstRecommendation).toHaveProperty('collection');
      expect(firstRecommendation).toHaveProperty('fields');
      expect(firstRecommendation).toHaveProperty('priority');
    });

    test('should optimize query execution plans', () => {
      const query = 'db.tasks.find({status: "pending", priority: {$gte: 5}}).sort({createdAt: -1})';
      const plan = queryOptimizer.optimizeQuery(query);

      expect(plan).toHaveProperty('query');
      expect(plan).toHaveProperty('estimatedCost');
      expect(plan).toHaveProperty('recommendations');
      expect(plan.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Performance and Warming', () => {
    test('should implement multi-layer caching with warmup', async () => {
      const testKey = 'test:user:123';
      const testValue = { id: 123, name: 'Test User', email: 'test@example.com' };

      // Test cache miss and set
      let cachedValue = await cacheManager.get(testKey, 'user');
      expect(cachedValue).toBeNull();

      await cacheManager.set(testKey, testValue, undefined, 'user');

      // Test cache hit
      cachedValue = await cacheManager.get(testKey, 'user');
      expect(cachedValue).toEqual(testValue);

      const stats = cacheManager.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);
    });

    test('should register and execute warmup jobs', async () => {
      const warmupPattern = 'user:*';
      const warmupJob = {
        pattern: warmupPattern,
        dataLoader: async () => ({
          'user:1': { id: 1, name: 'User 1' },
          'user:2': { id: 2, name: 'User 2' },
          'user:3': { id: 3, name: 'User 3' }
        }),
        ttl: 3600,
        priority: 'high' as const
      };

      cacheManager.registerWarmupJob(warmupPattern, warmupJob);

      // Execute warmup for specific pattern
      await cacheManager.warmupSpecificPattern(warmupPattern);

      // Verify data was cached
      const user1 = await cacheManager.get('user:1');
      expect(user1).toEqual({ id: 1, name: 'User 1' });

      const warmupJobs = cacheManager.getWarmupJobs();
      expect(warmupJobs.length).toBeGreaterThan(0);
    });

    test('should handle cache invalidation patterns', async () => {
      // Set multiple cache entries
      await cacheManager.set('user:profile:1', { name: 'User 1' }, undefined, 'user');
      await cacheManager.set('user:profile:2', { name: 'User 2' }, undefined, 'user');
      await cacheManager.set('task:data:1', { title: 'Task 1' }, undefined, 'task');

      // Invalidate user profile pattern
      await cacheManager.invalidatePattern('user:profile:*', 'user');

      // Verify user profiles are invalidated but task data remains
      const user1 = await cacheManager.get('user:profile:1', 'user');
      const task1 = await cacheManager.get('task:data:1', 'task');
      
      expect(user1).toBeNull();
      expect(task1).toEqual({ title: 'Task 1' });
    });
  });

  describe('Load Balancing with Health Checks', () => {
    test('should register services and perform health checks', async () => {
      const serviceName = 'test-service';
      const instance = {
        id: 'instance-1',
        host: 'localhost',
        port: 3001,
        weight: 1,
        maxConnections: 100
      };

      const healthCheckConfig = {
        endpoint: '/health',
        interval: 5000,
        timeout: 3000,
        retries: 3,
        expectedStatusCode: 200
      };

      loadBalancer.registerService(serviceName, instance, healthCheckConfig);

      // Test instance selection
      const selectedInstance = await loadBalancer.selectInstance(serviceName);
      expect(selectedInstance).toBeDefined();
      expect(selectedInstance?.id).toBe('instance-1');

      // Test connection release
      if (selectedInstance) {
        loadBalancer.releaseConnection(serviceName, selectedInstance.id);
        expect(selectedInstance.activeConnections).toBe(0);
      }

      const stats = loadBalancer.getServiceStats(serviceName);
      expect(stats[serviceName]).toBeDefined();
      expect(stats[serviceName].totalInstances).toBe(1);
    });

    test('should implement different load balancing strategies', async () => {
      const serviceName = 'multi-instance-service';
      
      // Register multiple instances
      for (let i = 1; i <= 3; i++) {
        loadBalancer.registerService(serviceName, {
          id: `instance-${i}`,
          host: 'localhost',
          port: 3000 + i,
          weight: i, // Different weights
          maxConnections: 100
        }, {
          endpoint: '/health',
          interval: 5000,
          timeout: 3000,
          retries: 3
        });
      }

      // Test round-robin
      const roundRobinSelections = [];
      for (let i = 0; i < 6; i++) {
        const instance = await loadBalancer.selectInstance(serviceName, { name: 'round-robin' });
        if (instance) {
          roundRobinSelections.push(instance.id);
          loadBalancer.releaseConnection(serviceName, instance.id);
        }
      }

      expect(roundRobinSelections).toHaveLength(6);
      expect(new Set(roundRobinSelections).size).toBe(3); // Should cycle through all instances

      // Test weighted round-robin
      const weightedSelections = [];
      for (let i = 0; i < 12; i++) {
        const instance = await loadBalancer.selectInstance(serviceName, { name: 'weighted-round-robin' });
        if (instance) {
          weightedSelections.push(instance.id);
          loadBalancer.releaseConnection(serviceName, instance.id);
        }
      }

      // Instance-3 should be selected more often due to higher weight
      const instance3Count = weightedSelections.filter(id => id === 'instance-3').length;
      expect(instance3Count).toBeGreaterThan(2);
    });
  });

  describe('Auto-Scaling Mechanisms', () => {
    test('should register services and create scaling rules', () => {
      const serviceName = 'scalable-service';
      const config = {
        serviceName,
        currentInstances: 2,
        minInstances: 1,
        maxInstances: 10,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        targetRequestsPerSecond: 100,
        customMetrics: [
          { name: 'queue_length', target: 50, weight: 30 }
        ]
      };

      autoScaler.registerService(serviceName, config);

      const status = autoScaler.getServiceStatus(serviceName);
      expect(status).toBeDefined();
      expect(status?.currentInstances).toBe(2);
      expect(status?.rules.length).toBeGreaterThan(0);
    });

    test('should perform manual scaling', async () => {
      const serviceName = 'manual-scale-service';
      
      // Register service first
      autoScaler.registerService(serviceName, {
        serviceName,
        currentInstances: 2,
        minInstances: 1,
        maxInstances: 10,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        targetRequestsPerSecond: 100,
        customMetrics: []
      });

      // Perform manual scaling
      await autoScaler.manualScale(serviceName, 5, 'Load testing preparation');

      const status = autoScaler.getServiceStatus(serviceName);
      expect(status?.currentInstances).toBe(5);

      const history = autoScaler.getScalingHistory(serviceName);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].rule).toBe('manual');
      expect(history[0].reason).toBe('Load testing preparation');
    });

    test('should manage scaling rules', () => {
      const serviceName = 'rule-management-service';
      
      autoScaler.registerService(serviceName, {
        serviceName,
        currentInstances: 2,
        minInstances: 1,
        maxInstances: 10,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        targetRequestsPerSecond: 100,
        customMetrics: []
      });

      // Add custom rule
      const customRule = {
        name: 'custom_response_time_rule',
        metric: 'response_time',
        threshold: 500,
        comparison: 'greater' as const,
        action: 'scale_up' as const,
        cooldownPeriod: 300000,
        minInstances: 1,
        maxInstances: 10,
        scaleStep: 2,
        enabled: true
      };

      autoScaler.addScalingRule(serviceName, customRule);

      let status = autoScaler.getServiceStatus(serviceName);
      const ruleExists = status?.rules.some(rule => rule.name === 'custom_response_time_rule');
      expect(ruleExists).toBe(true);

      // Disable rule
      autoScaler.disableRule(serviceName, 'custom_response_time_rule');
      
      status = autoScaler.getServiceStatus(serviceName);
      const disabledRule = status?.rules.find(rule => rule.name === 'custom_response_time_rule');
      expect(disabledRule?.enabled).toBe(false);

      // Remove rule
      autoScaler.removeScalingRule(serviceName, 'custom_response_time_rule');
      
      status = autoScaler.getServiceStatus(serviceName);
      const removedRule = status?.rules.find(rule => rule.name === 'custom_response_time_rule');
      expect(removedRule).toBeUndefined();
    });
  });

  describe('Performance Profiling and Benchmarking', () => {
    test('should profile function execution', async () => {
      const testFunction = profiler.profileFunction(async (n: number) => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < n; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      }, 'test_math_function');

      // Execute the function multiple times
      for (let i = 0; i < 10; i++) {
        await testFunction(1000);
      }

      const profile = profiler.getFunctionProfile('test_math_function');
      expect(profile).toBeDefined();
      expect(profile?.callCount).toBe(10);
      expect(profile?.averageTime).toBeGreaterThan(0);
    });

    test('should run performance benchmarks', async () => {
      const result = await benchmarkSuite.runBenchmark(
        'array_operations',
        () => {
          const arr = Array.from({ length: 1000 }, (_, i) => i);
          return arr.map(x => x * 2).filter(x => x % 3 === 0).reduce((sum, x) => sum + x, 0);
        },
        {
          iterations: 100,
          warmupIterations: 10,
          concurrent: false
        }
      );

      expect(result.name).toBe('array_operations');
      expect(result.iterations).toBe(100);
      expect(result.averageTime).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    test('should run load tests', async () => {
      const mockAsyncFunction = async (data: any) => {
        // Simulate async work with variable delay
        const delay = Math.random() * 50 + 10; // 10-60ms
        await new Promise(resolve => setTimeout(resolve, delay));
        return { processed: true, data };
      };

      const loadTestConfig = {
        name: 'async_processing_load_test',
        targetFunction: mockAsyncFunction,
        args: [{ test: 'data' }],
        duration: 5000, // 5 seconds
        rampUpTime: 1000, // 1 second ramp-up
        maxConcurrency: 10,
        thresholds: {
          averageResponseTime: 100, // 100ms
          p95ResponseTime: 200, // 200ms
          errorRate: 5 // 5%
        }
      };

      const result = await benchmarkSuite.runLoadTest(loadTestConfig);

      expect(result.name).toBe('async_processing_load_test');
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.requestsPerSecond).toBeGreaterThan(0);
      expect(result.errorRate).toBeLessThanOrEqual(100);
    });

    test('should detect performance bottlenecks', async () => {
      // Create a function that will trigger bottleneck detection
      const bottleneckFunction = profiler.profileFunction(async () => {
        // Simulate CPU-intensive work
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
          result += Math.sin(i) * Math.cos(i);
        }
        return result;
      }, 'cpu_intensive_function');

      // Execute multiple times to trigger bottleneck analysis
      for (let i = 0; i < 5; i++) {
        await bottleneckFunction();
      }

      const report = profiler.getPerformanceReport();
      expect(report.summary).toBeDefined();
      expect(report.topSlowFunctions).toBeDefined();
      expect(report.topSlowFunctions.length).toBeGreaterThan(0);
    });

    test('should run stress tests', async () => {
      const stressFunction = async () => {
        // Simple function for stress testing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return Math.random();
      };

      const stressResults = await benchmarkSuite.runStressTest(
        'stress_test_example',
        stressFunction,
        {
          startConcurrency: 1,
          maxConcurrency: 5,
          stepSize: 1,
          stepDuration: 2000, // 2 seconds per step
          breakOnFailure: false
        }
      );

      expect(stressResults.length).toBeGreaterThan(0);
      expect(stressResults[0].concurrency).toBe(1);
      expect(stressResults[stressResults.length - 1].concurrency).toBeLessThanOrEqual(5);
    });

    test('should detect memory leaks', async () => {
      const memoryLeakFunction = async () => {
        // Simulate potential memory leak (but clean it up)
        const largeArray = new Array(1000).fill('test data');
        // Normally this would cause a leak if not cleaned up
        largeArray.length = 0; // Clean up to avoid actual leak in test
      };

      const leakDetection = await benchmarkSuite.detectMemoryLeaks(
        'memory_leak_test',
        memoryLeakFunction,
        {
          iterations: 50,
          samplingInterval: 10,
          memoryThreshold: 1024 * 1024 // 1MB threshold
        }
      );

      expect(leakDetection.hasLeak).toBeDefined();
      expect(leakDetection.memoryGrowth).toBeDefined();
      expect(leakDetection.samples.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management and Connection Pooling', () => {
    test('should create and manage resource pools', async () => {
      // Create a simple resource factory for testing
      class TestResource {
        constructor(public id: string, public createdAt: Date, public lastUsed: Date, public inUse: boolean, public isValid: boolean) {}
      }

      class TestResourceFactory {
        private counter = 0;

        async create(): Promise<TestResource> {
          this.counter++;
          return new TestResource(
            `test-resource-${this.counter}`,
            new Date(),
            new Date(),
            false,
            true
          );
        }

        async destroy(resource: TestResource): Promise<void> {
          // Cleanup logic would go here
        }

        async validate(resource: TestResource): Promise<boolean> {
          return resource.isValid;
        }

        async reset(resource: TestResource): Promise<void> {
          resource.lastUsed = new Date();
        }
      }

      const factory = new TestResourceFactory();
      const pool = resourceManager.createPool('test-pool', factory, {
        min: 2,
        max: 5,
        acquireTimeoutMillis: 5000
      });

      // Test resource acquisition and release
      const resource1 = await pool.acquire();
      expect(resource1).toBeDefined();
      expect(resource1.inUse).toBe(true);

      const resource2 = await pool.acquire();
      expect(resource2).toBeDefined();
      expect(resource2.id).not.toBe(resource1.id);

      await pool.release(resource1);
      expect(resource1.inUse).toBe(false);

      await pool.release(resource2);

      const stats = pool.getStats();
      expect(stats.totalResources).toBeGreaterThanOrEqual(2);
      expect(stats.availableResources).toBeGreaterThanOrEqual(2);
    });

    test('should handle resource pool statistics', () => {
      const allStats = resourceManager.getAllPoolStats();
      expect(allStats).toBeDefined();
      expect(typeof allStats).toBe('object');
    });
  });

  describe('Integration Performance Tests', () => {
    test('should measure end-to-end performance', async () => {
      // Simulate a complete workflow with caching, database queries, and processing
      const workflowBenchmark = await benchmarkSuite.runBenchmark(
        'end_to_end_workflow',
        async () => {
          // 1. Check cache
          const cacheKey = 'workflow:test:123';
          let data = await cacheManager.get(cacheKey);
          
          if (!data) {
            // 2. Simulate database query
            await new Promise(resolve => setTimeout(resolve, 10)); // 10ms DB query
            data = { id: 123, processed: false };
            
            // 3. Cache the result
            await cacheManager.set(cacheKey, data, 300); // 5 minutes TTL
          }
          
          // 4. Process the data
          const processed = { ...data, processed: true, timestamp: Date.now() };
          
          // 5. Update cache
          await cacheManager.set(cacheKey, processed, 300);
          
          return processed;
        },
        {
          iterations: 50,
          warmupIterations: 5,
          concurrent: true,
          concurrency: 5
        }
      );

      expect(workflowBenchmark.success).toBe(true);
      expect(workflowBenchmark.averageTime).toBeLessThan(100); // Should be fast due to caching
    });

    test('should validate performance thresholds', async () => {
      const performanceReport = profiler.getPerformanceReport();
      
      // Validate system performance metrics
      expect(performanceReport.summary.avgCpuUsage).toBeLessThan(80); // Less than 80% CPU
      expect(performanceReport.summary.avgEventLoopLag).toBeLessThan(100); // Less than 100ms lag
      
      // Validate cache performance
      const cacheStats = cacheManager.getStats();
      if (cacheStats.hits + cacheStats.misses > 0) {
        expect(cacheStats.hitRate).toBeGreaterThan(0.5); // At least 50% hit rate
      }
    });
  });

  describe('Performance Monitoring and Alerting', () => {
    test('should generate performance reports', () => {
      const report = benchmarkSuite.generateReport();
      expect(report).toContain('# Performance Benchmark Report');
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    test('should compare benchmark results', async () => {
      // Run the same benchmark twice
      await benchmarkSuite.runBenchmark('comparison_test', () => {
        return Array.from({ length: 100 }, (_, i) => i).reduce((sum, x) => sum + x, 0);
      }, { iterations: 10 });

      await benchmarkSuite.runBenchmark('comparison_test', () => {
        return Array.from({ length: 100 }, (_, i) => i).reduce((sum, x) => sum + x, 0);
      }, { iterations: 10 });

      const comparison = benchmarkSuite.compareBenchmarks('comparison_test');
      expect(comparison).toBeDefined();
      expect(comparison?.current).toBeDefined();
      expect(comparison?.baseline).toBeDefined();
      expect(comparison?.improvement).toBeDefined();
    });

    test('should track scaling events and history', () => {
      const allServicesStatus = autoScaler.getAllServicesStatus();
      expect(typeof allServicesStatus).toBe('object');

      const scalingHistory = autoScaler.getScalingHistory();
      expect(Array.isArray(scalingHistory)).toBe(true);
    });
  });
});