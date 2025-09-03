import Redis from 'redis';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

const logger = new Logger('RedisQueue');

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueOptions {
  maxConcurrency?: number;
  defaultJobOptions?: {
    maxAttempts?: number;
    delay?: number;
    priority?: number;
  };
}

export class RedisQueue extends EventEmitter {
  private redis: Redis.RedisClientType;
  private subscriber: Redis.RedisClientType;
  private queueName: string;
  private processingJobs = new Map<string, QueueJob>();
  private processors = new Map<string, (job: QueueJob) => Promise<any>>();
  private isProcessing = false;
  private maxConcurrency: number;
  private defaultJobOptions: Required<NonNullable<QueueOptions['defaultJobOptions']>>;

  constructor(queueName: string, options: QueueOptions = {}) {
    super();
    this.queueName = queueName;
    this.maxConcurrency = options.maxConcurrency || 10;
    this.defaultJobOptions = {
      maxAttempts: 3,
      delay: 0,
      priority: 0,
      ...options.defaultJobOptions
    };

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.subscriber = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await this.redis.connect();
      await this.subscriber.connect();

      // Subscribe to job notifications
      await this.subscriber.subscribe(`${this.queueName}:jobs`, (message) => {
        this.processJobs();
      });

      logger.info(`Redis queue initialized: ${this.queueName}`);
    } catch (error) {
      logger.error('Failed to initialize Redis queue', error);
      throw error;
    }
  }

  async add(type: string, data: any, options: Partial<QueueJob> = {}): Promise<string> {
    const jobId = `${this.queueName}:${Date.now()}:${Math.random().toString(36).substring(2)}`;
    
    const job: QueueJob = {
      id: jobId,
      type,
      data,
      priority: options.priority || this.defaultJobOptions.priority,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.defaultJobOptions.maxAttempts,
      delay: options.delay || this.defaultJobOptions.delay,
      createdAt: new Date(),
      ...options
    };

    try {
      // Store job data
      await this.redis.hSet(`${this.queueName}:job:${jobId}`, {
        data: JSON.stringify(job)
      });

      // Add to appropriate queue based on delay and priority
      if (job.delay && job.delay > 0) {
        const executeAt = Date.now() + job.delay;
        await this.redis.zAdd(`${this.queueName}:delayed`, {
          score: executeAt,
          value: jobId
        });
      } else {
        await this.redis.zAdd(`${this.queueName}:waiting`, {
          score: job.priority,
          value: jobId
        });
      }

      // Notify processors
      await this.redis.publish(`${this.queueName}:jobs`, 'new');

      logger.info('Job added to queue', { jobId, type, priority: job.priority });
      this.emit('job:added', job);

      return jobId;
    } catch (error) {
      logger.error('Failed to add job to queue', error, { jobId, type });
      throw error;
    }
  }

  process(type: string, processor: (job: QueueJob) => Promise<any>): void {
    this.processors.set(type, processor);
    logger.info(`Processor registered for job type: ${type}`);
    
    // Start processing if not already started
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  private startProcessing(): void {
    this.isProcessing = true;
    this.processJobs();
    
    // Process delayed jobs every 5 seconds
    setInterval(() => {
      this.processDelayedJobs();
    }, 5000);

    logger.info(`Queue processing started: ${this.queueName}`);
  }

  private async processJobs(): Promise<void> {
    if (this.processingJobs.size >= this.maxConcurrency) {
      return;
    }

    try {
      // Get next job from waiting queue (highest priority first)
      const result = await this.redis.zPopMax(`${this.queueName}:waiting`);
      
      if (!result) {
        return;
      }

      const jobId = result.value;
      const jobData = await this.redis.hGet(`${this.queueName}:job:${jobId}`, 'data');
      
      if (!jobData) {
        logger.warn('Job data not found', { jobId });
        return;
      }

      const job: QueueJob = JSON.parse(jobData);
      
      // Check if we have a processor for this job type
      const processor = this.processors.get(job.type);
      if (!processor) {
        logger.warn('No processor found for job type', { jobId, type: job.type });
        await this.moveToFailed(job, 'No processor found');
        return;
      }

      // Start processing
      this.processingJobs.set(jobId, job);
      this.processJob(job, processor);

      // Continue processing more jobs if we have capacity
      if (this.processingJobs.size < this.maxConcurrency) {
        setImmediate(() => this.processJobs());
      }
    } catch (error) {
      logger.error('Error in job processing loop', error);
    }
  }

  private async processJob(job: QueueJob, processor: (job: QueueJob) => Promise<any>): Promise<void> {
    const startTime = Date.now();
    job.processedAt = new Date();
    job.attempts++;

    try {
      logger.info('Processing job', { jobId: job.id, type: job.type, attempt: job.attempts });

      // Move to active queue
      await this.redis.zAdd(`${this.queueName}:active`, {
        score: Date.now(),
        value: job.id
      });

      // Process the job
      const result = await processor(job);

      // Job completed successfully
      job.completedAt = new Date();
      const duration = Date.now() - startTime;

      await this.moveToCompleted(job, result);
      
      logger.info('Job completed successfully', { 
        jobId: job.id, 
        type: job.type, 
        duration: `${duration}ms` 
      });

      this.emit('job:completed', { job, result, duration });

    } catch (error) {
      const duration = Date.now() - startTime;
      job.error = error instanceof Error ? error.message : String(error);

      logger.error('Job processing failed', error, { 
        jobId: job.id, 
        type: job.type, 
        attempt: job.attempts,
        duration: `${duration}ms`
      });

      if (job.attempts >= job.maxAttempts) {
        await this.moveToFailed(job, job.error);
        this.emit('job:failed', { job, error, duration });
      } else {
        await this.moveToRetry(job);
        this.emit('job:retry', { job, error, duration });
      }
    } finally {
      // Remove from processing and active queues
      this.processingJobs.delete(job.id);
      await this.redis.zRem(`${this.queueName}:active`, job.id);

      // Continue processing more jobs
      setImmediate(() => this.processJobs());
    }
  }

  private async processDelayedJobs(): Promise<void> {
    try {
      const now = Date.now();
      const delayedJobs = await this.redis.zRangeByScore(
        `${this.queueName}:delayed`,
        0,
        now
      );

      for (const jobId of delayedJobs) {
        // Move from delayed to waiting queue
        const jobData = await this.redis.hGet(`${this.queueName}:job:${jobId}`, 'data');
        if (jobData) {
          const job: QueueJob = JSON.parse(jobData);
          
          await this.redis.zRem(`${this.queueName}:delayed`, jobId);
          await this.redis.zAdd(`${this.queueName}:waiting`, {
            score: job.priority,
            value: jobId
          });

          logger.info('Moved delayed job to waiting queue', { jobId });
        }
      }

      if (delayedJobs.length > 0) {
        await this.redis.publish(`${this.queueName}:jobs`, 'delayed');
      }
    } catch (error) {
      logger.error('Error processing delayed jobs', error);
    }
  }

  private async moveToCompleted(job: QueueJob, result: any): Promise<void> {
    const completedData = {
      ...job,
      result: JSON.stringify(result)
    };

    await Promise.all([
      this.redis.hSet(`${this.queueName}:job:${job.id}`, {
        data: JSON.stringify(completedData)
      }),
      this.redis.zAdd(`${this.queueName}:completed`, {
        score: Date.now(),
        value: job.id
      })
    ]);

    // Clean up old completed jobs (keep last 1000)
    await this.redis.zRemRangeByRank(`${this.queueName}:completed`, 0, -1001);
  }

  private async moveToFailed(job: QueueJob, error: string): Promise<void> {
    job.failedAt = new Date();
    job.error = error;

    await Promise.all([
      this.redis.hSet(`${this.queueName}:job:${job.id}`, {
        data: JSON.stringify(job)
      }),
      this.redis.zAdd(`${this.queueName}:failed`, {
        score: Date.now(),
        value: job.id
      })
    ]);

    // Clean up old failed jobs (keep last 500)
    await this.redis.zRemRangeByRank(`${this.queueName}:failed`, 0, -501);
  }

  private async moveToRetry(job: QueueJob): Promise<void> {
    // Exponential backoff: 2^attempt seconds
    const delay = Math.pow(2, job.attempts) * 1000;
    const executeAt = Date.now() + delay;

    await this.redis.zAdd(`${this.queueName}:delayed`, {
      score: executeAt,
      value: job.id
    });

    logger.info('Job scheduled for retry', { 
      jobId: job.id, 
      attempt: job.attempts, 
      delay: `${delay}ms` 
    });
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.redis.zCard(`${this.queueName}:waiting`),
      this.redis.zCard(`${this.queueName}:active`),
      this.redis.zCard(`${this.queueName}:completed`),
      this.redis.zCard(`${this.queueName}:failed`),
      this.redis.zCard(`${this.queueName}:delayed`)
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    try {
      const jobData = await this.redis.hGet(`${this.queueName}:job:${jobId}`, 'data');
      return jobData ? JSON.parse(jobData) : null;
    } catch (error) {
      logger.error('Failed to get job', error, { jobId });
      return null;
    }
  }

  async removeJob(jobId: string): Promise<boolean> {
    try {
      const [waiting, delayed, active, completed, failed] = await Promise.all([
        this.redis.zRem(`${this.queueName}:waiting`, jobId),
        this.redis.zRem(`${this.queueName}:delayed`, jobId),
        this.redis.zRem(`${this.queueName}:active`, jobId),
        this.redis.zRem(`${this.queueName}:completed`, jobId),
        this.redis.zRem(`${this.queueName}:failed`, jobId)
      ]);

      await this.redis.hDel(`${this.queueName}:job:${jobId}`, 'data');

      const removed = waiting || delayed || active || completed || failed;
      if (removed) {
        logger.info('Job removed from queue', { jobId });
      }

      return !!removed;
    } catch (error) {
      logger.error('Failed to remove job', error, { jobId });
      return false;
    }
  }

  async close(): Promise<void> {
    this.isProcessing = false;
    await this.redis.quit();
    await this.subscriber.quit();
    logger.info(`Queue closed: ${this.queueName}`);
  }
}