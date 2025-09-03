import { IAnalyticsEngine, Insight, Anomaly } from './interfaces';
import { BusinessMetric, UserBehaviorMetrics, CapacityMetrics, AlertSeverity } from './types';
import { Logger } from '../shared/utils/Logger';
import { DatabaseService } from '../shared/database/DatabaseService';
import { MetricsCollector } from './MetricsCollector';
import { v4 as uuidv4 } from 'uuid';

export class AnalyticsEngine implements IAnalyticsEngine {
  private logger = Logger.getInstance();
  private db = DatabaseService.getInstance();
  private metricsCollector = new MetricsCollector();

  async analyzeTaskCompletionRates(): Promise<BusinessMetric[]> {
    try {
      const collection = this.db.getCollection('tasks');
      const now = new Date();
      const timeRanges = [
        { name: 'last_hour', start: new Date(now.getTime() - 60 * 60 * 1000) },
        { name: 'last_day', start: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        { name: 'last_week', start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { name: 'last_month', start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      ];

      const metrics: BusinessMetric[] = [];

      for (const range of timeRanges) {
        const totalTasks = await collection.countDocuments({
          createdAt: { $gte: range.start }
        });

        const completedTasks = await collection.countDocuments({
          createdAt: { $gte: range.start },
          status: 'completed'
        });

        const failedTasks = await collection.countDocuments({
          createdAt: { $gte: range.start },
          status: 'failed'
        });

        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const failureRate = totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0;

        metrics.push({
          id: uuidv4(),
          name: `task_completion_rate_${range.name}`,
          value: completionRate,
          target: 95,
          unit: 'percentage',
          category: 'productivity',
          timestamp: now,
          metadata: {
            timeRange: range.name,
            totalTasks,
            completedTasks,
            failedTasks,
            failureRate
          }
        });
      }

      // Analyze completion rates by task type
      const taskTypeStats = await collection.aggregate([
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]).toArray();

      for (const stat of taskTypeStats) {
        const completionRate = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
        
        metrics.push({
          id: uuidv4(),
          name: `task_completion_rate_by_type`,
          value: completionRate,
          unit: 'percentage',
          category: 'productivity',
          timestamp: now,
          metadata: {
            taskType: stat._id,
            totalTasks: stat.total,
            completedTasks: stat.completed,
            failedTasks: stat.failed
          }
        });
      }

      return metrics;
    } catch (error) {
      this.logger.error('Error analyzing task completion rates:', error);
      throw error;
    }
  }

  async analyzeUserSatisfaction(): Promise<BusinessMetric[]> {
    try {
      const collection = this.db.getCollection('user_feedback');
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Overall satisfaction score
      const feedbackData = await collection.aggregate([
        { $match: { createdAt: { $gte: lastWeek } } },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$score' },
            totalRatings: { $sum: 1 },
            scoreDistribution: {
              $push: '$score'
            }
          }
        }
      ]).toArray();

      const metrics: BusinessMetric[] = [];

      if (feedbackData.length > 0) {
        const data = feedbackData[0];
        
        metrics.push({
          id: uuidv4(),
          name: 'user_satisfaction_score',
          value: data.averageScore || 0,
          target: 4.5,
          unit: 'score',
          category: 'quality',
          timestamp: now,
          metadata: {
            totalRatings: data.totalRatings,
            scoreDistribution: this.calculateScoreDistribution(data.scoreDistribution)
          }
        });

        // Calculate Net Promoter Score (NPS)
        const promoters = data.scoreDistribution.filter((score: number) => score >= 4).length;
        const detractors = data.scoreDistribution.filter((score: number) => score <= 2).length;
        const nps = data.totalRatings > 0 ? 
          ((promoters - detractors) / data.totalRatings) * 100 : 0;

        metrics.push({
          id: uuidv4(),
          name: 'net_promoter_score',
          value: nps,
          target: 50,
          unit: 'score',
          category: 'quality',
          timestamp: now,
          metadata: {
            promoters,
            detractors,
            passives: data.totalRatings - promoters - detractors
          }
        });
      }

      // Satisfaction by feature
      const featureSatisfaction = await collection.aggregate([
        { $match: { createdAt: { $gte: lastWeek }, feature: { $exists: true } } },
        {
          $group: {
            _id: '$feature',
            averageScore: { $avg: '$score' },
            totalRatings: { $sum: 1 }
          }
        }
      ]).toArray();

      for (const feature of featureSatisfaction) {
        metrics.push({
          id: uuidv4(),
          name: 'feature_satisfaction_score',
          value: feature.averageScore,
          target: 4.0,
          unit: 'score',
          category: 'quality',
          timestamp: now,
          metadata: {
            feature: feature._id,
            totalRatings: feature.totalRatings
          }
        });
      }

      return metrics;
    } catch (error) {
      this.logger.error('Error analyzing user satisfaction:', error);
      throw error;
    }
  }

  async analyzeWorkflowEfficiency(): Promise<BusinessMetric[]> {
    try {
      const collection = this.db.getCollection('workflow_executions');
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const metrics: BusinessMetric[] = [];

      // Overall workflow efficiency
      const workflowStats = await collection.aggregate([
        { $match: { createdAt: { $gte: lastWeek } } },
        {
          $group: {
            _id: null,
            totalExecutions: { $sum: 1 },
            successfulExecutions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            averageExecutionTime: { $avg: '$executionTime' },
            automatedExecutions: {
              $sum: { $cond: ['$automated', 1, 0] }
            }
          }
        }
      ]).toArray();

      if (workflowStats.length > 0) {
        const stats = workflowStats[0];
        const successRate = stats.totalExecutions > 0 ? 
          (stats.successfulExecutions / stats.totalExecutions) * 100 : 0;
        const automationRate = stats.totalExecutions > 0 ? 
          (stats.automatedExecutions / stats.totalExecutions) * 100 : 0;

        metrics.push({
          id: uuidv4(),
          name: 'workflow_success_rate',
          value: successRate,
          target: 95,
          unit: 'percentage',
          category: 'efficiency',
          timestamp: now,
          metadata: {
            totalExecutions: stats.totalExecutions,
            successfulExecutions: stats.successfulExecutions,
            averageExecutionTime: stats.averageExecutionTime
          }
        });

        metrics.push({
          id: uuidv4(),
          name: 'workflow_automation_rate',
          value: automationRate,
          target: 80,
          unit: 'percentage',
          category: 'efficiency',
          timestamp: now,
          metadata: {
            totalExecutions: stats.totalExecutions,
            automatedExecutions: stats.automatedExecutions
          }
        });

        // Calculate efficiency score
        const efficiencyScore = this.calculateEfficiencyScore(
          successRate,
          automationRate,
          stats.averageExecutionTime
        );

        metrics.push({
          id: uuidv4(),
          name: 'workflow_efficiency_score',
          value: efficiencyScore,
          target: 85,
          unit: 'score',
          category: 'efficiency',
          timestamp: now,
          metadata: {
            successRate,
            automationRate,
            averageExecutionTime: stats.averageExecutionTime
          }
        });
      }

      // Efficiency by workflow template
      const templateStats = await collection.aggregate([
        { $match: { createdAt: { $gte: lastWeek } } },
        {
          $group: {
            _id: '$templateId',
            templateName: { $first: '$templateName' },
            totalExecutions: { $sum: 1 },
            successfulExecutions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            averageExecutionTime: { $avg: '$executionTime' },
            automatedExecutions: {
              $sum: { $cond: ['$automated', 1, 0] }
            }
          }
        }
      ]).toArray();

      for (const template of templateStats) {
        const successRate = template.totalExecutions > 0 ? 
          (template.successfulExecutions / template.totalExecutions) * 100 : 0;
        const automationRate = template.totalExecutions > 0 ? 
          (template.automatedExecutions / template.totalExecutions) * 100 : 0;

        metrics.push({
          id: uuidv4(),
          name: 'template_efficiency_score',
          value: this.calculateEfficiencyScore(successRate, automationRate, template.averageExecutionTime),
          unit: 'score',
          category: 'efficiency',
          timestamp: now,
          metadata: {
            templateId: template._id,
            templateName: template.templateName,
            successRate,
            automationRate,
            averageExecutionTime: template.averageExecutionTime,
            totalExecutions: template.totalExecutions
          }
        });
      }

      return metrics;
    } catch (error) {
      this.logger.error('Error analyzing workflow efficiency:', error);
      throw error;
    }
  }

  async analyzeUserBehavior(): Promise<UserBehaviorMetrics> {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Active users
      const userCollection = this.db.getCollection('user_sessions');
      const activeUsers = await userCollection.countDocuments({
        lastActivity: { $gte: lastWeek }
      });

      // Session statistics
      const sessionStats = await userCollection.aggregate([
        { $match: { createdAt: { $gte: lastWeek } } },
        {
          $group: {
            _id: null,
            averageDuration: { $avg: '$duration' },
            totalPageViews: { $sum: '$pageViews' },
            totalSessions: { $sum: 1 }
          }
        }
      ]).toArray();

      const sessionData = sessionStats[0] || {
        averageDuration: 0,
        totalPageViews: 0,
        totalSessions: 0
      };

      // Feature usage
      const featureCollection = this.db.getCollection('feature_usage');
      const featureUsage = await featureCollection.aggregate([
        { $match: { timestamp: { $gte: lastWeek } } },
        {
          $group: {
            _id: '$feature',
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      const featureUsageMap = featureUsage.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      // User journey
      const journeyCollection = this.db.getCollection('user_journey');
      const userJourney = await journeyCollection.find({
        timestamp: { $gte: lastWeek }
      }).sort({ timestamp: 1 }).toArray();

      // Conversion rates
      const conversionRates = await this.calculateConversionRates(lastWeek);

      return {
        activeUsers,
        sessionDuration: sessionData.averageDuration,
        pageViews: sessionData.totalPageViews,
        featureUsage: featureUsageMap,
        userJourney,
        conversionRates
      };
    } catch (error) {
      this.logger.error('Error analyzing user behavior:', error);
      throw error;
    }
  }

  async predictCapacityNeeds(): Promise<CapacityMetrics> {
    try {
      // Get historical resource usage data
      const metricsCollection = this.db.getCollection('metrics');
      const now = new Date();
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const resourceMetrics = await metricsCollection.find({
        name: { $in: ['system.cpu.usage', 'system.memory.usage', 'system.disk.usage'] },
        timestamp: { $gte: lastMonth }
      }).sort({ timestamp: 1 }).toArray();

      // Group by metric type
      const metricGroups = resourceMetrics.reduce((acc, metric) => {
        if (!acc[metric.name]) {
          acc[metric.name] = [];
        }
        acc[metric.name].push({
          timestamp: metric.timestamp,
          value: metric.value
        });
        return acc;
      }, {});

      // Calculate trends and predictions
      const predictions = {};
      const recommendations = [];

      for (const [metricName, values] of Object.entries(metricGroups)) {
        const trend = this.calculateTrend(values as any[]);
        const prediction = this.predictFutureUsage(values as any[], 7); // 7 days ahead
        
        predictions[metricName] = prediction;

        // Generate recommendations based on predictions
        if (prediction.predicted > 80) {
          recommendations.push({
            resource: metricName.split('.')[1], // cpu, memory, disk
            action: 'scale_up' as const,
            reason: `Predicted ${metricName} usage will exceed 80% in ${prediction.daysToThreshold} days`,
            impact: 'Prevent performance degradation',
            timeline: `${prediction.daysToThreshold} days`,
            confidence: prediction.confidence
          });
        }
      }

      // Get current usage
      const current = await this.metricsCollector.collectCapacityMetrics();

      // Create predicted usage based on trends
      const predicted = {
        cpu: predictions['system.cpu.usage']?.predicted || current.current.cpu,
        memory: predictions['system.memory.usage']?.predicted || current.current.memory,
        storage: predictions['system.disk.usage']?.predicted || current.current.storage,
        network: current.current.network * 1.1, // Simple 10% increase prediction
        timestamp: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      };

      return {
        current: current.current,
        predicted,
        recommendations,
        scalingEvents: current.scalingEvents
      };
    } catch (error) {
      this.logger.error('Error predicting capacity needs:', error);
      throw error;
    }
  }

  async generateInsights(): Promise<Insight[]> {
    try {
      const insights: Insight[] = [];
      const now = new Date();

      // Analyze task completion patterns
      const taskInsights = await this.generateTaskInsights();
      insights.push(...taskInsights);

      // Analyze user behavior patterns
      const userInsights = await this.generateUserInsights();
      insights.push(...userInsights);

      // Analyze system performance patterns
      const performanceInsights = await this.generatePerformanceInsights();
      insights.push(...performanceInsights);

      // Analyze cost optimization opportunities
      const costInsights = await this.generateCostInsights();
      insights.push(...costInsights);

      return insights;
    } catch (error) {
      this.logger.error('Error generating insights:', error);
      throw error;
    }
  }

  async detectAnomalies(): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = [];
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Detect metric anomalies
      const metricsCollection = this.db.getCollection('metrics');
      const metricNames = ['system.cpu.usage', 'system.memory.usage', 'http.response_time'];

      for (const metricName of metricNames) {
        const metrics = await metricsCollection.find({
          name: metricName,
          timestamp: { $gte: lastWeek }
        }).sort({ timestamp: 1 }).toArray();

        if (metrics.length < 10) continue;

        const values = metrics.map(m => m.value);
        const anomaly = this.detectStatisticalAnomaly(values, metricName);

        if (anomaly) {
          anomalies.push(anomaly);
        }
      }

      // Detect business metric anomalies
      const businessCollection = this.db.getCollection('business_metrics');
      const businessMetrics = await businessCollection.find({
        timestamp: { $gte: lastWeek }
      }).sort({ timestamp: 1 }).toArray();

      const businessGroups = businessMetrics.reduce((acc, metric) => {
        if (!acc[metric.name]) {
          acc[metric.name] = [];
        }
        acc[metric.name].push(metric.value);
        return acc;
      }, {});

      for (const [metricName, values] of Object.entries(businessGroups)) {
        const anomaly = this.detectStatisticalAnomaly(values as number[], metricName);
        if (anomaly) {
          anomalies.push(anomaly);
        }
      }

      return anomalies;
    } catch (error) {
      this.logger.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  private calculateScoreDistribution(scores: number[]) {
    return scores.reduce((acc, score) => {
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateEfficiencyScore(successRate: number, automationRate: number, avgExecutionTime: number): number {
    // Weighted efficiency score calculation
    const successWeight = 0.4;
    const automationWeight = 0.4;
    const speedWeight = 0.2;

    // Normalize execution time (lower is better, max 1000ms for full score)
    const speedScore = Math.max(0, 100 - (avgExecutionTime / 10));

    return (
      successRate * successWeight +
      automationRate * automationWeight +
      speedScore * speedWeight
    );
  }

  private calculateTrend(values: { timestamp: Date; value: number }[]): number {
    if (values.length < 2) return 0;

    const recent = values.slice(-7); // Last 7 data points
    const older = values.slice(-14, -7); // Previous 7 data points

    if (recent.length === 0 || older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v.value, 0) / older.length;

    return olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  private predictFutureUsage(values: { timestamp: Date; value: number }[], daysAhead: number) {
    if (values.length < 5) {
      return { predicted: 0, confidence: 0, daysToThreshold: 0 };
    }

    // Simple linear regression for prediction
    const n = values.length;
    const x = values.map((_, i) => i);
    const y = values.map(v => v.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predicted = slope * (n + daysAhead) + intercept;
    
    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    // Calculate days to reach 80% threshold
    const daysToThreshold = slope > 0 ? Math.max(0, (80 - intercept - slope * n) / slope) : Infinity;

    return {
      predicted: Math.max(0, predicted),
      confidence: Math.max(0, Math.min(1, rSquared)),
      daysToThreshold: isFinite(daysToThreshold) ? Math.round(daysToThreshold) : 0
    };
  }

  private async calculateConversionRates(since: Date) {
    // This would calculate actual conversion rates from your data
    // For now, return mock data
    return {
      'signup_to_first_task': 75,
      'task_creation_to_completion': 85,
      'trial_to_paid': 15,
      'feature_discovery_to_usage': 60
    };
  }

  private async generateTaskInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze task failure patterns
    const taskCollection = this.db.getCollection('tasks');
    const failedTasks = await taskCollection.find({ status: 'failed' }).toArray();
    
    if (failedTasks.length > 0) {
      const failureReasons = failedTasks.reduce((acc, task) => {
        const reason = task.failureReason || 'unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});

      const topFailureReason = Object.entries(failureReasons)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0];

      insights.push({
        id: uuidv4(),
        type: 'task_failure_pattern',
        title: 'High Task Failure Rate Detected',
        description: `${topFailureReason[1]} tasks failed due to "${topFailureReason[0]}"`,
        impact: 'high',
        confidence: 0.9,
        recommendations: [
          'Investigate root cause of failures',
          'Implement better error handling',
          'Add retry mechanisms for transient failures'
        ],
        data: { failureReasons, totalFailed: failedTasks.length },
        createdAt: new Date()
      });
    }

    return insights;
  }

  private async generateUserInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze user engagement patterns
    const userBehavior = await this.analyzeUserBehavior();
    
    if (userBehavior.sessionDuration < 300) { // Less than 5 minutes
      insights.push({
        id: uuidv4(),
        type: 'user_engagement',
        title: 'Low User Engagement Detected',
        description: `Average session duration is only ${Math.round(userBehavior.sessionDuration / 60)} minutes`,
        impact: 'medium',
        confidence: 0.8,
        recommendations: [
          'Improve onboarding experience',
          'Add interactive tutorials',
          'Simplify user interface'
        ],
        data: { sessionDuration: userBehavior.sessionDuration },
        createdAt: new Date()
      });
    }

    return insights;
  }

  private async generatePerformanceInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze response time trends
    const metricsCollection = this.db.getCollection('metrics');
    const responseTimeMetrics = await metricsCollection.find({
      name: 'http.response_time',
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).toArray();

    if (responseTimeMetrics.length > 0) {
      const avgResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      
      if (avgResponseTime > 500) { // More than 500ms
        insights.push({
          id: uuidv4(),
          type: 'performance_degradation',
          title: 'Performance Degradation Detected',
          description: `Average response time has increased to ${Math.round(avgResponseTime)}ms`,
          impact: 'high',
          confidence: 0.85,
          recommendations: [
            'Optimize database queries',
            'Implement caching strategies',
            'Scale up infrastructure resources'
          ],
          data: { averageResponseTime: avgResponseTime },
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  private async generateCostInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Analyze cost trends (mock data for now)
    const costMetrics = await this.metricsCollector.collectCostMetrics();
    
    if (costMetrics.optimization.length > 0) {
      const topOptimization = costMetrics.optimization[0];
      
      insights.push({
        id: uuidv4(),
        type: 'cost_optimization',
        title: 'Cost Optimization Opportunity',
        description: topOptimization.description,
        impact: topOptimization.effort === 'low' ? 'low' : 'medium',
        confidence: 0.7,
        recommendations: [
          `Implement ${topOptimization.type} optimization`,
          `Potential savings: $${topOptimization.potentialSavings}/month`
        ],
        data: { optimization: topOptimization },
        createdAt: new Date()
      });
    }

    return insights;
  }

  private detectStatisticalAnomaly(values: number[], metricName: string): Anomaly | null {
    if (values.length < 10) return null;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const currentValue = values[values.length - 1];
    const expectedValue = mean;
    const deviation = Math.abs(currentValue - expectedValue);
    const threshold = 2 * stdDev; // 2 standard deviations

    if (deviation > threshold) {
      let severity = AlertSeverity.LOW;
      if (deviation > 3 * stdDev) severity = AlertSeverity.HIGH;
      else if (deviation > 2.5 * stdDev) severity = AlertSeverity.MEDIUM;

      return {
        id: uuidv4(),
        metric: metricName,
        value: currentValue,
        expectedValue,
        deviation,
        severity,
        description: `${metricName} value ${currentValue} deviates significantly from expected ${expectedValue.toFixed(2)}`,
        detectedAt: new Date(),
        service: 'analytics'
      };
    }

    return null;
  }
}