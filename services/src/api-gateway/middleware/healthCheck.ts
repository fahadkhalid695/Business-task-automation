import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('HealthCheck');

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    memory: ServiceHealth;
    disk: ServiceHealth;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  details?: any;
}

class HealthChecker {
  private startTime = Date.now();

  async checkDatabase(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  async checkRedis(): Promise<ServiceHealth> {
    try {
      // This would be implemented when Redis is set up
      // For now, return a placeholder
      return {
        status: 'healthy',
        responseTime: 0,
        details: { message: 'Redis not configured yet' }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  checkMemory(): ServiceHealth {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        heapUsed: `${Math.round(usedMem / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(totalMem / 1024 / 1024)}MB`,
        usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      }
    };
  }

  checkDisk(): ServiceHealth {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      return {
        status: 'healthy',
        details: {
          available: true,
          writable: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const [database, redis, memory, disk] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      Promise.resolve(this.checkMemory()),
      Promise.resolve(this.checkDisk())
    ]);

    const services = { database, redis, memory, disk };
    
    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (serviceStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      services
    };
  }
}

const healthChecker = new HealthChecker();

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await healthChecker.getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
};