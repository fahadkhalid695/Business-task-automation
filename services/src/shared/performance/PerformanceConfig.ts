import { Logger } from '../utils/logger';
import { PerformanceProfiler } from './PerformanceProfiler';
import { BenchmarkSuite } from './BenchmarkSuite';
import { AutoScaler } from './AutoScaler';
import { CacheManager } from '../cache/CacheManager';
import { QueryOptimizer } from '../database/queryOptimizer';
import { LoadBalancer } from '../loadbalancer/LoadBalancer';
import { ResourceManager } from '../resources/ResourceManager';

const logger = new Logger('PerformanceConfig');

export interface PerformanceOptimizationConfig {
  profiling: {
    enabled: boolean;
    samplingInterval: number;
    maxSamples: number;
    slowFunctionThreshold: number;
    memoryThreshold: number;
    cpuThreshold: number;
  };
  caching: {
    enabled: boolean;
    warmupEnabled: boolean;
    warmupInterval: number;
    defaultTTL: number;
    maxMemoryUsage: number;
    compressionEnabled: boolean;
    layers: Array<{
      name: string;
      ttl: number;
      maxSize: number;
      enabled: boolean;
    }>;
  };
  database: {
    queryOptimization: boolean;
    slowQueryThreshold: number;
    indexRecommendations: boolean;
    autoCreateIndexes: boolean;
    connectionPooling: {
      enabled: boolean;
      min: number;
      max: number;
      acquireTimeout: number;
      idleTimeout: number;
    };
  };
  loadBalancing: {
    enabled: boolean;
    strategy: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'response-time';
    healthChecks: {
      enabled: boolean;
      interval: number;
      timeout: number;
      retries: number;
    };
  };
  autoScaling: {
    enabled: boolean;
    evaluationInterval: number;
    cooldownPeriod: number;
    predictiveScaling: boolean;
    kubernetes: {
      enabled: boolean;
      namespace: string;
    };
    thresholds: {
      cpu: number;
      memory: number;
      requestsPerSecond: number;
      responseTime: number;
      errorRate: number;
    };
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alerting: boolean;
    dashboards: boolean;
    performanceReports: boolean;
  };
  benchmarking: {
    enabled: boolean;
    scheduledTests: Array<{
      name: string;
      schedule: string; // cron expression
      config: any;
    }>;
    loadTesting: {
      enabled: boolean;
      maxConcurrency: number;
      duration: number;
    };
  };
}

export class PerformanceOptimizationManager {
  private static instance: PerformanceOptimizationManager;
  private config: PerformanceOptimizationConfig;
  private profiler?: PerformanceProfiler;
  private benchmarkSuite?: BenchmarkSuite;
  private autoScaler?: AutoScaler;
  private cacheManager?: CacheManager;
  private queryOptimizer?: QueryOptimizer;
  private loadBalancer?: LoadBalancer;
  private resourceManager?: ResourceManager;
  private monitoringTimer?: NodeJS.Timeout;
  private benchmarkTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor(config: Partial<PerformanceOptimizationConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.initialize();
  }

  static getInstance(config?: Partial<PerformanceOptimizationConfig>): PerformanceOptimizationManager {
    if (!PerformanceOptimizationManager.instance) {
      PerformanceOptimizationManager.instance = new PerformanceOptimizationManager(config);
    }
    return PerformanceOptimizationManager.instance;
  }

