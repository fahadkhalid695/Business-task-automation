import { EventEmitter } from 'events';
import { 
  IntegrationAdapter, 
  HealthStatus, 
  HealthDetails,
  IntegrationEventType 
} from './types/IntegrationTypes';
import { logger } from '../shared/utils/logger';

/**
 * IntegrationHealthMonitor - Monitors health and performance of integrations
 */
export class IntegrationHealthMonitor extends EventEmitter {
  private monitoringIntervals: Map<string, NodeJS.Timeout>;
  private healthStatuses: Map<string, HealthStatus>;
  private adapters: Map<string, IntegrationAdapter>;
  private monitoringConfig: {
    checkInterval: number;
    unhealthyThreshold: number;
    degradedThreshold: number;
    maxConsecutiveFailures: number;
  };

  constructor() {
    super();
    this.monitoringIntervals = new Map();
    this.healthStatuses = new Map();
    this.adapters = new Map();
    
    this.monitoringConfig = {
      checkInterval: 60000, // 1 minute
      unhealthyThreshold: 5000, // 5 seconds response time
      degradedThreshold: 2000, // 2 seconds response time
      maxConsecutiveFailures: 3
    };
    
    logger.info('IntegrationHealthMonitor initialized');
  }

  /**
   * Start monitoring an integration
   */
  startMonitoring(integrationId: string, adapter: IntegrationAdapter): void {
    try {
      logger.info(`Starting health monitoring for integration ${integrationId}`);
      
      // Store adapter reference
      this.adapters.set(integrationId, adapter);
      
      // Initialize health status
      this.healthStatuses.set(integrationId, {
        status: 'healthy',
        lastCheck: new Date(),
        errorRate: 0,
        uptime: 100,
        details: {
          consecutiveFailures: 0
        }
      });

      // Start periodic health checks
      const interval = setInterval(async () => {
        await this.performHealthCheck(integrationId);
      }, this.monitoringConfig.checkInterval);

      this.monitoringIntervals.set(integrationId, interval);
      
      // Perform initial health check
      this.performHealthCheck(integrationId);
      
      logger.info(`Health monitoring started for integration ${integrationId}`);
      
    } catch (error) {
      logger.error(`Failed to start monitoring for integration ${integrationId}`, {
        error: error.message
      });
    }
  }

  /**
   * Stop monitoring an integration
   */
  stopMonitoring(integrationId: string): void {
    try {
      logger.info(`Stopping health monitoring for integration ${integrationId}`);
      
      const interval = this.monitoringIntervals.get(integrationId);
      if (interval) {
        clearInterval(interval);
        this.monitoringIntervals.delete(integrationId);
      }

      this.adapters.delete(integrationId);
      this.healthStatuses.delete(integrationId);
      
      logger.info(`Health monitoring stopped for integration ${integrationId}`);
      
    } catch (error) {
      logger.error(`Failed to stop monitoring for integration ${integrationId}`, {
        error: error.message
      });
    }
  }

