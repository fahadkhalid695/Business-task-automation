import { RedisCache } from './RedisCache';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

const logger = new Logger('CacheManager');
const metrics = MetricsCollector.getInstance();

export interface CacheStrategy {
  name: string;
  ttl: number;
  warmupInterval?: number;
  warmupFunction?: () => Promise<void>;
  invalidationPattern?: string;
  compressionEnabled?: boolean;
}

export interface CacheWarmupConfig {
  key: string;
  dataLoader: () => Promise<any>;
  schedule: string; // cron-like schedule
  priority: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: RedisCache;
  private strategies: Map<string, CacheStrategy> = new Map();
  private warmupConfigs: Map<string, CacheWarmupConfig> = new Map();
  private warmupTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.cache = new RedisCache({ prefix: 'app:' });
    this.setupDefaultStrategies();
    this.startCacheMonitoring();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private setupDefaultStrategies(): void {
    // User session cache - short TTL, high frequency
    this.addStrategy('user_session', {
      name: 'user_session',
      ttl: 1800, // 30 minutes
      compressionEnabled: false
    });

    // User profile cache - medium TTL, moderate frequency
    this.addStrategy('user_profile', {
      name: 'user_profile',
      ttl: 3600, // 1 hour
      warmupInterval: 30 * 60 * 1000, // 30 minutes
      invalidationPattern: 'user:*:profile',
      compressionEnabled: true
    });

    // Task data cache - medium TTL, high frequency
    this.addStrategy('task_data', {
      name: 'task_data',
      ttl: 1800, // 30 minutes
      invalidationPattern: 'task:*',
      compressionEnabled: true
    });

    // Workflow templates - long TTL, low frequency
    this.addStrategy('workflow_template', {
      name: 'workflow_template',
      ttl: 7200, // 2 hours
      warmupInterval: 60 * 60 * 1000, // 1 hour
      invalidationPattern: 'workflow:template:*',
      compressionEnabled: true
    });

    // Analytics data - very long TTL, scheduled warmup
    this.addStrategy('analytics', {
      name: 'analytics',
      ttl: 14400, // 4 hours
      warmupInterval: 2 * 60 * 60 * 1000, // 2 hours
      compressionEnabled: true
    });

    // AI model results - long TTL, high frequency
    this.addStrategy('ai_inference', {
      name: 'ai_inference',
      ttl: 3600, // 1 hour
      compressionEnabled: true
    });
  }

  addStrategy(name: string, strategy: CacheStrategy): void {
    this.strategies.set(name, strategy);
    
    if (strategy.warmupInterval && strategy.warmupFunction) {
      this.scheduleWarmup(name, strategy);
    }

    logger.info(`Added cache strategy: ${name}`, { strategy });
  }

  private scheduleWarmup(name: string, strategy: CacheStrategy): void {
    if (strategy.warmupInterval && strategy.warmupFunction) {
      const timer = setInterval(async () => {
        try {
          await strategy.warmupFunction!();
          metrics.incrementCounter('cache_warmup_success_total', 1, { strategy: name });
        } catch (error) {
          logger.error(`Cache warmup failed for strategy: ${name}`, error);
          metrics.incrementCounter('cache_warmup_error_total', 1, { strategy: name });
        }
      }, strategy.warmupInterval);

      this.warmupTimers.set(name, timer);
    }
  }

  async get<T = any>(key: string, strategyName?: string): Promise<T | null> {
    const timer = metrics.startTimer('cache_operation_duration_ms', { 
      operation: 'get',
      strategy: strategyName || 'default'
    });

    try {
      const value = await this.cache.get<T>(key);
      
      if (value !== null) {
        metrics.incrementCounter('cache_hits_total', 1, { 
          strategy: strategyName || 'default'
        });
      } else {
        metrics.incrementCounter('cache_misses_total', 1, { 
          strategy: strategyName || 'default'
        });
      }

      return value;
    } catch (error) {
      logger.error('Cache get operation failed', error, { key, strategyName });
      metrics.incrementCounter('cache_errors_total', 1, { 
        operation: 'get',
        strategy: strategyName || 'default'
      });
      return null;
    } finally {
      timer.end();
    }
  }

  async set(key: string, value: any, strategyName?: string): Promise<boolean> {
    const timer = metrics.startTimer('cache_operation_duration_ms', { 
      operation: 'set',
      strategy: strategyName || 'default'
    });

    try {
      const strategy = strategyName ? this.strategies.get(strategyName) : null;
      const ttl = strategy?.ttl || 3600;

      let processedValue = value;
      
      // Apply compression if enabled
      if (strategy?.compressionEnabled) {
        processedValue = await this.compressValue(value);
      }

      const success = await this.cache.set(key, processedValue, ttl);
      
      if (success) {
        metrics.incrementCounter('cache_sets_total', 1, { 
          strategy: strategyName || 'default'
        });
      }

      return success;
    } catch (error) {
      logger.error('Cache set operation failed', error, { key, strategyName });
      metrics.incrementCounter('cache_errors_total', 1, { 
        operation: 'set',
        strategy: strategyName || 'default'
      });
      return false;
    } finally {
      timer.end();
    }
  }

