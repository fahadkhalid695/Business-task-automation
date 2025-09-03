import { IAlertManager } from './interfaces';
import { Alert, AlertSeverity, AlertStatus, EscalationRule, EscalationLevel } from './types';
import { Logger } from '../shared/utils/Logger';
import { DatabaseService } from '../shared/database/DatabaseService';
import { NotificationService } from '../shared/services/NotificationService';
import { MetricsCollector } from './MetricsCollector';
import { v4 as uuidv4 } from 'uuid';

export class AlertManager implements IAlertManager {
  private logger = Logger.getInstance();
  private db = DatabaseService.getInstance();
  private notificationService = new NotificationService();
  private metricsCollector = new MetricsCollector();
  private escalationRules: EscalationRule[] = [];
  private evaluationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadEscalationRules();
    this.startAlertEvaluation();
  }

  async createAlert(alertData: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert> {
    try {
      const alert: Alert = {
        ...alertData,
        id: uuidv4(),
        createdAt: new Date(),
        escalationLevel: 0
      };

      const collection = this.db.getCollection('alerts');
      await collection.insertOne(alert);

      this.logger.info(`Alert created: ${alert.name} (${alert.severity})`);

      // Send immediate notification for critical alerts
      if (alert.severity === AlertSeverity.CRITICAL) {
        await this.sendAlertNotification(alert);
      }

      // Start escalation process
      await this.startEscalation(alert);

      return alert;
    } catch (error) {
      this.logger.error('Error creating alert:', error);
      throw error;
    }
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert> {
    try {
      const collection = this.db.getCollection('alerts');
      const result = await collection.findOneAndUpdate(
        { id },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error(`Alert not found: ${id}`);
      }

      this.logger.info(`Alert updated: ${id}`);
      return result.value as Alert;
    } catch (error) {
      this.logger.error('Error updating alert:', error);
      throw error;
    }
  }

  async resolveAlert(id: string, resolvedBy: string): Promise<void> {
    try {
      const alert = await this.updateAlert(id, {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date()
      });

      this.logger.info(`Alert resolved: ${id} by ${resolvedBy}`);

      // Send resolution notification
      await this.sendResolutionNotification(alert, resolvedBy);

      // Stop escalation
      await this.stopEscalation(id);
    } catch (error) {
      this.logger.error('Error resolving alert:', error);
      throw error;
    }
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<void> {
    try {
      await this.updateAlert(id, {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        assignedTo: acknowledgedBy
      });

      this.logger.info(`Alert acknowledged: ${id} by ${acknowledgedBy}`);
    } catch (error) {
      this.logger.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  async escalateAlert(id: string): Promise<void> {
    try {
      const collection = this.db.getCollection('alerts');
      const alert = await collection.findOne({ id }) as Alert;

      if (!alert) {
        throw new Error(`Alert not found: ${id}`);
      }

      if (alert.status === AlertStatus.RESOLVED) {
        return; // Don't escalate resolved alerts
      }

      const escalationRule = this.findEscalationRule(alert);
      if (!escalationRule) {
        this.logger.warn(`No escalation rule found for alert: ${id}`);
        return;
      }

      const nextLevel = alert.escalationLevel + 1;
      const escalationLevel = escalationRule.escalationLevels.find(
        level => level.level === nextLevel
      );

      if (!escalationLevel) {
        this.logger.warn(`No escalation level ${nextLevel} for alert: ${id}`);
        return;
      }

      await this.updateAlert(id, {
        escalationLevel: nextLevel
      });

      // Send escalation notifications
      await this.sendEscalationNotification(alert, escalationLevel);

      // Schedule next escalation if available
      const nextEscalationLevel = escalationRule.escalationLevels.find(
        level => level.level === nextLevel + 1
      );

      if (nextEscalationLevel) {
        setTimeout(() => {
          this.escalateAlert(id);
        }, nextEscalationLevel.delay * 60 * 1000); // Convert minutes to milliseconds
      }

      this.logger.info(`Alert escalated to level ${nextLevel}: ${id}`);
    } catch (error) {
      this.logger.error('Error escalating alert:', error);
      throw error;
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const collection = this.db.getCollection('alerts');
      return await collection.find({
        status: { $in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] }
      }).sort({ createdAt: -1 }).toArray() as Alert[];
    } catch (error) {
      this.logger.error('Error getting active alerts:', error);
      throw error;
    }
  }

  async getAlertHistory(timeRange: { start: Date; end: Date }): Promise<Alert[]> {
    try {
      const collection = this.db.getCollection('alerts');
      return await collection.find({
        createdAt: {
          $gte: timeRange.start,
          $lte: timeRange.end
        }
      }).sort({ createdAt: -1 }).toArray() as Alert[];
    } catch (error) {
      this.logger.error('Error getting alert history:', error);
      throw error;
    }
  }

  async evaluateAlertConditions(): Promise<void> {
    try {
      // Collect current metrics
      const systemMetrics = await this.metricsCollector.collectSystemMetrics();
      const businessMetrics = await this.metricsCollector.collectBusinessMetrics();

      // Evaluate system metric thresholds
      for (const metric of systemMetrics) {
        await this.evaluateMetricThreshold(metric);
      }

      // Evaluate business metric thresholds
      for (const metric of businessMetrics) {
        await this.evaluateBusinessMetricThreshold(metric);
      }

      // Check service health
      await this.evaluateServiceHealth();

      // Check for anomalies
      await this.evaluateAnomalies();

    } catch (error) {
      this.logger.error('Error evaluating alert conditions:', error);
    }
  }

  private async evaluateMetricThreshold(metric: any): Promise<void> {
    const thresholds = this.getMetricThresholds(metric.name);
    
    for (const threshold of thresholds) {
      if (this.evaluateCondition(metric.value, threshold.condition, threshold.value)) {
        // Check if alert already exists
        const existingAlert = await this.findExistingAlert(metric.name, threshold.severity);
        
        if (!existingAlert) {
          await this.createAlert({
            name: `${metric.name} threshold exceeded`,
            description: `${metric.name} value ${metric.value} exceeds threshold ${threshold.value}`,
            severity: threshold.severity,
            status: AlertStatus.ACTIVE,
            condition: threshold.condition,
            threshold: threshold.value,
            currentValue: metric.value,
            service: metric.service,
            escalationLevel: 0
          });
        }
      }
    }
  }

  private async evaluateBusinessMetricThreshold(metric: any): Promise<void> {
    if (metric.target && metric.value < metric.target * 0.9) { // 10% below target
      const existingAlert = await this.findExistingAlert(metric.name, AlertSeverity.MEDIUM);
      
      if (!existingAlert) {
        await this.createAlert({
          name: `${metric.name} below target`,
          description: `${metric.name} value ${metric.value} is below target ${metric.target}`,
          severity: AlertSeverity.MEDIUM,
          status: AlertStatus.ACTIVE,
          condition: 'below_target',
          threshold: metric.target,
          currentValue: metric.value,
          service: 'business',
          escalationLevel: 0
        });
      }
    }
  }

  private async evaluateServiceHealth(): Promise<void> {
    const services = ['api-gateway', 'task-orchestrator', 'ai-ml-engine'];
    
    for (const service of services) {
      try {
        const performanceMetrics = await this.metricsCollector.collectPerformanceMetrics(service);
        
        // Check error rate
        if (performanceMetrics.errorRate > 5) { // 5% error rate threshold
          const existingAlert = await this.findExistingAlert(`${service}_error_rate`, AlertSeverity.HIGH);
          
          if (!existingAlert) {
            await this.createAlert({
              name: `High error rate in ${service}`,
              description: `Error rate ${performanceMetrics.errorRate}% exceeds threshold`,
              severity: AlertSeverity.HIGH,
              status: AlertStatus.ACTIVE,
              condition: 'error_rate_high',
              threshold: 5,
              currentValue: performanceMetrics.errorRate,
              service,
              escalationLevel: 0
            });
          }
        }

        // Check response time
        if (performanceMetrics.responseTime.p95 > 1000) { // 1 second P95 threshold
          const existingAlert = await this.findExistingAlert(`${service}_response_time`, AlertSeverity.MEDIUM);
          
          if (!existingAlert) {
            await this.createAlert({
              name: `High response time in ${service}`,
              description: `P95 response time ${performanceMetrics.responseTime.p95}ms exceeds threshold`,
              severity: AlertSeverity.MEDIUM,
              status: AlertStatus.ACTIVE,
              condition: 'response_time_high',
              threshold: 1000,
              currentValue: performanceMetrics.responseTime.p95,
              service,
              escalationLevel: 0
            });
          }
        }
      } catch (error) {
        // Service might be down
        const existingAlert = await this.findExistingAlert(`${service}_down`, AlertSeverity.CRITICAL);
        
        if (!existingAlert) {
          await this.createAlert({
            name: `Service ${service} is down`,
            description: `Unable to collect metrics from ${service}`,
            severity: AlertSeverity.CRITICAL,
            status: AlertStatus.ACTIVE,
            condition: 'service_down',
            threshold: 0,
            currentValue: 0,
            service,
            escalationLevel: 0
          });
        }
      }
    }
  }

  private async evaluateAnomalies(): Promise<void> {
    // This would use ML models to detect anomalies
    // For now, implement basic statistical anomaly detection
    
    const collection = this.db.getCollection('metrics');
    const recentMetrics = await collection.find({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).toArray();

    // Group metrics by name
    const metricGroups = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.value);
      return acc;
    }, {});

    // Check for anomalies using simple statistical methods
    for (const [metricName, values] of Object.entries(metricGroups)) {
      const anomaly = this.detectStatisticalAnomaly(values as number[]);
      
      if (anomaly.isAnomaly) {
        const existingAlert = await this.findExistingAlert(`${metricName}_anomaly`, AlertSeverity.MEDIUM);
        
        if (!existingAlert) {
          await this.createAlert({
            name: `Anomaly detected in ${metricName}`,
            description: `Statistical anomaly detected: current value ${anomaly.currentValue} deviates significantly from normal range`,
            severity: AlertSeverity.MEDIUM,
            status: AlertStatus.ACTIVE,
            condition: 'anomaly_detected',
            threshold: anomaly.threshold,
            currentValue: anomaly.currentValue,
            service: 'system',
            escalationLevel: 0
          });
        }
      }
    }
  }

  private detectStatisticalAnomaly(values: number[]) {
    if (values.length < 10) {
      return { isAnomaly: false, currentValue: 0, threshold: 0 };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const currentValue = values[values.length - 1];
    const threshold = 2 * stdDev; // 2 standard deviations
    const deviation = Math.abs(currentValue - mean);
    
    return {
      isAnomaly: deviation > threshold,
      currentValue,
      threshold,
      deviation
    };
  }

  private getMetricThresholds(metricName: string) {
    const thresholds = {
      'system.cpu.usage': [
        { condition: '>', value: 80, severity: AlertSeverity.MEDIUM },
        { condition: '>', value: 90, severity: AlertSeverity.HIGH },
        { condition: '>', value: 95, severity: AlertSeverity.CRITICAL }
      ],
      'system.memory.usage': [
        { condition: '>', value: 80, severity: AlertSeverity.MEDIUM },
        { condition: '>', value: 90, severity: AlertSeverity.HIGH },
        { condition: '>', value: 95, severity: AlertSeverity.CRITICAL }
      ],
      'system.disk.usage': [
        { condition: '>', value: 85, severity: AlertSeverity.MEDIUM },
        { condition: '>', value: 95, severity: AlertSeverity.HIGH }
      ]
    };

    return thresholds[metricName] || [];
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      default:
        return false;
    }
  }

  private async findExistingAlert(metricName: string, severity: AlertSeverity): Promise<Alert | null> {
    const collection = this.db.getCollection('alerts');
    return await collection.findOne({
      name: { $regex: metricName, $options: 'i' },
      severity,
      status: { $in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] }
    }) as Alert | null;
  }

  private findEscalationRule(alert: Alert): EscalationRule | undefined {
    return this.escalationRules.find(rule => 
      rule.severity === alert.severity && 
      rule.isActive &&
      this.evaluateCondition(alert.currentValue, rule.condition, alert.threshold)
    );
  }

  private async startEscalation(alert: Alert): Promise<void> {
    const escalationRule = this.findEscalationRule(alert);
    if (!escalationRule || escalationRule.escalationLevels.length === 0) {
      return;
    }

    const firstLevel = escalationRule.escalationLevels[0];
    
    // Schedule first escalation
    setTimeout(() => {
      this.escalateAlert(alert.id);
    }, firstLevel.delay * 60 * 1000);
  }

  private async stopEscalation(alertId: string): Promise<void> {
    // In a real implementation, you'd track escalation timers and clear them
    this.logger.info(`Escalation stopped for alert: ${alertId}`);
  }

  private async sendAlertNotification(alert: Alert): Promise<void> {
    try {
      await this.notificationService.sendAlert({
        title: alert.name,
        message: alert.description,
        severity: alert.severity,
        service: alert.service,
        timestamp: alert.createdAt
      });
    } catch (error) {
      this.logger.error('Error sending alert notification:', error);
    }
  }

  private async sendResolutionNotification(alert: Alert, resolvedBy: string): Promise<void> {
    try {
      await this.notificationService.sendResolution({
        title: `Alert Resolved: ${alert.name}`,
        message: `Alert resolved by ${resolvedBy}`,
        alertId: alert.id,
        resolvedBy,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Error sending resolution notification:', error);
    }
  }

  private async sendEscalationNotification(alert: Alert, escalationLevel: EscalationLevel): Promise<void> {
    try {
      for (const recipient of escalationLevel.recipients) {
        for (const channel of escalationLevel.channels) {
          await this.notificationService.sendEscalation({
            title: `Alert Escalated: ${alert.name}`,
            message: `Alert escalated to level ${escalationLevel.level}`,
            alert,
            escalationLevel: escalationLevel.level,
            recipient,
            channel,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      this.logger.error('Error sending escalation notification:', error);
    }
  }

  private async loadEscalationRules(): Promise<void> {
    try {
      const collection = this.db.getCollection('escalation_rules');
      this.escalationRules = await collection.find({ isActive: true }).toArray() as EscalationRule[];
      
      // Load default rules if none exist
      if (this.escalationRules.length === 0) {
        await this.createDefaultEscalationRules();
      }
    } catch (error) {
      this.logger.error('Error loading escalation rules:', error);
    }
  }

  private async createDefaultEscalationRules(): Promise<void> {
    const defaultRules: EscalationRule[] = [
      {
        id: uuidv4(),
        name: 'Critical Alert Escalation',
        condition: '>',
        severity: AlertSeverity.CRITICAL,
        escalationLevels: [
          {
            level: 1,
            delay: 5, // 5 minutes
            recipients: ['oncall@company.com'],
            channels: ['email', 'sms'],
            actions: ['page_oncall']
          },
          {
            level: 2,
            delay: 15, // 15 minutes
            recipients: ['manager@company.com'],
            channels: ['email', 'slack'],
            actions: ['notify_manager']
          },
          {
            level: 3,
            delay: 30, // 30 minutes
            recipients: ['director@company.com'],
            channels: ['email', 'phone'],
            actions: ['escalate_to_director']
          }
        ],
        isActive: true
      },
      {
        id: uuidv4(),
        name: 'High Alert Escalation',
        condition: '>',
        severity: AlertSeverity.HIGH,
        escalationLevels: [
          {
            level: 1,
            delay: 15, // 15 minutes
            recipients: ['team@company.com'],
            channels: ['email', 'slack'],
            actions: ['notify_team']
          },
          {
            level: 2,
            delay: 60, // 1 hour
            recipients: ['manager@company.com'],
            channels: ['email'],
            actions: ['notify_manager']
          }
        ],
        isActive: true
      }
    ];

    const collection = this.db.getCollection('escalation_rules');
    await collection.insertMany(defaultRules);
    this.escalationRules = defaultRules;
  }

  private startAlertEvaluation(): void {
    // Evaluate alert conditions every minute
    this.evaluationInterval = setInterval(() => {
      this.evaluateAlertConditions();
    }, 60 * 1000);
  }

  public stopAlertEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }
}