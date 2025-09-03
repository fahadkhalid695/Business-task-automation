import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { performance, PerformanceObserver } from 'perf_hooks';

const logger = new Logger('PerformanceProfiler');
const metrics = MetricsCollector.getInstance();

export interface ProfilerConfig {
  enableCpuProfiling: boolean;
  enableMemoryProfiling: boolean;
  enableNetworkProfiling: boolean;
  samplingInterval: number; // milliseconds
  maxSamples: number;
  thresholds: {
    slowFunction: number; // milliseconds
    highMemoryUsage: number; // bytes
    highCpuUsage: number; // percentage
  };
}

export interface PerformanceSample {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  eventLoopLag: number;
  activeHandles: number;
  activeRequests: number;
}

export interface FunctionProfile {
  name: string;
  callCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastCalled: Date;
  samples: number[];
}

export interface BottleneckAnalysis {
  type: 'cpu' | 'memory' | 'io' | 'database' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFunctions: string[];
  recommendations: string[];
  metrics: Record<string, number>;
  timestamp: Date;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private config: ProfilerConfig;
  private samples: PerformanceSample[] = [];
  private functionProfiles: Map<string, FunctionProfile> = new Map();
  private bottlenecks: BottleneckAnalysis[] = [];
  private samplingTimer?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;
  private eventLoopMonitor?: NodeJS.Timeout;
  private lastEventLoopTime = performance.now();