  async getOrSet<T = any>(
    key: string, 
    loader: () => Promise<T>, 
    strategyName?: string
  ): Promise<T | null> {
    // Try to get from cache first
    let value = await this.get<T>(key, strategyName);
    
    if (value !== null) {
      return value;
    }

    // Cache miss - load data and cache it
    try {
      value = await loader();
      await this.set(key, value, strategyName);
      
      metrics.incrementCounter('cache_load_and_set_total', 1, { 
        strategy: strategyName || 'default'
      });
      
      return value;
    } catch (error) {
      logger.error('Failed to load and cache data', error, { key, strategyName });
      return null;
    }
  }

  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await this.cache.keys(pattern);
      let deletedCount = 0;

      for (const key of keys) {
        const success = await this.cache.del(key);
        if (success) deletedCount++;
      }

      metrics.incrementCounter('cache_invalidations_total', deletedCount, { 
        pattern 
      });

      logger.info(`Invalidated ${deletedCount} cache entries`, { pattern });
      return deletedCount;
    } catch (error) {
      logger.error('Cache invalidation failed', error, { pattern });
      return 0;
    }
  }

  async invalidateByStrategy(strategyName: string): Promise<number> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy?.invalidationPattern) {
      logger.warn(`No invalidation pattern for strategy: ${strategyName}`);
      return 0;
    }

    return await this.invalidate(strategy.invalidationPattern);
  }

  // Cache warming functionality
  addWarmupConfig(config: CacheWarmupConfig): void {
    this.warmupConfigs.set(config.key, config);
    logger.info(`Added cache warmup config: ${config.key}`, { config });
  }

  async warmupCache(key?: string): Promise<void> {
    const configs = key 
      ? [this.warmupConfigs.get(key)].filter(Boolean) as CacheWarmupConfig[]
      : Array.from(this.warmupConfigs.values());

    // Sort by priority (higher priority first)
    configs.sort((a, b) => b.priority - a.priority);

    for (const config of configs) {
      try {
        const timer = metrics.startTimer('cache_warmup_duration_ms', { 
          key: config.key 
        });

        const data = await config.dataLoader();
        await this.set(config.key, data);

        timer.end();
        metrics.incrementCounter('cache_warmup_success_total', 1, { 
          key: config.key 
        });

        logger.debug(`Cache warmed up: ${config.key}`);
      } catch (error) {
        logger.error(`Cache warmup failed: ${config.key}`, error);
        metrics.incrementCounter('cache_warmup_error_total', 1, { 
          key: config.key 
        });
      }
    }
  }

  private async compressValue(value: any): Promise<string> {
    // Simple JSON compression - in production, use proper compression library
    const jsonString = JSON.stringify(value);
    
    // Simulate compression by removing whitespace and using shorter keys
    const compressed = jsonString
      .replace(/\s+/g, '')
      .replace(/"([^"]+)":/g, (match, key) => {
        // Create shorter keys for common fields
        const shortKeys: Record<string, string> = {
          'id': 'i',
          'name': 'n',
          'type': 't',
          'status': 's',
          'createdAt': 'c',
          'updatedAt': 'u'
        };
        return `"${shortKeys[key] || key}":`;
      });

    return compressed;
  }

  private async decompressValue(compressed: string): Promise<any> {
    // Reverse the compression process
    const expanded = compressed.replace(/"([^"]+)":/g, (match, key) => {
      const longKeys: Record<string, string> = {
        'i': 'id',
        'n': 'name',
        't': 'type',
        's': 'status',
        'c': 'createdAt',
        'u': 'updatedAt'
      };
      return `"${longKeys[key] || key}":`;
    });

    return JSON.parse(expanded);
  }

  private startCacheMonitoring(): void {
    // Monitor cache performance every minute
    setInterval(async () => {
      await this.collectCacheMetrics();
    }, 60 * 1000);

    // Cleanup expired entries every 5 minutes
    setInterval(async () => {
      await this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private async collectCacheMetrics(): Promise<void> {
    try {
      const cacheSize = await this.cache.size();
      metrics.setGauge('cache_size_total', cacheSize);

      // Calculate hit rate for each strategy
      for (const [strategyName] of this.strategies) {
        // These would be calculated from the metrics collected above
        // For now, we'll just record the current cache size per strategy
        const strategyKeys = await this.cache.keys(`*${strategyName}*`);
        metrics.setGauge('cache_strategy_size', strategyKeys.length, { 
          strategy: strategyName 
        });
      }
    } catch (error) {
      logger.error('Failed to collect cache metrics', error);
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    try {
      // This would typically be handled by Redis automatically,
      // but we can implement additional cleanup logic here
      const allKeys = await this.cache.keys('*');
      let cleanedCount = 0;

      for (const key of allKeys) {
        const ttl = await this.cache.ttl(key);
        if (ttl === -2) { // Key doesn't exist
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        metrics.incrementCounter('cache_cleanup_total', cleanedCount);
        logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      logger.error('Cache cleanup failed', error);
    }
  }

  getCacheStats(): Record<string, any> {
    return {
      strategies: Array.from(this.strategies.entries()).map(([name, strategy]) => ({
        name,
        ...strategy
      })),
      warmupConfigs: Array.from(this.warmupConfigs.entries()).map(([key, config]) => ({
        key,
        ...config
      })),
      activeTimers: this.warmupTimers.size
    };
  }

  async shutdown(): Promise<void> {
    // Clear all warmup timers
    for (const timer of this.warmupTimers.values()) {
      clearInterval(timer);
    }
    this.warmupTimers.clear();

    logger.info('Cache manager shutdown complete');
  }
}