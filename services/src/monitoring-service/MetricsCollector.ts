import { IMetricsCollector } from './interfaces';
import {
  Metric,
  BusinessMetric,
  PerformanceMetrics,
  UserBehaviorMetrics,
  CostMetrics,
  CapacityMetrics,
  MetricType
} from './types';
import { Logger } from '../shared/utils/Logger';
import { DatabaseService } from '../shared/database/DatabaseService';
import { RedisService } from '../shared/cache/RedisService';
import * as os from 'os';
import * as fs from 'fs';

export class MetricsCollector implements IMetricsCollector {
  private logger = Logger.getInstance();
  private db = DatabaseService.getInstance();
  private redis = RedisService.getInstance();

  async collectSystemMetrics(): Promise<Metric[]> {
    try {
      const metrics: Metric[] = [];
      const timestamp = new Date();

      // CPU Metrics
      const cpuUsage = await this.getCPUUsage();
      metrics.push({
        id: `cpu_usage_${Date.now()}`,
        name: 'system.cpu.usage',
        type: MetricType.GAUGE,
        value: cpuUsage,
        labels: { host: os.hostname() },
        timestamp,
        service: 'system'
      });

      // Memory Metrics
      const memoryUsage = this.getMemoryUsage();
      metrics.push({
        id: `memory_usage_${Date.now()}`,
        name: 'system.memory.usage',
        type: MetricType.GAUGE,
        value: memoryUsage.percentage,
        labels: { 
          host: os.hostname(),
          total: memoryUsage.total.toString(),
          used: memoryUsage.used.toString()
        },
        timestamp,
        service: 'system'
      });

      // Disk Usage
      const diskUsage = await this.getDiskUsage();
      metrics.push({
        id: `disk_usage_${Date.now()}`,
        name: 'system.disk.usage',
        type: MetricType.GAUGE,
        value: diskUsage.percentage,
        labels: { 
          host: os.hostname(),
          path: '/',
          total: diskUsage.total.toString(),
          used: diskUsage.used.toString()
        },
        timestamp,
        service: 'system'
      });

      // Network Metrics
      const networkStats = this.getNetworkStats();
      metrics.push({
        id: `network_rx_${Date.now()}`,
        name: 'system.network.bytes_received',
        type: MetricType.COUNTER,
        value: networkStats.bytesReceived,
        labels: { host: os.hostname() },
        timestamp,
        service: 'system'
      });

      metrics.push({
        id: `network_tx_${Date.now()}`,
        name: 'system.network.bytes_transmitted',
        type: MetricType.COUNTER,
        value: networkStats.bytesTransmitted,
        labels: { host: os.hostname() },
        timestamp,
        service: 'system'
      });

      // Store metrics in database
      await this.storeMetrics(metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Error collecting system metrics:', error);
      throw error;
    }
  }

  async collectBusinessMetrics(): Promise<BusinessMetric[]> {
    try {
      const metrics: BusinessMetric[] = [];
      const timestamp = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Task Completion Rate
      const taskStats = await this.getTaskCompletionStats(today);
      metrics.push({
        id: `task_completion_rate_${Date.now()}`,
        name: 'business.task.completion_rate',
        value: taskStats.completionRate,
        target: 95, // 95% target completion rate
        unit: 'percentage',
        category: 'productivity',
        timestamp,
        metadata: {
          totalTasks: taskStats.total,
          completedTasks: taskStats.completed,
          failedTasks: taskStats.failed
        }
      });

      // User Satisfaction Score
      const satisfactionScore = await this.getUserSatisfactionScore();
      metrics.push({
        id: `user_satisfaction_${Date.now()}`,
        name: 'business.user.satisfaction_score',
        value: satisfactionScore.average,
        target: 4.5, // Target 4.5/5 satisfaction
        unit: 'score',
        category: 'quality',
        timestamp,
        metadata: {
          totalRatings: satisfactionScore.count,
          distribution: satisfactionScore.distribution
        }
      });

      // Workflow Efficiency
      const workflowStats = await this.getWorkflowEfficiencyStats();
      metrics.push({
        id: `workflow_efficiency_${Date.now()}`,
        name: 'business.workflow.efficiency_score',
        value: workflowStats.efficiencyScore,
        target: 85, // Target 85% efficiency
        unit: 'percentage',
        category: 'efficiency',
        timestamp,
        metadata: {
          averageExecutionTime: workflowStats.averageExecutionTime,
          automationRate: workflowStats.automationRate
        }
      });

      // Cost per Task
      const costMetrics = await this.getCostPerTask();
      metrics.push({
        id: `cost_per_task_${Date.now()}`,
        name: 'business.cost.per_task',
        value: costMetrics.costPerTask,
        unit: 'currency',
        category: 'financial',
        timestamp,
        metadata: {
          totalCost: costMetrics.totalCost,
          totalTasks: costMetrics.totalTasks
        }
      });

      // Store business metrics
      await this.storeBusinessMetrics(metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Error collecting business metrics:', error);
      throw error;
    }
  }

  async collectPerformanceMetrics(service: string): Promise<PerformanceMetrics> {
    try {
      const cacheKey = `performance_metrics:${service}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const metrics = await this.getServicePerformanceMetrics(service);
      
      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(metrics));
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error collecting performance metrics for ${service}:`, error);
      throw error;
    }
  }

  async collectUserBehaviorMetrics(): Promise<UserBehaviorMetrics> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeUsers = await this.getActiveUsersCount(today);
      const sessionStats = await this.getSessionStats(today);
      const featureUsage = await this.getFeatureUsage(today);
      const userJourney = await this.getUserJourneyData(today);
      const conversionRates = await this.getConversionRates(today);

      return {
        activeUsers,
        sessionDuration: sessionStats.averageDuration,
        pageViews: sessionStats.totalPageViews,
        featureUsage,
        userJourney,
        conversionRates
      };
    } catch (error) {
      this.logger.error('Error collecting user behavior metrics:', error);
      throw error;
    }
  }

  async collectCostMetrics(): Promise<CostMetrics> {
    try {
      const costData = await this.getCostAnalysis();
      return costData;
    } catch (error) {
      this.logger.error('Error collecting cost metrics:', error);
      throw error;
    }
  }

  async collectCapacityMetrics(): Promise<CapacityMetrics> {
    try {
      const current = await this.getCurrentResourceUsage();
      const predicted = await this.getPredictedResourceUsage();
      const recommendations = await this.getCapacityRecommendations();
      const scalingEvents = await this.getRecentScalingEvents();

      return {
        current,
        predicted,
        recommendations,
        scalingEvents
      };
    } catch (error) {
      this.logger.error('Error collecting capacity metrics:', error);
      throw error;
    }
  }

  async recordCustomMetric(metric: Metric): Promise<void> {
    try {
      await this.storeMetrics([metric]);
      this.logger.info(`Custom metric recorded: ${metric.name}`);
    } catch (error) {
      this.logger.error('Error recording custom metric:', error);
      throw error;
    }
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startMeasure = process.cpuUsage();
      setTimeout(() => {
        const endMeasure = process.cpuUsage(startMeasure);
        const totalUsage = endMeasure.user + endMeasure.system;
        const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  private getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      total,
      used,
      free,
      percentage
    };
  }

  private async getDiskUsage() {
    try {
      const stats = await fs.promises.statfs('.');
      const total = stats.blocks * stats.blksize;
      const free = stats.bavail * stats.blksize;
      const used = total - free;
      const percentage = (used / total) * 100;

      return {
        total,
        used,
        free,
        percentage
      };
    } catch (error) {
      // Fallback for systems without statfs
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      };
    }
  }

  private getNetworkStats() {
    const interfaces = os.networkInterfaces();
    let bytesReceived = 0;
    let bytesTransmitted = 0;

    // This is a simplified implementation
    // In production, you'd want to use system-specific tools
    return {
      bytesReceived,
      bytesTransmitted
    };
  }

  private async storeMetrics(metrics: Metric[]): Promise<void> {
    const collection = this.db.getCollection('metrics');
    await collection.insertMany(metrics);
  }

  private async storeBusinessMetrics(metrics: BusinessMetric[]): Promise<void> {
    const collection = this.db.getCollection('business_metrics');
    await collection.insertMany(metrics);
  }

  private async getTaskCompletionStats(since: Date) {
    const collection = this.db.getCollection('tasks');
    const total = await collection.countDocuments({ createdAt: { $gte: since } });
    const completed = await collection.countDocuments({ 
      createdAt: { $gte: since },
      status: 'completed'
    });
    const failed = await collection.countDocuments({ 
      createdAt: { $gte: since },
      status: 'failed'
    });

    return {
      total,
      completed,
      failed,
      completionRate: total > 0 ? (completed / total) * 100 : 0
    };
  }

  private async getUserSatisfactionScore() {
    const collection = this.db.getCollection('user_feedback');
    const ratings = await collection.find({}).toArray();
    
    if (ratings.length === 0) {
      return { average: 0, count: 0, distribution: {} };
    }

    const sum = ratings.reduce((acc, rating) => acc + rating.score, 0);
    const average = sum / ratings.length;
    
    const distribution = ratings.reduce((acc, rating) => {
      acc[rating.score] = (acc[rating.score] || 0) + 1;
      return acc;
    }, {});

    return {
      average,
      count: ratings.length,
      distribution
    };
  }

  private async getWorkflowEfficiencyStats() {
    const collection = this.db.getCollection('workflow_executions');
    const executions = await collection.find({}).toArray();
    
    if (executions.length === 0) {
      return { efficiencyScore: 0, averageExecutionTime: 0, automationRate: 0 };
    }

    const totalTime = executions.reduce((acc, exec) => acc + exec.executionTime, 0);
    const averageExecutionTime = totalTime / executions.length;
    
    const automated = executions.filter(exec => exec.automated).length;
    const automationRate = (automated / executions.length) * 100;
    
    // Calculate efficiency score based on execution time and automation rate
    const efficiencyScore = Math.min(automationRate + (1000 / averageExecutionTime), 100);

    return {
      efficiencyScore,
      averageExecutionTime,
      automationRate
    };
  }

  private async getCostPerTask() {
    // This would integrate with your cost tracking system
    // For now, return mock data
    return {
      costPerTask: 2.50,
      totalCost: 1000,
      totalTasks: 400
    };
  }

  private async getServicePerformanceMetrics(service: string): Promise<PerformanceMetrics> {
    // This would collect actual performance data from the service
    // For now, return mock data
    return {
      responseTime: {
        avg: 150,
        p50: 120,
        p95: 300,
        p99: 500
      },
      throughput: 1000,
      errorRate: 0.5,
      cpuUsage: 45,
      memoryUsage: 60,
      diskUsage: 30,
      networkIO: {
        inbound: 1024000,
        outbound: 512000
      }
    };
  }

  private async getActiveUsersCount(since: Date): Promise<number> {
    const collection = this.db.getCollection('user_sessions');
    return await collection.countDocuments({ 
      lastActivity: { $gte: since }
    });
  }

  private async getSessionStats(since: Date) {
    const collection = this.db.getCollection('user_sessions');
    const sessions = await collection.find({ 
      createdAt: { $gte: since }
    }).toArray();

    const totalDuration = sessions.reduce((acc, session) => {
      return acc + (session.duration || 0);
    }, 0);

    const totalPageViews = sessions.reduce((acc, session) => {
      return acc + (session.pageViews || 0);
    }, 0);

    return {
      averageDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
      totalPageViews
    };
  }

  private async getFeatureUsage(since: Date) {
    const collection = this.db.getCollection('feature_usage');
    const usage = await collection.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: '$feature', count: { $sum: 1 } } }
    ]).toArray();

    return usage.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getUserJourneyData(since: Date) {
    const collection = this.db.getCollection('user_journey');
    return await collection.find({ 
      timestamp: { $gte: since }
    }).toArray();
  }

  private async getConversionRates(since: Date) {
    // Calculate conversion rates for different funnels
    return {
      'signup_to_first_task': 75,
      'task_creation_to_completion': 85,
      'trial_to_paid': 15
    };
  }

  private async getCostAnalysis(): Promise<CostMetrics> {
    // This would integrate with cloud provider APIs
    return {
      totalCost: 5000,
      costByService: {
        'api-gateway': 800,
        'task-orchestrator': 1200,
        'ai-ml-engine': 2000,
        'database': 600,
        'storage': 400
      },
      costByResource: {
        'compute': 3000,
        'storage': 800,
        'network': 600,
        'ai-services': 600
      },
      costTrend: [],
      optimization: [
        {
          type: 'rightsizing',
          description: 'Reduce oversized instances in development environment',
          potentialSavings: 300,
          effort: 'low',
          priority: 1
        }
      ]
    };
  }

  private async getCurrentResourceUsage() {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();

    return {
      cpu: cpuUsage,
      memory: memoryUsage.percentage,
      storage: diskUsage.percentage,
      network: 45, // Mock network usage
      timestamp: new Date()
    };
  }

  private async getPredictedResourceUsage() {
    // This would use ML models to predict future usage
    const current = await this.getCurrentResourceUsage();
    
    return {
      cpu: current.cpu * 1.2, // Predict 20% increase
      memory: current.memory * 1.15,
      storage: current.storage * 1.1,
      network: current.network * 1.25,
      timestamp: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };
  }

  private async getCapacityRecommendations() {
    return [
      {
        resource: 'cpu',
        action: 'scale_up' as const,
        reason: 'CPU usage trending upward, approaching 80% threshold',
        impact: 'Prevent performance degradation during peak hours',
        timeline: '2-3 days',
        confidence: 0.85
      }
    ];
  }

  private async getRecentScalingEvents() {
    const collection = this.db.getCollection('scaling_events');
    return await collection.find({
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).toArray();
  }
}