  private constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      enableCpuProfiling: true,
      enableMemoryProfiling: true,
      enableNetworkProfiling: true,
      samplingInterval: 1000, // 1 second
      maxSamples: 3600, // 1 hour of samples
      thresholds: {
        slowFunction: 100, // 100ms
        highMemoryUsage: 500 * 1024 * 1024, // 500MB
        highCpuUsage: 80 // 80%
      },
      ...config
    };

    this.initialize();
  }

  static getInstance(config?: Partial<ProfilerConfig>): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler(config);
    }
    return PerformanceProfiler.instance;
  }

  private initialize(): void {
    if (this.config.enableCpuProfiling || this.config.enableMemoryProfiling) {
      this.startSampling();
    }

    this.setupPerformanceObserver();
    this.startEventLoopMonitoring();
    this.startBottleneckAnalysis();

    logger.info('Performance profiler initialized', { config: this.config });
  }

  private startSampling(): void {
    this.samplingTimer = setInterval(() => {
      this.collectSample();
    }, this.config.samplingInterval);
  }

  private collectSample(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate CPU usage percentage (approximation)
    const cpuPercent = this.calculateCpuUsage(cpuUsage);

    const sample: PerformanceSample = {
      timestamp: new Date(),
      cpuUsage: cpuPercent,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      eventLoopLag: this.getEventLoopLag(),
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length
    };

    this.samples.push(sample);

    // Keep only the last maxSamples
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }

    // Record metrics
    metrics.setGauge('performance_cpu_usage_percent', sample.cpuUsage);
    metrics.setGauge('performance_memory_heap_used_bytes', sample.memoryUsage.heapUsed);
    metrics.setGauge('performance_memory_heap_total_bytes', sample.memoryUsage.heapTotal);
    metrics.setGauge('performance_event_loop_lag_ms', sample.eventLoopLag);
    metrics.setGauge('performance_active_handles', sample.activeHandles);
    metrics.setGauge('performance_active_requests', sample.activeRequests);

    // Check for performance issues
    this.checkPerformanceThresholds(sample);
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified CPU usage calculation
    // In production, you'd want a more sophisticated approach
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalUsage / 1000000) / this.config.samplingInterval * 100);
  }

  private getEventLoopLag(): number {
    const now = performance.now();
    const lag = now - this.lastEventLoopTime - this.config.samplingInterval;
    this.lastEventLoopTime = now;
    return Math.max(0, lag);
  }

  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        if (entry.entryType === 'function') {
          this.recordFunctionCall(entry.name, entry.duration);
        } else if (entry.entryType === 'measure') {
          this.recordMeasurement(entry.name, entry.duration);
        }
      }
    });

    this.performanceObserver.observe({ 
      entryTypes: ['function', 'measure', 'navigation', 'resource'] 
    });
  }

  private startEventLoopMonitoring(): void {
    this.eventLoopMonitor = setInterval(() => {
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        metrics.setGauge('event_loop_lag_ms', lag);
        
        if (lag > 100) { // More than 100ms lag
          logger.warn('High event loop lag detected', { lag });
          metrics.incrementCounter('event_loop_lag_warnings_total', 1);
        }
      });
    }, 5000); // Check every 5 seconds
  }

  private startBottleneckAnalysis(): void {
    // Run bottleneck analysis every 5 minutes
    setInterval(() => {
      this.analyzeBottlenecks();
    }, 5 * 60 * 1000);
  }

  // Function profiling
  profileFunction<T extends (...args: any[]) => any>(
    fn: T,
    name?: string
  ): T {
    const functionName = name || fn.name || 'anonymous';
    
    return ((...args: any[]) => {
      const start = performance.now();
      
      try {
        const result = fn.apply(this, args);
        
        // Handle async functions
        if (result && typeof result.then === 'function') {
          return result.finally(() => {
            const duration = performance.now() - start;
            this.recordFunctionCall(functionName, duration);
          });
        } else {
          const duration = performance.now() - start;
          this.recordFunctionCall(functionName, duration);
          return result;
        }
      } catch (error) {
        const duration = performance.now() - start;
        this.recordFunctionCall(functionName, duration);
        throw error;
      }
    }) as T;
  }

  // Decorator for automatic function profiling
  profile(name?: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      const functionName = name || `${target.constructor.name}.${propertyKey}`;
      
      descriptor.value = this.profileFunction(originalMethod, functionName);
      return descriptor;
    };
  }

  private recordFunctionCall(name: string, duration: number): void {
    let profile = this.functionProfiles.get(name);
    
    if (!profile) {
      profile = {
        name,
        callCount: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        lastCalled: new Date(),
        samples: []
      };
      this.functionProfiles.set(name, profile);
    }

    profile.callCount++;
    profile.totalTime += duration;
    profile.averageTime = profile.totalTime / profile.callCount;
    profile.minTime = Math.min(profile.minTime, duration);
    profile.maxTime = Math.max(profile.maxTime, duration);
    profile.lastCalled = new Date();
    
    // Keep last 100 samples for each function
    profile.samples.push(duration);
    if (profile.samples.length > 100) {
      profile.samples.shift();
    }

    // Record metrics
    metrics.recordHistogram('function_duration_ms', duration, { function: name });
    
    if (duration > this.config.thresholds.slowFunction) {
      logger.warn(`Slow function detected: ${name}`, { duration });
      metrics.incrementCounter('slow_functions_total', 1, { function: name });
    }
  }

  private recordMeasurement(name: string, duration: number): void {
    metrics.recordHistogram('measurement_duration_ms', duration, { measurement: name });
  }

  private checkPerformanceThresholds(sample: PerformanceSample): void {
    // Check CPU usage
    if (sample.cpuUsage > this.config.thresholds.highCpuUsage) {
      logger.warn('High CPU usage detected', { cpuUsage: sample.cpuUsage });
      metrics.incrementCounter('performance_threshold_violations_total', 1, { 
        type: 'cpu' 
      });
    }

    // Check memory usage
    if (sample.memoryUsage.heapUsed > this.config.thresholds.highMemoryUsage) {
      logger.warn('High memory usage detected', { 
        heapUsed: sample.memoryUsage.heapUsed 
      });
      metrics.incrementCounter('performance_threshold_violations_total', 1, { 
        type: 'memory' 
      });
    }

    // Check event loop lag
    if (sample.eventLoopLag > 100) {
      logger.warn('High event loop lag detected', { 
        eventLoopLag: sample.eventLoopLag 
      });
      metrics.incrementCounter('performance_threshold_violations_total', 1, { 
        type: 'event_loop' 
      });
    }
  }

  private analyzeBottlenecks(): void {
    const bottlenecks: BottleneckAnalysis[] = [];

    // Analyze CPU bottlenecks
    const avgCpuUsage = this.getAverageCpuUsage();
    if (avgCpuUsage > 70) {
      bottlenecks.push({
        type: 'cpu',
        severity: avgCpuUsage > 90 ? 'critical' : avgCpuUsage > 80 ? 'high' : 'medium',
        description: `High CPU usage detected (${avgCpuUsage.toFixed(1)}%)`,
        affectedFunctions: this.getSlowFunctions(),
        recommendations: [
          'Optimize CPU-intensive functions',
          'Consider implementing caching',
          'Review algorithm complexity',
          'Scale horizontally if needed'
        ],
        metrics: { avgCpuUsage },
        timestamp: new Date()
      });
    }

    // Analyze memory bottlenecks
    const avgMemoryUsage = this.getAverageMemoryUsage();
    if (avgMemoryUsage > this.config.thresholds.highMemoryUsage * 0.8) {
      bottlenecks.push({
        type: 'memory',
        severity: avgMemoryUsage > this.config.thresholds.highMemoryUsage ? 'critical' : 'high',
        description: `High memory usage detected (${(avgMemoryUsage / 1024 / 1024).toFixed(1)}MB)`,
        affectedFunctions: this.getMemoryIntensiveFunctions(),
        recommendations: [
          'Implement memory pooling',
          'Review object lifecycle management',
          'Consider streaming for large data sets',
          'Optimize data structures'
        ],
        metrics: { avgMemoryUsage },
        timestamp: new Date()
      });
    }

    // Analyze I/O bottlenecks
    const avgEventLoopLag = this.getAverageEventLoopLag();
    if (avgEventLoopLag > 50) {
      bottlenecks.push({
        type: 'io',
        severity: avgEventLoopLag > 200 ? 'critical' : avgEventLoopLag > 100 ? 'high' : 'medium',
        description: `High I/O blocking detected (${avgEventLoopLag.toFixed(1)}ms event loop lag)`,
        affectedFunctions: this.getBlockingFunctions(),
        recommendations: [
          'Use asynchronous I/O operations',
          'Implement connection pooling',
          'Consider worker threads for CPU-intensive tasks',
          'Optimize database queries'
        ],
        metrics: { avgEventLoopLag },
        timestamp: new Date()
      });
    }

    // Store bottlenecks
    this.bottlenecks.push(...bottlenecks);
    
    // Keep only last 100 bottleneck analyses
    if (this.bottlenecks.length > 100) {
      this.bottlenecks.splice(0, this.bottlenecks.length - 100);
    }

    if (bottlenecks.length > 0) {
      logger.warn(`Detected ${bottlenecks.length} performance bottlenecks`, {
        bottlenecks: bottlenecks.map(b => ({ type: b.type, severity: b.severity }))
      });

      metrics.incrementCounter('bottlenecks_detected_total', bottlenecks.length);
    }
  }

  private getAverageCpuUsage(): number {
    if (this.samples.length === 0) return 0;
    const recentSamples = this.samples.slice(-60); // Last minute
    return recentSamples.reduce((sum, sample) => sum + sample.cpuUsage, 0) / recentSamples.length;
  }

  private getAverageMemoryUsage(): number {
    if (this.samples.length === 0) return 0;
    const recentSamples = this.samples.slice(-60); // Last minute
    return recentSamples.reduce((sum, sample) => sum + sample.memoryUsage.heapUsed, 0) / recentSamples.length;
  }

  private getAverageEventLoopLag(): number {
    if (this.samples.length === 0) return 0;
    const recentSamples = this.samples.slice(-60); // Last minute
    return recentSamples.reduce((sum, sample) => sum + sample.eventLoopLag, 0) / recentSamples.length;
  }

  private getSlowFunctions(): string[] {
    return Array.from(this.functionProfiles.values())
      .filter(profile => profile.averageTime > this.config.thresholds.slowFunction)
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)
      .map(profile => profile.name);
  }

  private getMemoryIntensiveFunctions(): string[] {
    // This would require more sophisticated memory tracking per function
    // For now, return functions with high call counts as they might be memory intensive
    return Array.from(this.functionProfiles.values())
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10)
      .map(profile => profile.name);
  }

  private getBlockingFunctions(): string[] {
    // Functions with high maximum execution times might be blocking
    return Array.from(this.functionProfiles.values())
      .filter(profile => profile.maxTime > 500) // More than 500ms
      .sort((a, b) => b.maxTime - a.maxTime)
      .slice(0, 10)
      .map(profile => profile.name);
  }

  // Public API methods
  getPerformanceReport(): Record<string, any> {
    const recentSamples = this.samples.slice(-60); // Last minute
    
    return {
      summary: {
        avgCpuUsage: this.getAverageCpuUsage(),
        avgMemoryUsage: this.getAverageMemoryUsage(),
        avgEventLoopLag: this.getAverageEventLoopLag(),
        totalSamples: this.samples.length,
        totalFunctions: this.functionProfiles.size
      },
      topSlowFunctions: Array.from(this.functionProfiles.values())
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10)
        .map(profile => ({
          name: profile.name,
          callCount: profile.callCount,
          averageTime: profile.averageTime,
          maxTime: profile.maxTime
        })),
      recentBottlenecks: this.bottlenecks.slice(-10),
      systemMetrics: recentSamples.length > 0 ? {
        cpu: {
          current: recentSamples[recentSamples.length - 1].cpuUsage,
          average: this.getAverageCpuUsage(),
          max: Math.max(...recentSamples.map(s => s.cpuUsage))
        },
        memory: {
          current: recentSamples[recentSamples.length - 1].memoryUsage.heapUsed,
          average: this.getAverageMemoryUsage(),
          max: Math.max(...recentSamples.map(s => s.memoryUsage.heapUsed))
        },
        eventLoop: {
          current: recentSamples[recentSamples.length - 1].eventLoopLag,
          average: this.getAverageEventLoopLag(),
          max: Math.max(...recentSamples.map(s => s.eventLoopLag))
        }
      } : null
    };
  }

  getFunctionProfile(name: string): FunctionProfile | null {
    return this.functionProfiles.get(name) || null;
  }

  getAllFunctionProfiles(): FunctionProfile[] {
    return Array.from(this.functionProfiles.values());
  }

  getBottlenecks(): BottleneckAnalysis[] {
    return [...this.bottlenecks];
  }

  clearProfiles(): void {
    this.functionProfiles.clear();
    this.samples.length = 0;
    this.bottlenecks.length = 0;
    logger.info('Performance profiles cleared');
  }

  shutdown(): void {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
    }
    
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    logger.info('Performance profiler shutdown complete');
  }
}