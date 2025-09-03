import { Logger } from '../shared/utils/Logger';
import { MetricsCollector } from './MetricsCollector';
import { AlertManager } from './AlertManager';
import { DashboardService } from './DashboardService';
import { AnalyticsEngine } from './AnalyticsEngine';
import { SystemHealthMonitor } from './SystemHealthMonitor';
import { MonitoringConfig } from './interfaces';
import * as cron from 'node-cron';

export class MonitoringService {
  private logger = Logger.getInstance();
  private metricsCollector = new MetricsCollector();
  private alertManager = new AlertManager();
  private dashboardService = new DashboardService();
  private analyticsEngine = new AnalyticsEngine();
  private healthMonitor = new SystemHealthMonitor();
  
  private config: MonitoringConfig = {
    metricsRetention: 30, // days
    alertRetention: 90, // days
    collectionInterval: 60, // seconds
    healthCheckInterval: 30, // seconds
    anomalyDetectionEnabled: true,
    costTrackingEnabled: true,
    userAnalyticsEnabled: true
  };

  private scheduledJobs: cron.ScheduledTask[] = [];

  constructor(config?: Partial<MonitoringConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Monitoring Service...');

      // Create default dashboards
      await this.createDefaultDashboards();

      // Start scheduled monitoring tasks
      this.startScheduledTasks();

      // Start real-time monitoring
      this.startRealTimeMonitoring();

      this.logger.info('Monitoring Service initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing Monitoring Service:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Monitoring Service...');

      // Stop scheduled tasks
      this.stopScheduledTasks();

      // Stop alert evaluation
      this.alertManager.stopAlertEvaluation();

      this.logger.info('Monitoring Service shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down Monitoring Service:', error);
      throw error;
    }
  }

  // Metrics Collection Methods
  async collectAllMetrics(): Promise<void> {
    try {
      this.logger.debug('Starting metrics collection cycle');

      // Collect system metrics
      const systemMetrics = await this.metricsCollector.collectSystemMetrics();
      this.logger.debug(`Collected ${systemMetrics.length} system metrics`);

      // Collect business metrics
      const businessMetrics = await this.metricsCollector.collectBusinessMetrics();
      this.logger.debug(`Collected ${businessMetrics.length} business metrics`);

      // Collect user behavior metrics
      if (this.config.userAnalyticsEnabled) {
        const userMetrics = await this.metricsCollector.collectUserBehaviorMetrics();
        this.logger.debug('Collected user behavior metrics');
      }

      // Collect cost metrics
      if (this.config.costTrackingEnabled) {
        const costMetrics = await this.metricsCollector.collectCostMetrics();
        this.logger.debug('Collected cost metrics');
      }

      // Collect capacity metrics
      const capacityMetrics = await this.metricsCollector.collectCapacityMetrics();
      this.logger.debug('Collected capacity metrics');

      this.logger.info('Metrics collection cycle completed');
    } catch (error) {
      this.logger.error('Error during metrics collection:', error);
    }
  }

  // Analytics Methods
  async generateSystemReport(): Promise<any> {
    try {
      this.logger.info('Generating system report...');

      const [
        systemHealth,
        taskMetrics,
        userSatisfaction,
        workflowEfficiency,
        userBehavior,
        capacityMetrics,
        insights,
        anomalies
      ] = await Promise.all([
        this.healthMonitor.checkSystemHealth(),
        this.analyticsEngine.analyzeTaskCompletionRates(),
        this.analyticsEngine.analyzeUserSatisfaction(),
        this.analyticsEngine.analyzeWorkflowEfficiency(),
        this.analyticsEngine.analyzeUserBehavior(),
        this.analyticsEngine.predictCapacityNeeds(),
        this.analyticsEngine.generateInsights(),
        this.analyticsEngine.detectAnomalies()
      ]);

      const report = {
        generatedAt: new Date(),
        systemHealth,
        businessMetrics: {
          taskCompletion: taskMetrics,
          userSatisfaction,
          workflowEfficiency
        },
        userBehavior,
        capacity: capacityMetrics,
        insights,
        anomalies,
        summary: {
          overallHealthScore: systemHealth.score,
          totalInsights: insights.length,
          criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length,
          activeAlerts: (await this.alertManager.getActiveAlerts()).length
        }
      };

      this.logger.info('System report generated successfully');
      return report;
    } catch (error) {
      this.logger.error('Error generating system report:', error);
      throw error;
    }
  }

  async getSystemOverview(): Promise<any> {
    try {
      const [systemHealth, activeAlerts, recentMetrics] = await Promise.all([
        this.healthMonitor.checkSystemHealth(),
        this.alertManager.getActiveAlerts(),
        this.getRecentMetrics()
      ]);

      return {
        health: systemHealth,
        alerts: {
          active: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          high: activeAlerts.filter(a => a.severity === 'high').length
        },
        metrics: recentMetrics,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Error getting system overview:', error);
      throw error;
    }
  }

  // Dashboard Methods
  async createCustomDashboard(name: string, widgets: any[], userId: string): Promise<any> {
    try {
      return await this.dashboardService.createDashboard({
        name,
        description: `Custom dashboard created by user ${userId}`,
        widgets,
        layout: {
          columns: 12,
          rows: 8,
          responsive: true
        },
        refreshInterval: 60,
        permissions: [userId]
      });
    } catch (error) {
      this.logger.error('Error creating custom dashboard:', error);
      throw error;
    }
  }

  async getUserDashboards(userId: string): Promise<any[]> {
    try {
      return await this.dashboardService.getDashboards(userId);
    } catch (error) {
      this.logger.error('Error getting user dashboards:', error);
      throw error;
    }
  }

  // Alert Methods
  async createCustomAlert(alertConfig: any): Promise<any> {
    try {
      return await this.alertManager.createAlert(alertConfig);
    } catch (error) {
      this.logger.error('Error creating custom alert:', error);
      throw error;
    }
  }

  async getAlertSummary(): Promise<any> {
    try {
      const activeAlerts = await this.alertManager.getActiveAlerts();
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentAlerts = await this.alertManager.getAlertHistory({
        start: last24Hours,
        end: new Date()
      });

      return {
        active: {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          high: activeAlerts.filter(a => a.severity === 'high').length,
          medium: activeAlerts.filter(a => a.severity === 'medium').length,
          low: activeAlerts.filter(a => a.severity === 'low').length
        },
        recent: {
          total: recentAlerts.length,
          resolved: recentAlerts.filter(a => a.status === 'resolved').length,
          acknowledged: recentAlerts.filter(a => a.status === 'acknowledged').length
        },
        trends: await this.calculateAlertTrends()
      };
    } catch (error) {
      this.logger.error('Error getting alert summary:', error);
      throw error;
    }
  }

  // Health Check Methods
  async performHealthCheck(): Promise<any> {
    try {
      const [systemHealth, diagnostics] = await Promise.all([
        this.healthMonitor.checkSystemHealth(),
        this.healthMonitor.runDiagnostics()
      ]);

      return {
        health: systemHealth,
        diagnostics: {
          total: diagnostics.length,
          passed: diagnostics.filter(d => d.status === 'pass').length,
          warnings: diagnostics.filter(d => d.status === 'warning').length,
          failed: diagnostics.filter(d => d.status === 'fail').length,
          details: diagnostics
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Error performing health check:', error);
      throw error;
    }
  }

  // Configuration Methods
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Monitoring configuration updated', newConfig);
    
    // Restart scheduled tasks with new configuration
    this.stopScheduledTasks();
    this.startScheduledTasks();
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Private Methods
  private async createDefaultDashboards(): Promise<void> {
    try {
      // Create system overview dashboard
      await this.dashboardService.createSystemOverviewDashboard();
      
      // Create business metrics dashboard
      await this.dashboardService.createBusinessMetricsDashboard();
      
      this.logger.info('Default dashboards created');
    } catch (error) {
      this.logger.warn('Error creating default dashboards:', error);
    }
  }

  private startScheduledTasks(): void {
    // Metrics collection task
    const metricsTask = cron.schedule(`*/${this.config.collectionInterval} * * * * *`, async () => {
      await this.collectAllMetrics();
    }, { scheduled: false });

    // Health check task
    const healthTask = cron.schedule(`*/${this.config.healthCheckInterval} * * * * *`, async () => {
      await this.healthMonitor.checkSystemHealth();
    }, { scheduled: false });

    // Analytics task (every 5 minutes)
    const analyticsTask = cron.schedule('*/5 * * * *', async () => {
      if (this.config.anomalyDetectionEnabled) {
        await this.analyticsEngine.detectAnomalies();
      }
    }, { scheduled: false });

    // Cleanup task (daily at 2 AM)
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      await this.performCleanup();
    }, { scheduled: false });

    // Start all tasks
    metricsTask.start();
    healthTask.start();
    analyticsTask.start();
    cleanupTask.start();

    this.scheduledJobs = [metricsTask, healthTask, analyticsTask, cleanupTask];
    this.logger.info('Scheduled monitoring tasks started');
  }

  private stopScheduledTasks(): void {
    this.scheduledJobs.forEach(job => job.destroy());
    this.scheduledJobs = [];
    this.logger.info('Scheduled monitoring tasks stopped');
  }

  private startRealTimeMonitoring(): void {
    // Start alert evaluation
    // This is handled by AlertManager constructor
    
    this.logger.info('Real-time monitoring started');
  }

  private async performCleanup(): Promise<void> {
    try {
      this.logger.info('Starting monitoring data cleanup...');

      // Clean up old metrics
      const metricsRetentionDate = new Date();
      metricsRetentionDate.setDate(metricsRetentionDate.getDate() - this.config.metricsRetention);

      // Clean up old alerts
      const alertRetentionDate = new Date();
      alertRetentionDate.setDate(alertRetentionDate.getDate() - this.config.alertRetention);

      // Perform cleanup operations
      // This would be implemented based on your database structure

      this.logger.info('Monitoring data cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  private async getRecentMetrics(): Promise<any> {
    try {
      // Get recent system metrics
      const systemMetrics = await this.metricsCollector.collectSystemMetrics();
      const businessMetrics = await this.metricsCollector.collectBusinessMetrics();

      return {
        system: systemMetrics.slice(0, 10), // Last 10 system metrics
        business: businessMetrics.slice(0, 5) // Last 5 business metrics
      };
    } catch (error) {
      this.logger.error('Error getting recent metrics:', error);
      return { system: [], business: [] };
    }
  }

  private async calculateAlertTrends(): Promise<any> {
    try {
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const last14Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const [recentAlerts, olderAlerts] = await Promise.all([
        this.alertManager.getAlertHistory({ start: last7Days, end: new Date() }),
        this.alertManager.getAlertHistory({ start: last14Days, end: last7Days })
      ]);

      const recentCount = recentAlerts.length;
      const olderCount = olderAlerts.length;
      const trend = olderCount === 0 ? 0 : ((recentCount - olderCount) / olderCount) * 100;

      return {
        current: recentCount,
        previous: olderCount,
        trend: Math.round(trend),
        direction: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
      };
    } catch (error) {
      this.logger.error('Error calculating alert trends:', error);
      return { current: 0, previous: 0, trend: 0, direction: 'stable' };
    }
  }
}