import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

const logger = new Logger('ResourceManager');
const metrics = MetricsCollector.getInstance();

export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
  maxRetries: number;
}

export interface Resource {
  id: string;
  createdAt: Date;
  lastUsed: Date;
  inUse: boolean;
  isValid: boolean;
  metadata?: Record<string, any>;
}

export interface ResourceFactory<T extends Resource> {
  create(): Promise<T>;
  destroy(resource: T): Promise<void>;
  validate(resource: T): Promise<boolean>;
  reset?(resource: T): Promise<void>;
}

export class ResourcePool<T extends Resource> {
  private resources: T[] = [];
  private waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private config: PoolConfig;
  private factory: ResourceFactory<T>;
  private poolName: string;
  private reapTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(poolName: string, factory: ResourceFactory<T>, config: Partial<PoolConfig> = {}) {
    this.poolName = poolName;
    this.factory = factory;
    this.config = {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 300000, // 5 minutes
      reapIntervalMillis: 60000, // 1 minute
      createRetryIntervalMillis: 1000,
      maxRetries: 3,
      ...config
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Create minimum number of resources
      const createPromises = Array(this.config.min).fill(null).map(() => this.createResource());
      await Promise.all(createPromises);

      // Start reaper for idle resources
      this.startReaper();

      logger.info(`Resource pool initialized: ${this.poolName}`, {
        minResources: this.config.min,
        maxResources: this.config.max
      });

      metrics.setGauge('resource_pool_size', this.resources.length, {
        pool: this.poolName,
        type: 'total'
      });
    } catch (error) {
      logger.error(`Failed to initialize resource pool: ${this.poolName}`, error);
      throw error;
    }
  }

