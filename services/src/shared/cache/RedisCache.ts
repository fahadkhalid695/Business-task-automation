import Redis from 'redis';
import { Logger } from '../utils/logger';

const logger = new Logger('RedisCache');

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class RedisCache {
  private redis: Redis.RedisClientType;
  private defaultTTL: number;
  private keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || 3600; // 1 hour default
    this.keyPrefix = options.prefix || 'cache:';
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await this.redis.connect();
      logger.info('Redis cache initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis cache', error);
      throw error;
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.getKey(key));
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Failed to get cache value', error, { key });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      const cacheKey = this.getKey(key);
      const expiration = ttl || this.defaultTTL;

      await this.redis.setEx(cacheKey, expiration, serializedValue);
      return true;
    } catch (error) {
      logger.error('Failed to set cache value', error, { key });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(this.getKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Failed to delete cache value', error, { key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Failed to check cache existence', error, { key });
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(this.getKey(key), ttl);
      return result;
    } catch (error) {
      logger.error('Failed to set cache expiration', error, { key, ttl });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.getKey(key));
    } catch (error) {
      logger.error('Failed to get cache TTL', error, { key });
      return -1;
    }
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.getKey(key));
      const values = await this.redis.mGet(cacheKeys);
      
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Failed to get multiple cache values', error, { keys });
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.multi();
      
      for (const { key, value, ttl } of keyValuePairs) {
        const serializedValue = JSON.stringify(value);
        const cacheKey = this.getKey(key);
        const expiration = ttl || this.defaultTTL;
        
        pipeline.setEx(cacheKey, expiration, serializedValue);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Failed to set multiple cache values', error);
      return false;
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrBy(this.getKey(key), amount);
    } catch (error) {
      logger.error('Failed to increment cache value', error, { key, amount });
      throw error;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.decrBy(this.getKey(key), amount);
    } catch (error) {
      logger.error('Failed to decrement cache value', error, { key, amount });
      throw error;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.redis.flushDb();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Failed to flush cache', error);
      return false;
    }
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      // Remove prefix from returned keys
      return keys.map(key => key.substring(this.keyPrefix.length));
    } catch (error) {
      logger.error('Failed to get cache keys', error, { pattern });
      return [];
    }
  }


async size(): Promise<number> {
  try {
    const keys = await this.keys();
    return keys.length;
  } catch (error) {
    logger.error('Failed to get cache size', error);
    return 0;  // Returning a default value on error (optional)
  }
}
}