  private mergeWithDefaults(config: Partial<PerformanceOptimizationConfig>): PerformanceOptimizationConfig {
    return {
      profiling: {
        enabled: true,
        samplingInterval: 1000,
        maxSamples: 3600,
        slowFunctionThreshold: 100,
        memoryThreshold: 500 * 1024 * 1024, // 500MB
        cpuThreshold: 80,
        ...config.profiling
      },
      caching: {
        enabled: true,
        warmupEnabled: true,
        warmupInterval: 300000, // 5 minutes
        defaultTTL: 3600,
        maxMemoryUsage: 512 * 1024 * 1024, // 512MB
        compressionEnabled: true,
        layers: [
          { name: 'user', ttl: 1800, maxSize: 10000, enabled: true },
          { name: 'workflow', ttl: 3600, maxSize: 5000, enabled: true },
          { name: 'task', ttl: 900, maxSize: 20000, enabled: true },
          { name: 'analytics', ttl: 7200, maxSize: 1000, enabled: true },
          { name: 'static', ttl: 86400, maxSize: 1000, enabled: true }
        ],
        ...config.caching
      },
      database: {
        queryOptimization: true,
        slowQueryThreshold: 100,
        indexRecommendations: true,
        autoCreateIndexes: false, // Safety first
        connectionPooling: {
          enabled: true,
          min: 2,
          max: 10,
          acquireTimeout: 30000,
          idleTimeout: 300000
        },
        ...config.database
      },
      loadBalancing: {
        enabled: true,
        strategy: 'round-robin',
        healthChecks: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3
        },
        ...config.loadBalancing
      },
      autoScaling: {
        enabled: true,
        evaluationInterval: 30000,
        cooldownPeriod: 300000,
        predictiveScaling: true,
        kubernetes: {
          enabled: true,
          namespace: 'default'
        },
        thresholds: {
          cpu: 70,
          memory: 80,
          requestsPerSecond: 100,
          responseTime: 500,
          errorRate: 5
        },
        ...config.autoScaling
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
        alerting: true,
        dashboards: true,
        performanceReports: true,
        ...config.monitoring
      },
      benchmarking: {
        enabled: true,
        scheduledTests: [
          {
            name: 'daily_performance_check',
            schedule: '0 2 * * *', // Daily at 2 AM
            config: { iterations: 100, concurrent: false }
          },
          {
            name: 'weekly_load_test',
            schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
            config: { duration: 300000, maxConcurrency: 50 }
          }
        ],
        loadTesting: {
          enabled: true,
          maxConcurrency: 100,
          duration: 60000
        },
        ...config.benchmarking
      }
    };
  }

  private async initialize(): Promise<void> {
    logger.info('Initializing performance optimization manager', { config: this.config });

    try {
      // Initialize profiling
      if (this.config.profiling.enabled) {
        this.profiler = PerformanceProfiler.getInstance({
          enableCpuProfiling: true,
          enableMemoryProfiling: true,
          enableNetworkProfiling: true,
          samplingInterval: this.config.profiling.samplingInterval,
          maxSamples: this.config.profiling.maxSamples,
          thresholds: {
            slowFunction: this.config.profiling.slowFunctionThreshold,
            highMemoryUsage: this.config.profiling.memoryThreshold,
            highCpuUsage: this.config.profiling.cpuThreshold
          }
        });
        logger.info('Performance profiler initialized');
      }

      // Initialize caching
      if (this.config.caching.enabled) {
        this.cacheManager = CacheManager.getInstance();
        
        if (this.config.caching.warmupEnabled) {
          await this.setupCacheWarmup();
        }
        
        logger.info('Cache manager initialized');
      }

      // Initialize database optimization
      if (this.config.database.queryOptimization) {
        this.queryOptimizer = QueryOptimizer.getInstance();
        logger.info('Query optimizer initialized');
      }

      // Initialize load balancing
      if (this.config.loadBalancing.enabled) {
        this.loadBalancer = new LoadBalancer();
        logger.info('Load balancer initialized');
      }

      // Initialize auto-scaling
      if (this.config.autoScaling.enabled) {
        this.autoScaler = AutoScaler.getInstance({
          evaluationInterval: this.config.autoScaling.evaluationInterval,
          defaultCooldownPeriod: this.config.autoScaling.cooldownPeriod,
          enablePredictiveScaling: this.config.autoScaling.predictiveScaling,
          kubernetesEnabled: this.config.autoScaling.kubernetes.enabled,
          kubernetesNamespace: this.config.autoScaling.kubernetes.namespace
        });
        logger.info('Auto-scaler initialized');
      }

      // Initialize resource management
      this.resourceManager = ResourceManager.getInstance();
      logger.info('Resource manager initialized');

      // Initialize benchmarking
      if (this.config.benchmarking.enabled) {
        this.benchmarkSuite = BenchmarkSuite.getInstance();
        await this.setupScheduledBenchmarks();
        logger.info('Benchmark suite initialized');
      }

      // Initialize monitoring
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
        logger.info('Performance monitoring started');
      }

      logger.info('Performance optimization manager initialization complete');
    } catch (error) {
      logger.error('Failed to initialize performance optimization manager', error);
      throw error;
    }
  }

  private async setupCacheWarmup(): Promise<void> {
    if (!this.cacheManager) return;

    // Register warmup jobs for different data types
    this.cacheManager.registerWarmupJob('user:*', {
      pattern: 'user:*',
      dataLoader: async () => {
        // In a real implementation, this would load user data from the database
        const users: Record<string, any> = {};
        for (let i = 1; i <= 100; i++) {
          users[`user:${i}`] = {
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            lastLogin: new Date()
          };
        }
        return users;
      },
      ttl: this.config.caching.layers.find(l => l.name === 'user')?.ttl || 1800,
      priority: 'high'
    });

    this.cacheManager.registerWarmupJob('workflow:template:*', {
      pattern: 'workflow:template:*',
      dataLoader: async () => {
        // Load workflow templates
        const templates: Record<string, any> = {};
        const templateTypes = ['email-processing', 'data-analysis', 'report-generation'];
        
        templateTypes.forEach((type, index) => {
          templates[`workflow:template:${type}`] = {
            id: index + 1,
            name: type,
            steps: [`step1-${type}`, `step2-${type}`, `step3-${type}`],
            enabled: true
          };
        });
        
        return templates;
      },
      ttl: this.config.caching.layers.find(l => l.name === 'workflow')?.ttl || 3600,
      priority: 'medium'
    });

    logger.info('Cache warmup jobs registered');
  }

  private async setupScheduledBenchmarks(): Promise<void> {
    if (!this.benchmarkSuite) return;

    for (const scheduledTest of this.config.benchmarking.scheduledTests) {
      // In a real implementation, you would use a proper cron scheduler
      // For now, we'll simulate with intervals
      const interval = this.parseScheduleToInterval(scheduledTest.schedule);
      
      if (interval > 0) {
        const timer = setInterval(async () => {
          try {
            await this.runScheduledBenchmark(scheduledTest.name, scheduledTest.config);
          } catch (error) {
            logger.error(`Scheduled benchmark failed: ${scheduledTest.name}`, error);
          }
        }, interval);

        this.benchmarkTimers.set(scheduledTest.name, timer);
        logger.info(`Scheduled benchmark: ${scheduledTest.name}`, { schedule: scheduledTest.schedule });
      }
    }
  }

  private parseScheduleToInterval(schedule: string): number {
    // Simple schedule parsing - in production, use a proper cron parser
    if (schedule === '0 2 * * *') return 24 * 60 * 60 * 1000; // Daily
    if (schedule === '0 3 * * 0') return 7 * 24 * 60 * 60 * 1000; // Weekly
    return 0;
  }

  private async runScheduledBenchmark(name: string, config: any): Promise<void> {
    if (!this.benchmarkSuite) return;

    logger.info(`Running scheduled benchmark: ${name}`);

    try {
      if (name.includes('load_test')) {
        // Run load test
        const loadTestConfig = {
          name,
          targetFunction: async () => {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            return { success: true };
          },
          args: [],
          duration: config.duration || 60000,
          rampUpTime: 10000,
          maxConcurrency: config.maxConcurrency || 10,
          thresholds: {
            averageResponseTime: 200,
            p95ResponseTime: 500,
            errorRate: 5
          }
        };

        const result = await this.benchmarkSuite.runLoadTest(loadTestConfig);
        logger.info(`Load test completed: ${name}`, {
          totalRequests: result.totalRequests,
          averageResponseTime: result.averageResponseTime,
          errorRate: result.errorRate,
          thresholdsPassed: result.thresholdsPassed
        });
      } else {
        // Run performance benchmark
        const result = await this.benchmarkSuite.runBenchmark(
          name,
          () => {
            // Simulate work
            const arr = Array.from({ length: 1000 }, (_, i) => i);
            return arr.reduce((sum, x) => sum + x, 0);
          },
          {
            iterations: config.iterations || 100,
            concurrent: config.concurrent || false,
            warmupIterations: 10
          }
        );

        logger.info(`Benchmark completed: ${name}`, {
          averageTime: result.averageTime,
          throughput: result.throughput,
          success: result.success
        });
      }
    } catch (error) {
      logger.error(`Scheduled benchmark failed: ${name}`, error);
    }
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.collectPerformanceMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics: Record<string, any> = {};

      // Collect profiler metrics
      if (this.profiler) {
        const report = this.profiler.getPerformanceReport();
        metrics.profiler = {
          avgCpuUsage: report.summary.avgCpuUsage,
          avgMemoryUsage: report.summary.avgMemoryUsage,
          avgEventLoopLag: report.summary.avgEventLoopLag,
          slowFunctions: report.topSlowFunctions.length,
          bottlenecks: report.recentBottlenecks.length
        };
      }

      // Collect cache metrics
      if (this.cacheManager) {
        const cacheStats = this.cacheManager.getStats();
        metrics.cache = {
          hitRate: cacheStats.hitRate,
          totalKeys: cacheStats.sets,
          memoryUsage: cacheStats.memoryUsage
        };
      }

      // Collect auto-scaler metrics
      if (this.autoScaler) {
        const scalingHistory = this.autoScaler.getScalingHistory(undefined, 10);
        metrics.autoScaling = {
          recentEvents: scalingHistory.length,
          services: Object.keys(this.autoScaler.getAllServicesStatus()).length
        };
      }

      // Collect database metrics
      if (this.queryOptimizer) {
        const slowQueries = this.queryOptimizer.getSlowQueries(5);
        const recommendations = this.queryOptimizer.getIndexRecommendations();
        metrics.database = {
          slowQueries: slowQueries.length,
          indexRecommendations: recommendations.length
        };
      }

      // Log performance summary
      logger.info('Performance metrics collected', metrics);

      // Generate alerts if thresholds are exceeded
      if (this.config.monitoring.alerting) {
        this.checkPerformanceAlerts(metrics);
      }

    } catch (error) {
      logger.error('Failed to collect performance metrics', error);
    }
  }

  private checkPerformanceAlerts(metrics: Record<string, any>): void {
    const alerts: string[] = [];

    // Check CPU usage
    if (metrics.profiler?.avgCpuUsage > this.config.autoScaling.thresholds.cpu) {
      alerts.push(`High CPU usage: ${metrics.profiler.avgCpuUsage.toFixed(1)}%`);
    }

    // Check memory usage
    if (metrics.profiler?.avgMemoryUsage > this.config.profiling.memoryThreshold) {
      alerts.push(`High memory usage: ${(metrics.profiler.avgMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
    }

    // Check cache hit rate
    if (metrics.cache?.hitRate < 0.7) {
      alerts.push(`Low cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
    }

    // Check slow queries
    if (metrics.database?.slowQueries > 5) {
      alerts.push(`Multiple slow queries detected: ${metrics.database.slowQueries}`);
    }

    if (alerts.length > 0) {
      logger.warn('Performance alerts triggered', { alerts });
    }
  }

  // Public API methods
  async optimizePerformance(): Promise<void> {
    logger.info('Starting performance optimization');

    try {
      // Apply database optimizations
      if (this.queryOptimizer && this.config.database.autoCreateIndexes) {
        await this.queryOptimizer.createRecommendedIndexes();
        logger.info('Database indexes optimized');
      }

      // Warm up caches
      if (this.cacheManager && this.config.caching.warmupEnabled) {
        await this.cacheManager.warmupCache();
        logger.info('Cache warmed up');
      }

      // Clear old performance data
      if (this.profiler) {
        this.profiler.clearProfiles();
        logger.info('Performance profiles cleared');
      }

      logger.info('Performance optimization completed');
    } catch (error) {
      logger.error('Performance optimization failed', error);
      throw error;
    }
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {
      timestamp: new Date(),
      config: this.config
    };

    if (this.profiler) {
      report.profiler = this.profiler.getPerformanceReport();
    }

    if (this.cacheManager) {
      report.cache = this.cacheManager.getStats();
    }

    if (this.autoScaler) {
      report.autoScaling = this.autoScaler.getAllServicesStatus();
    }

    if (this.queryOptimizer) {
      report.database = this.queryOptimizer.getQueryStats();
    }

    if (this.benchmarkSuite) {
      report.benchmarks = {
        results: Array.from(this.benchmarkSuite.getBenchmarkResults().entries()),
        loadTests: Array.from(this.benchmarkSuite.getLoadTestResults().entries())
      };
    }

    return report;
  }

  updateConfig(newConfig: Partial<PerformanceOptimizationConfig>): void {
    this.config = this.mergeWithDefaults(newConfig);
    logger.info('Performance configuration updated', { config: this.config });
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down performance optimization manager');

    // Clear monitoring timer
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // Clear benchmark timers
    for (const timer of this.benchmarkTimers.values()) {
      clearInterval(timer);
    }
    this.benchmarkTimers.clear();

    // Shutdown components
    if (this.profiler) {
      this.profiler.shutdown();
    }

    if (this.autoScaler) {
      this.autoScaler.shutdown();
    }

    if (this.cacheManager) {
      this.cacheManager.shutdown();
    }

    if (this.loadBalancer) {
      this.loadBalancer.shutdown();
    }

    if (this.resourceManager) {
      await this.resourceManager.shutdown();
    }

    logger.info('Performance optimization manager shutdown complete');
  }
}

// Export singleton instance
export const performanceManager = PerformanceOptimizationManager.getInstance();