  async acquire(): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error(`Resource pool ${this.poolName} is shutting down`);
    }

    const timer = metrics.startTimer('resource_pool_acquire_duration_ms', {
      pool: this.poolName
    });

    try {
      // Try to get an available resource
      const availableResource = this.getAvailableResource();
      if (availableResource) {
        availableResource.inUse = true;
        availableResource.lastUsed = new Date();
        
        metrics.incrementCounter('resource_pool_acquired_total', 1, {
          pool: this.poolName,
          source: 'existing'
        });

        return availableResource;
      }

      // No available resources, try to create a new one if under limit
      if (this.resources.length < this.config.max) {
        try {
          const newResource = await this.createResource();
          newResource.inUse = true;
          newResource.lastUsed = new Date();
          
          metrics.incrementCounter('resource_pool_acquired_total', 1, {
            pool: this.poolName,
            source: 'created'
          });

          return newResource;
        } catch (error) {
          logger.warn(`Failed to create new resource for pool: ${this.poolName}`, error);
        }
      }

      // Wait for a resource to become available
      return await this.waitForResource();
    } catch (error) {
      metrics.incrementCounter('resource_pool_acquire_errors_total', 1, {
        pool: this.poolName
      });
      throw error;
    } finally {
      timer.end();
    }
  }

  async release(resource: T): Promise<void> {
    const timer = metrics.startTimer('resource_pool_release_duration_ms', {
      pool: this.poolName
    });

    try {
      if (!resource.inUse) {
        logger.warn(`Attempting to release resource that is not in use: ${resource.id}`);
        return;
      }

      // Reset resource if factory provides reset method
      if (this.factory.reset) {
        try {
          await this.factory.reset(resource);
        } catch (error) {
          logger.warn(`Failed to reset resource ${resource.id}`, error);
          // Mark as invalid so it gets destroyed
          resource.isValid = false;
        }
      }

      resource.inUse = false;
      resource.lastUsed = new Date();

      // If resource is invalid, destroy it
      if (!resource.isValid) {
        await this.destroyResource(resource);
        
        // Create a new resource if we're below minimum
        if (this.resources.length < this.config.min && !this.isShuttingDown) {
          this.createResource().catch(error => {
            logger.error(`Failed to create replacement resource for pool: ${this.poolName}`, error);
          });
        }
      } else {
        // Check if anyone is waiting for a resource
        const waiter = this.waitingQueue.shift();
        if (waiter) {
          resource.inUse = true;
          resource.lastUsed = new Date();
          waiter.resolve(resource);
          return;
        }
      }

      metrics.incrementCounter('resource_pool_released_total', 1, {
        pool: this.poolName
      });
    } catch (error) {
      logger.error(`Error releasing resource ${resource.id}`, error);
      metrics.incrementCounter('resource_pool_release_errors_total', 1, {
        pool: this.poolName
      });
    } finally {
      timer.end();
    }
  }

  private getAvailableResource(): T | null {
    return this.resources.find(resource => 
      !resource.inUse && resource.isValid
    ) || null;
  }

  private async createResource(): Promise<T> {
    const timer = metrics.startTimer('resource_pool_create_duration_ms', {
      pool: this.poolName
    });

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.maxRetries) {
      try {
        const createPromise = this.factory.create();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Resource creation timeout')), this.config.createTimeoutMillis);
        });

        const resource = await Promise.race([createPromise, timeoutPromise]);
        resource.createdAt = new Date();
        resource.lastUsed = new Date();
        resource.inUse = false;
        resource.isValid = true;

        this.resources.push(resource);

        metrics.incrementCounter('resource_pool_created_total', 1, {
          pool: this.poolName
        });

        metrics.setGauge('resource_pool_size', this.resources.length, {
          pool: this.poolName,
          type: 'total'
        });

        logger.debug(`Created resource ${resource.id} for pool: ${this.poolName}`);
        return resource;
      } catch (error) {
        lastError = error as Error;
        attempts++;
        
        if (attempts < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.config.createRetryIntervalMillis));
        }
      } finally {
        timer.end();
      }
    }

    metrics.incrementCounter('resource_pool_create_errors_total', 1, {
      pool: this.poolName
    });

    throw new Error(`Failed to create resource after ${this.config.maxRetries} attempts: ${lastError?.message}`);
  }

  private async destroyResource(resource: T): Promise<void> {
    const timer = metrics.startTimer('resource_pool_destroy_duration_ms', {
      pool: this.poolName
    });

    try {
      const destroyPromise = this.factory.destroy(resource);
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Resource destruction timeout')), this.config.destroyTimeoutMillis);
      });

      await Promise.race([destroyPromise, timeoutPromise]);

      // Remove from resources array
      const index = this.resources.indexOf(resource);
      if (index > -1) {
        this.resources.splice(index, 1);
      }

      metrics.incrementCounter('resource_pool_destroyed_total', 1, {
        pool: this.poolName
      });

      metrics.setGauge('resource_pool_size', this.resources.length, {
        pool: this.poolName,
        type: 'total'
      });

      logger.debug(`Destroyed resource ${resource.id} from pool: ${this.poolName}`);
    } catch (error) {
      logger.error(`Failed to destroy resource ${resource.id}`, error);
      metrics.incrementCounter('resource_pool_destroy_errors_total', 1, {
        pool: this.poolName
      });
    } finally {
      timer.end();
    }
  }

  private async waitForResource(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from waiting queue
        const index = this.waitingQueue.findIndex(waiter => waiter.resolve === resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        
        metrics.incrementCounter('resource_pool_acquire_timeouts_total', 1, {
          pool: this.poolName
        });

        reject(new Error(`Resource acquisition timeout for pool: ${this.poolName}`));
      }, this.config.acquireTimeoutMillis);

      this.waitingQueue.push({
        resolve: (resource: T) => {
          clearTimeout(timeout);
          resolve(resource);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: new Date()
      });

      metrics.setGauge('resource_pool_waiting_count', this.waitingQueue.length, {
        pool: this.poolName
      });
    });
  }

  private startReaper(): void {
    this.reapTimer = setInterval(async () => {
      await this.reapIdleResources();
    }, this.config.reapIntervalMillis);
  }

  private async reapIdleResources(): Promise<void> {
    const now = new Date();
    const idleThreshold = new Date(now.getTime() - this.config.idleTimeoutMillis);
    
    const idleResources = this.resources.filter(resource => 
      !resource.inUse && 
      resource.lastUsed < idleThreshold &&
      this.resources.length > this.config.min
    );

    for (const resource of idleResources) {
      try {
        // Validate resource before deciding to keep it
        const isValid = await this.factory.validate(resource);
        if (!isValid) {
          resource.isValid = false;
          await this.destroyResource(resource);
        } else if (this.resources.length > this.config.min) {
          // Destroy idle resource if we have more than minimum
          await this.destroyResource(resource);
        }
      } catch (error) {
        logger.error(`Error during resource reaping for ${resource.id}`, error);
      }
    }

    // Update metrics
    const availableCount = this.resources.filter(r => !r.inUse && r.isValid).length;
    const inUseCount = this.resources.filter(r => r.inUse).length;

    metrics.setGauge('resource_pool_size', availableCount, {
      pool: this.poolName,
      type: 'available'
    });

    metrics.setGauge('resource_pool_size', inUseCount, {
      pool: this.poolName,
      type: 'in_use'
    });
  }

  getStats(): Record<string, any> {
    const availableCount = this.resources.filter(r => !r.inUse && r.isValid).length;
    const inUseCount = this.resources.filter(r => r.inUse).length;
    const invalidCount = this.resources.filter(r => !r.isValid).length;

    return {
      poolName: this.poolName,
      config: this.config,
      totalResources: this.resources.length,
      availableResources: availableCount,
      inUseResources: inUseCount,
      invalidResources: invalidCount,
      waitingCount: this.waitingQueue.length,
      oldestWaiting: this.waitingQueue.length > 0 ? this.waitingQueue[0].timestamp : null
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear reaper timer
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      waiter.reject(new Error(`Resource pool ${this.poolName} is shutting down`));
    }
    this.waitingQueue.length = 0;

    // Destroy all resources
    const destroyPromises = this.resources.map(resource => 
      this.destroyResource(resource).catch(error => {
        logger.error(`Error destroying resource during shutdown: ${resource.id}`, error);
      })
    );

    await Promise.allSettled(destroyPromises);

    logger.info(`Resource pool shutdown complete: ${this.poolName}`);
  }
}

