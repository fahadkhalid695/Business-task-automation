import { Logger } from '../shared/utils/logger';
import { WorkflowTemplateRepository } from '../shared/repositories/WorkflowTemplateRepository';
import { TaskModel } from '../shared/models/Task';
import { WorkflowExecution } from './WorkflowEngine';
import { AppError } from '../shared/utils/errors';

const logger = new Logger('WorkflowAnalyticsService');

export interface WorkflowPerformanceMetrics {
  templateId: string;
  templateName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  medianDuration: number;
  minDuration: number;
  maxDuration: number;
  averageStepsCompleted: number;
  mostFailedStep?: string;
  bottleneckSteps: string[];
  lastExecuted?: Date;
  trendsLast30Days: {
    executions: number[];
    successRate: number[];
    avgDuration: number[];
  };
}

export interface WorkflowOptimizationRecommendation {
  type: 'performance' | 'reliability' | 'cost' | 'usability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: string;
}

export interface WorkflowUsageAnalytics {
  templateId: string;
  templateName: string;
  category: string;
  usageFrequency: 'low' | 'medium' | 'high';
  peakUsageHours: number[];
  triggerTypeDistribution: { [key: string]: number };
  userAdoption: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
  };
  stepUtilization: {
    stepId: string;
    stepName: string;
    executionCount: number;
    successRate: number;
    avgDuration: number;
  }[];
}

export class WorkflowAnalyticsService {
  private repository: WorkflowTemplateRepository;
  private executionHistory = new Map<string, WorkflowExecution[]>();

  constructor() {
    this.repository = new WorkflowTemplateRepository();
  }

  async recordExecution(execution: WorkflowExecution): Promise<void> {
    try {
      const templateExecutions = this.executionHistory.get(execution.templateId) || [];
      templateExecutions.push(execution);
      
      // Keep only last 1000 executions per template
      if (templateExecutions.length > 1000) {
        templateExecutions.splice(0, templateExecutions.length - 1000);
      }
      
      this.executionHistory.set(execution.templateId, templateExecutions);
      
      logger.debug('Workflow execution recorded', {
        templateId: execution.templateId,
        executionId: execution.id,
        status: execution.status
      });
    } catch (error) {
      logger.error('Failed to record workflow execution', error, { execution });
    }
  }

  async getPerformanceMetrics(templateId: string, days: number = 30): Promise<WorkflowPerformanceMetrics> {
    try {
      const template = await this.repository.findByIdOrThrow(templateId);
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get executions from database and memory
      const dbExecutions = await this.getExecutionsFromDatabase(templateId, cutoffDate);
      const memoryExecutions = this.executionHistory.get(templateId) || [];
      
      const allExecutions = [...dbExecutions, ...memoryExecutions]
        .filter(exec => exec.startedAt >= cutoffDate)
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

      if (allExecutions.length === 0) {
        return this.createEmptyMetrics(templateId, template.name);
      }

      const successfulExecutions = allExecutions.filter(e => e.status === 'completed');
      const failedExecutions = allExecutions.filter(e => e.status === 'failed');
      
      const durations = successfulExecutions
        .filter(e => e.completedAt)
        .map(e => e.completedAt!.getTime() - e.startedAt.getTime());

      const metrics: WorkflowPerformanceMetrics = {
        templateId,
        templateName: template.name,
        totalExecutions: allExecutions.length,
        successfulExecutions: successfulExecutions.length,
        failedExecutions: failedExecutions.length,
        successRate: allExecutions.length > 0 ? (successfulExecutions.length / allExecutions.length) * 100 : 0,
        averageDuration: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
        medianDuration: this.calculateMedian(durations),
        minDuration: durations.length > 0 ? Math.min(...durations) : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
        averageStepsCompleted: this.calculateAverageStepsCompleted(allExecutions, template.steps.length),
        mostFailedStep: this.findMostFailedStep(failedExecutions),
        bottleneckSteps: this.identifyBottleneckSteps(allExecutions, template.steps),
        lastExecuted: allExecutions.length > 0 ? allExecutions[allExecutions.length - 1].startedAt : undefined,
        trendsLast30Days: this.calculateTrends(allExecutions, 30)
      };

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics', error, { templateId });
      throw error;
    }
  }