  /**
   * Perform health check for an integration
   */
  private async performHealthCheck(integrationId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const adapter = this.adapters.get(integrationId);
      if (!adapter) {
        logger.warn(`No adapter found for integration ${integrationId}`);
        return;
      }

      // Get current health status
      let currentStatus = this.healthStatuses.get(integrationId);
      if (!currentStatus) {
        currentStatus = {
          status: 'healthy',
          lastCheck: new Date(),
          errorRate: 0,
          uptime: 100,
          details: { consecutiveFailures: 0 }
        };
      }

      // Perform health check
      const adapterHealth = await adapter.getHealthStatus();
      const responseTime = Date.now() - startTime;

      // Update health status
      const updatedStatus = this.calculateHealthStatus(currentStatus, adapterHealth, responseTime);
      updatedStatus.lastCheck = new Date();
      updatedStatus.responseTime = responseTime;

      this.healthStatuses.set(integrationId, updatedStatus);

      // Emit health check event
      this.emit('health:checked', {
        integrationId,
        status: updatedStatus,
        responseTime
      });

      // Emit alerts if status changed
      if (currentStatus.status !== updatedStatus.status) {
        this.handleStatusChange(integrationId, currentStatus.status, updatedStatus.status);
      }

      // Log health check results
      if (updatedStatus.status !== 'healthy') {
        logger.warn(`Health check for integration ${integrationId}`, {
          status: updatedStatus.status,
          responseTime,
          errorRate: updatedStatus.errorRate,
          consecutiveFailures: updatedStatus.details?.consecutiveFailures
        });
      }

    } catch (error) {
      logger.error(`Health check failed for integration ${integrationId}`, {
        error: error.message,
        responseTime: Date.now() - startTime
      });

      // Update status to reflect failure
      this.recordHealthCheckFailure(integrationId, error.message);
    }
  }

  /**
   * Calculate overall health status based on various metrics
   */
  private calculateHealthStatus(
    currentStatus: HealthStatus,
    adapterHealth: HealthStatus,
    responseTime: number
  ): HealthStatus {
    const details: HealthDetails = {
      ...currentStatus.details,
      ...adapterHealth.details
    };

    // Determine status based on response time and adapter health
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check response time thresholds
    if (responseTime > this.monitoringConfig.unhealthyThreshold) {
      status = 'unhealthy';
    } else if (responseTime > this.monitoringConfig.degradedThreshold) {
      status = 'degraded';
    }

    // Consider adapter-reported health
    if (adapterHealth.status === 'unhealthy') {
      status = 'unhealthy';
    } else if (adapterHealth.status === 'degraded' && status === 'healthy') {
      status = 'degraded';
    }

    // Consider consecutive failures
    if (details.consecutiveFailures >= this.monitoringConfig.maxConsecutiveFailures) {
      status = 'unhealthy';
    } else if (details.consecutiveFailures > 0 && status === 'healthy') {
      status = 'degraded';
    }

    // Reset consecutive failures on success
    if (status === 'healthy') {
      details.consecutiveFailures = 0;
    }

    // Calculate uptime (simplified - in production, this would be more sophisticated)
    const uptimePercentage = status === 'healthy' ? 
      Math.min(100, currentStatus.uptime + 0.1) : 
      Math.max(0, currentStatus.uptime - 1);

    return {
      status,
      lastCheck: new Date(),
      responseTime,
      errorRate: adapterHealth.errorRate || currentStatus.errorRate,
      uptime: uptimePercentage,
      details
    };
  }

  /**
   * Record health check failure
   */
  private recordHealthCheckFailure(integrationId: string, error: string): void {
    let currentStatus = this.healthStatuses.get(integrationId);
    if (!currentStatus) {
      currentStatus = {
        status: 'unhealthy',
        lastCheck: new Date(),
        errorRate: 100,
        uptime: 0,
        details: { consecutiveFailures: 1 }
      };
    } else {
      currentStatus.status = 'unhealthy';
      currentStatus.lastCheck = new Date();
      currentStatus.errorRate = Math.min(100, currentStatus.errorRate + 10);
      currentStatus.uptime = Math.max(0, currentStatus.uptime - 5);
      currentStatus.details = {
        ...currentStatus.details,
        consecutiveFailures: (currentStatus.details?.consecutiveFailures || 0) + 1
      };
    }

    this.healthStatuses.set(integrationId, currentStatus);

    // Emit failure event
    this.emit('health:failure', {
      integrationId,
      error,
      status: currentStatus
    });
  }

  /**
   * Handle status change events
   */
  private handleStatusChange(
    integrationId: string,
    oldStatus: string,
    newStatus: string
  ): void {
    logger.info(`Health status changed for integration ${integrationId}`, {
      from: oldStatus,
      to: newStatus
    });

    // Emit status change event
    this.emit('health:status_changed', {
      integrationId,
      oldStatus,
      newStatus,
      timestamp: new Date()
    });

    // Emit specific events based on new status
    switch (newStatus) {
      case 'unhealthy':
        this.emit('health:unhealthy', {
          integrationId,
          timestamp: new Date()
        });
        break;
      case 'degraded':
        this.emit('health:degraded', {
          integrationId,
          timestamp: new Date()
        });
        break;
      case 'healthy':
        this.emit('health:recovered', {
          integrationId,
          timestamp: new Date()
        });
        break;
    }
  }

  /**
   * Get health status for integration
   */
  async getStatus(integrationId: string): Promise<HealthStatus | null> {
    return this.healthStatuses.get(integrationId) || null;
  }

  /**
   * Get health status for all monitored integrations
   */
  getAllStatuses(): Map<string, HealthStatus> {
    return new Map(this.healthStatuses);
  }

  /**
   * Get unhealthy integrations
   */
  getUnhealthyIntegrations(): string[] {
    const unhealthy: string[] = [];
    
    for (const [integrationId, status] of this.healthStatuses) {
      if (status.status === 'unhealthy') {
        unhealthy.push(integrationId);
      }
    }
    
    return unhealthy;
  }

  /**
   * Get degraded integrations
   */
  getDegradedIntegrations(): string[] {
    const degraded: string[] = [];
    
    for (const [integrationId, status] of this.healthStatuses) {
      if (status.status === 'degraded') {
        degraded.push(integrationId);
      }
    }
    
    return degraded;
  }

  /**
   * Force health check for integration
   */
  async forceHealthCheck(integrationId: string): Promise<HealthStatus | null> {
    await this.performHealthCheck(integrationId);
    return this.getStatus(integrationId);
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<typeof this.monitoringConfig>): void {
    this.monitoringConfig = {
      ...this.monitoringConfig,
      ...config
    };
    
    logger.info('Health monitoring configuration updated', { config: this.monitoringConfig });
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    totalIntegrations: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    averageUptime: number;
    averageResponseTime: number;
  } {
    const statuses = Array.from(this.healthStatuses.values());
    
    const healthyCount = statuses.filter(s => s.status === 'healthy').length;
    const degradedCount = statuses.filter(s => s.status === 'degraded').length;
    const unhealthyCount = statuses.filter(s => s.status === 'unhealthy').length;
    
    const averageUptime = statuses.length > 0 ? 
      statuses.reduce((sum, s) => sum + s.uptime, 0) / statuses.length : 0;
    
    const responseTimes = statuses.filter(s => s.responseTime).map(s => s.responseTime!);
    const averageResponseTime = responseTimes.length > 0 ?
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length : 0;

    return {
      totalIntegrations: statuses.length,
      healthyCount,
      degradedCount,
      unhealthyCount,
      averageUptime,
      averageResponseTime
    };
  }
}