// Database connection pool implementation
export interface DatabaseConnection extends Resource {
  connection: any; // Database-specific connection object
  database: string;
}

export class DatabaseConnectionFactory implements ResourceFactory<DatabaseConnection> {
  private connectionString: string;
  private database: string;

  constructor(connectionString: string, database: string) {
    this.connectionString = connectionString;
    this.database = database;
  }

  async create(): Promise<DatabaseConnection> {
    // This would create an actual database connection
    // For now, we'll simulate it
    const connection = {
      id: `db_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastUsed: new Date(),
      inUse: false,
      isValid: true,
      connection: { /* simulated connection object */ },
      database: this.database
    };

    logger.debug(`Created database connection: ${connection.id}`);
    return connection;
  }

  async destroy(resource: DatabaseConnection): Promise<void> {
    // Close the actual database connection
    logger.debug(`Destroying database connection: ${resource.id}`);
    // resource.connection.close();
  }

  async validate(resource: DatabaseConnection): Promise<boolean> {
    try {
      // Perform a simple query to validate the connection
      // For now, we'll simulate validation
      return resource.isValid && (Date.now() - resource.createdAt.getTime()) < 3600000; // 1 hour max age
    } catch (error) {
      return false;
    }
  }

  async reset(resource: DatabaseConnection): Promise<void> {
    // Reset connection state (rollback transactions, clear temp tables, etc.)
    logger.debug(`Resetting database connection: ${resource.id}`);
  }
}

// HTTP connection pool implementation
export interface HttpConnection extends Resource {
  agent: any; // HTTP agent
  baseUrl: string;
}

export class HttpConnectionFactory implements ResourceFactory<HttpConnection> {
  private baseUrl: string;
  private options: any;

  constructor(baseUrl: string, options: any = {}) {
    this.baseUrl = baseUrl;
    this.options = options;
  }

  async create(): Promise<HttpConnection> {
    const connection: HttpConnection = {
      id: `http_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastUsed: new Date(),
      inUse: false,
      isValid: true,
      agent: { /* HTTP agent */ },
      baseUrl: this.baseUrl
    };

    logger.debug(`Created HTTP connection: ${connection.id}`);
    return connection;
  }

  async destroy(resource: HttpConnection): Promise<void> {
    logger.debug(`Destroying HTTP connection: ${resource.id}`);
    // resource.agent.destroy();
  }

  async validate(resource: HttpConnection): Promise<boolean> {
    try {
      // Validate connection by making a simple request
      return resource.isValid;
    } catch (error) {
      return false;
    }
  }
}

// Resource manager to coordinate multiple pools
export class ResourceManager {
  private static instance: ResourceManager;
  private pools: Map<string, ResourcePool<any>> = new Map();

  private constructor() {}

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  createPool<T extends Resource>(
    name: string,
    factory: ResourceFactory<T>,
    config?: Partial<PoolConfig>
  ): ResourcePool<T> {
    if (this.pools.has(name)) {
      throw new Error(`Resource pool with name ${name} already exists`);
    }

    const pool = new ResourcePool(name, factory, config);
    this.pools.set(name, pool);

    logger.info(`Created resource pool: ${name}`);
    return pool;
  }

  getPool<T extends Resource>(name: string): ResourcePool<T> | null {
    return this.pools.get(name) || null;
  }

  getAllPoolStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStats();
    }

    return stats;
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.pools.values()).map(pool => 
      pool.shutdown().catch(error => {
        logger.error(`Error shutting down pool`, error);
      })
    );

    await Promise.allSettled(shutdownPromises);
    this.pools.clear();

    logger.info('Resource manager shutdown complete');
  }
}