  async generateOptimizationRecommendations(templateId: string): Promise<WorkflowOptimizationRecommendation[]> {
    try {
      const metrics = await this.getPerformanceMetrics(templateId);
      const template = await this.repository.findByIdOrThrow(templateId);
      const recommendations: WorkflowOptimizationRecommendation[] = [];

      // Performance recommendations
      if (metrics.averageDuration > 300000) { // 5 minutes
        recommendations.push({
          type: 'performance',
          priority: 'high',
          title: 'Long Execution Time',
          description: `Average execution time is ${Math.round(metrics.averageDuration / 1000)} seconds, which is quite long.`,
          impact: 'Reduces user satisfaction and system throughput',
          implementation: 'Consider parallelizing independent steps or optimizing slow operations',
          estimatedImprovement: '30-50% reduction in execution time'
        });
      }

      // Reliability recommendations
      if (metrics.successRate < 80) {
        recommendations.push({
          type: 'reliability',
          priority: 'critical',
          title: 'Low Success Rate',
          description: `Success rate is ${metrics.successRate.toFixed(1)}%, indicating reliability issues.`,
          impact: 'High failure rate affects business processes and user trust',
          implementation: 'Add error handling, retry logic, and input validation',
          estimatedImprovement: 'Increase success rate to 95%+'
        });
      }

      // Bottleneck recommendations
      if (metrics.bottleneckSteps.length > 0) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          title: 'Bottleneck Steps Identified',
          description: `Steps causing delays: ${metrics.bottleneckSteps.join(', ')}`,
          impact: 'These steps slow down the entire workflow',
          implementation: 'Optimize these specific steps or add parallel processing',
          estimatedImprovement: '20-40% reduction in execution time'
        });
      }

      // Complexity recommendations
      if (template.steps.length > 15) {
        recommendations.push({
          type: 'usability',
          priority: 'medium',
          title: 'High Complexity',
          description: `Workflow has ${template.steps.length} steps, which may be too complex.`,
          impact: 'Complex workflows are harder to maintain and debug',
          implementation: 'Consider breaking into smaller, reusable sub-workflows',
          estimatedImprovement: 'Improved maintainability and debugging'
        });
      }

      // Usage-based recommendations
      if (metrics.totalExecutions < 10) {
        recommendations.push({
          type: 'usability',
          priority: 'low',
          title: 'Low Usage',
          description: 'This workflow has very low usage, consider if it\'s still needed.',
          impact: 'Unused workflows add maintenance overhead',
          implementation: 'Review with stakeholders and consider archiving if not needed',
          estimatedImprovement: 'Reduced system complexity'
        });
      }

      return recommendations.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      logger.error('Failed to generate optimization recommendations', error, { templateId });
      throw error;
    }
  }

  async getUsageAnalytics(templateId: string, days: number = 30): Promise<WorkflowUsageAnalytics> {
    try {
      const template = await this.repository.findByIdOrThrow(templateId);
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const executions = await this.getExecutionsFromDatabase(templateId, cutoffDate);
      
      // Calculate usage frequency
      const executionsPerDay = executions.length / days;
      let usageFrequency: 'low' | 'medium' | 'high';
      if (executionsPerDay < 1) usageFrequency = 'low';
      else if (executionsPerDay < 10) usageFrequency = 'medium';
      else usageFrequency = 'high';

      // Calculate peak usage hours
      const hourlyUsage = new Array(24).fill(0);
      executions.forEach(exec => {
        const hour = exec.startedAt.getHours();
        hourlyUsage[hour]++;
      });
      const maxUsage = Math.max(...hourlyUsage);
      const peakUsageHours = hourlyUsage
        .map((count, hour) => ({ hour, count }))
        .filter(item => item.count >= maxUsage * 0.8)
        .map(item => item.hour);

      // Get unique users
      const uniqueUsers = new Set(executions.map(e => e.context?.userId).filter(Boolean));
      
      const analytics: WorkflowUsageAnalytics = {
        templateId,
        templateName: template.name,
        category: template.category,
        usageFrequency,
        peakUsageHours,
        triggerTypeDistribution: this.calculateTriggerDistribution(executions),
        userAdoption: {
          totalUsers: uniqueUsers.size,
          activeUsers: uniqueUsers.size, // Simplified - all users in period are active
          newUsers: 0 // Would need historical data to calculate
        },
        stepUtilization: this.calculateStepUtilization(executions, template.steps)
      };

      return analytics;
    } catch (error) {
      logger.error('Failed to get usage analytics', error, { templateId });
      throw error;
    }
  }

  async getSystemWideAnalytics(): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    totalExecutions: number;
    overallSuccessRate: number;
    topPerformingTemplates: { templateId: string; name: string; successRate: number }[];
    mostUsedTemplates: { templateId: string; name: string; executionCount: number }[];
  }> {
    try {
      const templates = await this.repository.findAll();
      const activeTemplates = templates.filter(t => t.isActive);
      
      let totalExecutions = 0;
      let totalSuccessful = 0;
      const templateStats = new Map<string, { executions: number; successful: number; name: string }>();

      for (const template of activeTemplates) {
        const executions = await this.getExecutionsFromDatabase(template.id);
        const successful = executions.filter(e => e.status === 'completed').length;
        
        totalExecutions += executions.length;
        totalSuccessful += successful;
        
        templateStats.set(template.id, {
          executions: executions.length,
          successful,
          name: template.name
        });
      }

      const topPerforming = Array.from(templateStats.entries())
        .map(([id, stats]) => ({
          templateId: id,
          name: stats.name,
          successRate: stats.executions > 0 ? (stats.successful / stats.executions) * 100 : 0
        }))
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 10);

      const mostUsed = Array.from(templateStats.entries())
        .map(([id, stats]) => ({
          templateId: id,
          name: stats.name,
          executionCount: stats.executions
        }))
        .sort((a, b) => b.executionCount - a.executionCount)
        .slice(0, 10);

      return {
        totalTemplates: templates.length,
        activeTemplates: activeTemplates.length,
        totalExecutions,
        overallSuccessRate: totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 0,
        topPerformingTemplates: topPerforming,
        mostUsedTemplates: mostUsed
      };
    } catch (error) {
      logger.error('Failed to get system-wide analytics', error);
      throw error;
    }
  }

  private async getExecutionsFromDatabase(templateId: string, since?: Date): Promise<WorkflowExecution[]> {
    // This would query the database for workflow executions
    // For now, return empty array as we're using in-memory storage
    return [];
  }

  private createEmptyMetrics(templateId: string, templateName: string): WorkflowPerformanceMetrics {
    return {
      templateId,
      templateName,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,
      averageDuration: 0,
      medianDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      averageStepsCompleted: 0,
      bottleneckSteps: [],
      trendsLast30Days: {
        executions: [],
        successRate: [],
        avgDuration: []
      }
    };
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateAverageStepsCompleted(executions: WorkflowExecution[], totalSteps: number): number {
    if (executions.length === 0) return 0;
    
    const stepsCompleted = executions.map(e => Math.min(e.currentStep + 1, totalSteps));
    return stepsCompleted.reduce((sum, steps) => sum + steps, 0) / stepsCompleted.length;
  }

  private findMostFailedStep(failedExecutions: WorkflowExecution[]): string | undefined {
    if (failedExecutions.length === 0) return undefined;
    
    const stepFailures = new Map<number, number>();
    
    failedExecutions.forEach(exec => {
      const step = exec.currentStep;
      stepFailures.set(step, (stepFailures.get(step) || 0) + 1);
    });
    
    let maxFailures = 0;
    let mostFailedStep = 0;
    
    for (const [step, failures] of stepFailures.entries()) {
      if (failures > maxFailures) {
        maxFailures = failures;
        mostFailedStep = step;
      }
    }
    
    return `Step ${mostFailedStep + 1}`;
  }

  private identifyBottleneckSteps(executions: WorkflowExecution[], steps: any[]): string[] {
    // Simplified bottleneck detection - would need more detailed timing data
    const bottlenecks: string[] = [];
    
    // Look for steps that commonly cause long execution times
    const longExecutions = executions.filter(e => 
      e.completedAt && (e.completedAt.getTime() - e.startedAt.getTime()) > 60000 // > 1 minute
    );
    
    if (longExecutions.length > executions.length * 0.3) { // 30% of executions are long
      bottlenecks.push('Multiple steps may have performance issues');
    }
    
    return bottlenecks;
  }

  private calculateTrends(executions: WorkflowExecution[], days: number): {
    executions: number[];
    successRate: number[];
    avgDuration: number[];
  } {
    const trends = {
      executions: new Array(days).fill(0),
      successRate: new Array(days).fill(0),
      avgDuration: new Array(days).fill(0)
    };
    
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayExecutions = executions.filter(e => 
        e.startedAt >= dayStart && e.startedAt < dayEnd
      );
      
      trends.executions[i] = dayExecutions.length;
      
      if (dayExecutions.length > 0) {
        const successful = dayExecutions.filter(e => e.status === 'completed').length;
        trends.successRate[i] = (successful / dayExecutions.length) * 100;
        
        const durations = dayExecutions
          .filter(e => e.completedAt)
          .map(e => e.completedAt!.getTime() - e.startedAt.getTime());
        
        trends.avgDuration[i] = durations.length > 0 
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
          : 0;
      }
    }
    
    return trends;
  }

  private calculateTriggerDistribution(executions: WorkflowExecution[]): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    
    executions.forEach(exec => {
      const triggerType = exec.context?.triggerEvent?.type || 'manual';
      distribution[triggerType] = (distribution[triggerType] || 0) + 1;
    });
    
    return distribution;
  }

  private calculateStepUtilization(executions: WorkflowExecution[], steps: any[]): any[] {
    return steps.map((step, index) => {
      const stepExecutions = executions.filter(e => e.currentStep >= index);
      const stepSuccesses = executions.filter(e => 
        e.currentStep > index || (e.currentStep === index && e.status === 'completed')
      );
      
      return {
        stepId: step.id,
        stepName: step.name,
        executionCount: stepExecutions.length,
        successRate: stepExecutions.length > 0 ? (stepSuccesses.length / stepExecutions.length) * 100 : 0,
        avgDuration: 0 // Would need detailed timing data
      };
    });
  }
}