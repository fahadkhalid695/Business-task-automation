import { 
  ProgressTrackingRequest,
  ProgressTrackingResult,
  ProjectMilestone,
  ProgressMetrics,
  MilestoneStatus,
  ProgressReport,
  TaskProgress,
  ProjectHealth,
  RiskAssessment
} from './types/ProjectManagementTypes';
import { Task, Priority, TaskStatus } from '../shared/types';
import { logger } from '../shared/utils/logger';

/**
 * ProgressTracker - Handles progress tracking and milestone reporting for projects
 */
export class ProgressTracker {
  private projectMilestones: Map<string, ProjectMilestone>;
  private progressHistory: Map<string, ProgressMetrics[]>;
  private taskProgress: Map<string, TaskProgress>;
  private projectHealth: Map<string, ProjectHealth>;

  constructor() {
    this.projectMilestones = new Map();
    this.progressHistory = new Map();
    this.taskProgress = new Map();
    this.projectHealth = new Map();
    
    logger.info('ProgressTracker initialized');
  }

  /**
   * Track progress for a project and generate reports
   */
  async trackProgress(request: ProgressTrackingRequest): Promise<ProgressTrackingResult> {
    try {
      const projectId = request.projectId;
      
      // Calculate current progress metrics
      const progressMetrics = await this.calculateProgressMetrics(request);
      
      // Update milestone statuses
      const milestoneUpdates = await this.updateMilestoneStatuses(projectId, request.tasks);
      
      // Generate progress report
      const progressReport = await this.generateProgressReport(projectId, progressMetrics, milestoneUpdates);
      
      // Assess project health and risks
      const healthAssessment = await this.assessProjectHealth(projectId, progressMetrics, request.tasks);
      
      // Store progress history
      await this.storeProgressHistory(projectId, progressMetrics);
      
      // Calculate completion percentage
      const completionPercentage = this.calculateCompletionPercentage(progressMetrics);
      
      // Identify next steps and recommendations
      const nextSteps = await this.identifyNextSteps(projectId, progressMetrics, request.tasks);
      
      logger.info(`Progress tracking completed for project: ${projectId}`, { 
        completionPercentage,
        milestonesCompleted: milestoneUpdates.completed.length,
        tasksCompleted: progressMetrics.tasksCompleted
      });

      return {
        projectId,
        completionPercentage,
        progressMetrics,
        milestoneUpdates,
        progressReport,
        healthAssessment,
        nextSteps,
        recommendations: await this.generateRecommendations(healthAssessment, progressMetrics),
        trackedAt: new Date(),
        nextTrackingDate: this.calculateNextTrackingDate(projectId)
      };
    } catch (error) {
      logger.error('Progress tracking failed', { error: error.message, projectId: request.projectId });
      throw error;
    }
  }

  /**
   * Calculate comprehensive progress metrics
   */
  private async calculateProgressMetrics(request: ProgressTrackingRequest): Promise<ProgressMetrics> {
    const tasks = request.tasks || [];
    const totalTasks = tasks.length;
    
    if (totalTasks === 0) {
      return this.getEmptyProgressMetrics();
    }

    const tasksCompleted = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const tasksInProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const tasksPending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const tasksFailed = tasks.filter(t => t.status === TaskStatus.FAILED).length;
    const tasksOverdue = tasks.filter(t => this.isTaskOverdue(t)).length;

    // Calculate time-based metrics
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0);
    const totalActualHours = tasks
      .filter(t => t.actualDuration)
      .reduce((sum, t) => sum + (t.actualDuration || 0), 0);

    // Calculate velocity (tasks completed per time period)
    const velocity = await this.calculateVelocity(request.projectId, tasks);

    // Calculate quality metrics
    const qualityScore = await this.calculateQualityScore(tasks);

    // Calculate budget metrics if available
    const budgetMetrics = await this.calculateBudgetMetrics(request.projectId, tasks);

    return {
      totalTasks,
      tasksCompleted,
      tasksInProgress,
      tasksPending,
      tasksFailed,
      tasksOverdue,
      completionRate: (tasksCompleted / totalTasks) * 100,
      totalEstimatedHours,
      totalActualHours,
      hoursVariance: totalActualHours - totalEstimatedHours,
      velocity,
      qualityScore,
      budgetMetrics,
      lastCalculated: new Date()
    };
  }

  /**
   * Update milestone statuses based on task progress
   */
  private async updateMilestoneStatuses(projectId: string, tasks: Task[]): Promise<{ completed: ProjectMilestone[], upcoming: ProjectMilestone[], overdue: ProjectMilestone[] }> {
    const result = {
      completed: [] as ProjectMilestone[],
      upcoming: [] as ProjectMilestone[],
      overdue: [] as ProjectMilestone[]
    };

    const projectMilestones = Array.from(this.projectMilestones.values())
      .filter(m => m.projectId === projectId);

    for (const milestone of projectMilestones) {
      const milestoneProgress = await this.calculateMilestoneProgress(milestone, tasks);
      
      // Update milestone status
      const previousStatus = milestone.status;
      milestone.status = this.determineMilestoneStatus(milestone, milestoneProgress);
      milestone.progressPercentage = milestoneProgress.completionPercentage;
      milestone.lastUpdated = new Date();

      // Categorize milestone
      if (milestone.status === MilestoneStatus.COMPLETED && previousStatus !== MilestoneStatus.COMPLETED) {
        result.completed.push(milestone);
      } else if (milestone.status === MilestoneStatus.OVERDUE) {
        result.overdue.push(milestone);
      } else if (this.isMilestoneUpcoming(milestone)) {
        result.upcoming.push(milestone);
      }

      // Update milestone in storage
      this.projectMilestones.set(milestone.id, milestone);
    }

    return result;
  }

  /**
   * Generate comprehensive progress report
   */
  private async generateProgressReport(projectId: string, metrics: ProgressMetrics, milestoneUpdates: any): Promise<ProgressReport> {
    const previousMetrics = await this.getPreviousMetrics(projectId);
    const trends = this.calculateTrends(metrics, previousMetrics);
    
    return {
      projectId,
      reportDate: new Date(),
      executiveSummary: this.generateExecutiveSummary(metrics, milestoneUpdates),
      keyMetrics: {
        completionRate: metrics.completionRate,
        velocity: metrics.velocity,
        qualityScore: metrics.qualityScore,
        budgetUtilization: metrics.budgetMetrics?.utilizationPercentage || 0
      },
      milestoneStatus: {
        completed: milestoneUpdates.completed.length,
        upcoming: milestoneUpdates.upcoming.length,
        overdue: milestoneUpdates.overdue.length
      },
      trends,
      achievements: this.identifyAchievements(metrics, milestoneUpdates),
      challenges: this.identifyCurrentChallenges(metrics, milestoneUpdates),
      recommendations: await this.generateProgressRecommendations(metrics, trends)
    };
  }

  /**
   * Assess project health and identify risks
   */
  private async assessProjectHealth(projectId: string, metrics: ProgressMetrics, tasks: Task[]): Promise<ProjectHealth> {
    const riskAssessment = await this.performRiskAssessment(projectId, metrics, tasks);
    const healthScore = this.calculateHealthScore(metrics, riskAssessment);
    
    return {
      projectId,
      overallHealth: this.determineHealthStatus(healthScore),
      healthScore,
      riskAssessment,
      criticalIssues: this.identifyCriticalIssues(metrics, riskAssessment),
      recommendations: this.generateHealthRecommendations(riskAssessment),
      assessedAt: new Date()
    };
  }

  /**
   * Calculate milestone progress based on associated tasks
   */
  private async calculateMilestoneProgress(milestone: ProjectMilestone, tasks: Task[]): Promise<{ completionPercentage: number, tasksCompleted: number, totalTasks: number }> {
    const milestoneTasks = tasks.filter(t => 
      milestone.associatedTasks && milestone.associatedTasks.includes(t.id)
    );

    if (milestoneTasks.length === 0) {
      return { completionPercentage: 0, tasksCompleted: 0, totalTasks: 0 };
    }

    const completedTasks = milestoneTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const completionPercentage = (completedTasks / milestoneTasks.length) * 100;

    return {
      completionPercentage,
      tasksCompleted: completedTasks,
      totalTasks: milestoneTasks.length
    };
  }

  /**
   * Determine milestone status based on progress and dates
   */
  private determineMilestoneStatus(milestone: ProjectMilestone, progress: { completionPercentage: number }): MilestoneStatus {
    const now = new Date();
    
    if (progress.completionPercentage >= 100) {
      return MilestoneStatus.COMPLETED;
    } else if (milestone.dueDate && now > milestone.dueDate) {
      return MilestoneStatus.OVERDUE;
    } else if (progress.completionPercentage > 0) {
      return MilestoneStatus.IN_PROGRESS;
    } else {
      return MilestoneStatus.NOT_STARTED;
    }
  }

  /**
   * Check if milestone is upcoming (within next 7 days)
   */
  private isMilestoneUpcoming(milestone: ProjectMilestone): boolean {
    if (!milestone.dueDate) return false;
    
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);
    
    return milestone.dueDate >= now && milestone.dueDate <= sevenDaysFromNow;
  }

  /**
   * Check if task is overdue
   */
  private isTaskOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === TaskStatus.COMPLETED) {
      return false;
    }
    
    return new Date() > task.dueDate;
  }

  /**
   * Calculate team velocity (tasks completed per week)
   */
  private async calculateVelocity(projectId: string, tasks: Task[]): Promise<number> {
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED && t.completedAt);
    
    if (completedTasks.length === 0) return 0;

    // Calculate velocity over the last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const recentCompletedTasks = completedTasks.filter(t => 
      t.completedAt && t.completedAt >= fourWeeksAgo
    );

    return recentCompletedTasks.length / 4; // Tasks per week
  }

  /**
   * Calculate quality score based on task outcomes
   */
  private async calculateQualityScore(tasks: Task[]): Promise<number> {
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    
    if (completedTasks.length === 0) return 0;

    let qualityPoints = 0;
    let totalPoints = 0;

    for (const task of completedTasks) {
      totalPoints += 100;

      // Points for completing on time
      if (task.dueDate && task.completedAt && task.completedAt <= task.dueDate) {
        qualityPoints += 30;
      }

      // Points for completing within estimated duration
      if (task.estimatedDuration && task.actualDuration && task.actualDuration <= task.estimatedDuration) {
        qualityPoints += 30;
      }

      // Points for not being failed/cancelled
      if (task.status === TaskStatus.COMPLETED) {
        qualityPoints += 40;
      }
    }

    return totalPoints > 0 ? (qualityPoints / totalPoints) * 100 : 0;
  }

  /**
   * Calculate budget-related metrics
   */
  private async calculateBudgetMetrics(projectId: string, tasks: Task[]): Promise<any> {
    // Mock implementation - would integrate with financial systems
    return {
      budgetAllocated: 100000,
      budgetSpent: 65000,
      utilizationPercentage: 65,
      projectedOverrun: 0,
      costPerTask: 1000
    };
  }

  /**
   * Perform comprehensive risk assessment
   */
  private async performRiskAssessment(projectId: string, metrics: ProgressMetrics, tasks: Task[]): Promise<RiskAssessment> {
    const risks: any[] = [];

    // Schedule risk
    if (metrics.tasksOverdue > 0) {
      risks.push({
        type: 'schedule',
        severity: metrics.tasksOverdue > 5 ? 'high' : 'medium',
        description: `${metrics.tasksOverdue} tasks are overdue`,
        impact: 'Project timeline may be delayed',
        mitigation: 'Reassign resources or adjust timeline'
      });
    }

    // Quality risk
    if (metrics.qualityScore < 70) {
      risks.push({
        type: 'quality',
        severity: 'medium',
        description: 'Quality score below acceptable threshold',
        impact: 'Deliverables may not meet standards',
        mitigation: 'Implement additional quality checks'
      });
    }

    // Resource risk
    if (metrics.velocity < 2) {
      risks.push({
        type: 'resource',
        severity: 'medium',
        description: 'Team velocity is below expected rate',
        impact: 'Project may not complete on time',
        mitigation: 'Add resources or reduce scope'
      });
    }

    // Budget risk
    if (metrics.budgetMetrics && metrics.budgetMetrics.utilizationPercentage > 80) {
      risks.push({
        type: 'budget',
        severity: 'high',
        description: 'Budget utilization exceeds 80%',
        impact: 'Project may exceed budget',
        mitigation: 'Review spending and optimize costs'
      });
    }

    return {
      overallRiskLevel: this.calculateOverallRiskLevel(risks),
      risks,
      riskScore: this.calculateRiskScore(risks),
      assessedAt: new Date()
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(metrics: ProgressMetrics, riskAssessment: RiskAssessment): number {
    let score = 100;

    // Deduct points for overdue tasks
    score -= metrics.tasksOverdue * 5;

    // Deduct points for failed tasks
    score -= metrics.tasksFailed * 10;

    // Deduct points for low quality
    if (metrics.qualityScore < 70) {
      score -= (70 - metrics.qualityScore);
    }

    // Deduct points for high risk
    score -= riskAssessment.riskScore;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine health status from score
   */
  private determineHealthStatus(healthScore: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (healthScore >= 90) return 'excellent';
    if (healthScore >= 75) return 'good';
    if (healthScore >= 60) return 'fair';
    if (healthScore >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Calculate completion percentage
   */
  private calculateCompletionPercentage(metrics: ProgressMetrics): number {
    return metrics.completionRate;
  }

  /**
   * Identify next steps based on current progress
   */
  private async identifyNextSteps(projectId: string, metrics: ProgressMetrics, tasks: Task[]): Promise<string[]> {
    const nextSteps: string[] = [];

    // Identify high-priority pending tasks
    const highPriorityPending = tasks.filter(t => 
      t.status === TaskStatus.PENDING && 
      (t.priority === Priority.HIGH || t.priority === Priority.URGENT)
    );

    if (highPriorityPending.length > 0) {
      nextSteps.push(`Start ${highPriorityPending.length} high-priority pending tasks`);
    }

    // Identify overdue tasks
    if (metrics.tasksOverdue > 0) {
      nextSteps.push(`Address ${metrics.tasksOverdue} overdue tasks immediately`);
    }

    // Identify upcoming milestones
    const upcomingMilestones = Array.from(this.projectMilestones.values())
      .filter(m => m.projectId === projectId && this.isMilestoneUpcoming(m));

    if (upcomingMilestones.length > 0) {
      nextSteps.push(`Prepare for ${upcomingMilestones.length} upcoming milestones`);
    }

    return nextSteps;
  }

  /**
   * Generate recommendations based on health assessment
   */
  private async generateRecommendations(healthAssessment: ProjectHealth, metrics: ProgressMetrics): Promise<string[]> {
    const recommendations: string[] = [];

    if (healthAssessment.overallHealth === 'poor' || healthAssessment.overallHealth === 'critical') {
      recommendations.push('Consider project intervention or scope adjustment');
    }

    if (metrics.velocity < 2) {
      recommendations.push('Increase team capacity or reduce task complexity');
    }

    if (metrics.qualityScore < 70) {
      recommendations.push('Implement additional quality assurance measures');
    }

    if (metrics.tasksOverdue > 0) {
      recommendations.push('Prioritize overdue tasks and reassign resources if needed');
    }

    return recommendations;
  }

  /**
   * Store progress history for trend analysis
   */
  private async storeProgressHistory(projectId: string, metrics: ProgressMetrics): Promise<void> {
    const history = this.progressHistory.get(projectId) || [];
    history.push(metrics);
    
    // Keep only last 30 entries
    if (history.length > 30) {
      history.splice(0, history.length - 30);
    }
    
    this.progressHistory.set(projectId, history);
  }

  /**
   * Calculate next tracking date
   */
  private calculateNextTrackingDate(projectId: string): Date {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1); // Daily tracking by default
    return nextDate;
  }

  /**
   * Update milestone information
   */
  async updateMilestone(milestoneId: string, milestone: ProjectMilestone): Promise<void> {
    this.projectMilestones.set(milestoneId, milestone);
    logger.info(`Milestone updated: ${milestone.name}`, { milestoneId });
  }

  // Helper methods with mock implementations
  private getEmptyProgressMetrics(): ProgressMetrics {
    return {
      totalTasks: 0,
      tasksCompleted: 0,
      tasksInProgress: 0,
      tasksPending: 0,
      tasksFailed: 0,
      tasksOverdue: 0,
      completionRate: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      hoursVariance: 0,
      velocity: 0,
      qualityScore: 0,
      budgetMetrics: null,
      lastCalculated: new Date()
    };
  }

  private async getPreviousMetrics(projectId: string): Promise<ProgressMetrics | null> {
    const history = this.progressHistory.get(projectId);
    return history && history.length > 1 ? history[history.length - 2] : null;
  }

  private calculateTrends(current: ProgressMetrics, previous: ProgressMetrics | null): any {
    if (!previous) {
      return { completionRate: 0, velocity: 0, qualityScore: 0 };
    }

    return {
      completionRate: current.completionRate - previous.completionRate,
      velocity: current.velocity - previous.velocity,
      qualityScore: current.qualityScore - previous.qualityScore
    };
  }

  private generateExecutiveSummary(metrics: ProgressMetrics, milestoneUpdates: any): string {
    return `Project is ${metrics.completionRate.toFixed(1)}% complete with ${metrics.tasksCompleted} of ${metrics.totalTasks} tasks finished. ${milestoneUpdates.completed.length} milestones completed this period.`;
  }

  private identifyAchievements(metrics: ProgressMetrics, milestoneUpdates: any): string[] {
    const achievements: string[] = [];
    
    if (milestoneUpdates.completed.length > 0) {
      achievements.push(`Completed ${milestoneUpdates.completed.length} milestone(s)`);
    }
    
    if (metrics.qualityScore > 80) {
      achievements.push('Maintained high quality standards');
    }
    
    return achievements;
  }

  private identifyCurrentChallenges(metrics: ProgressMetrics, milestoneUpdates: any): string[] {
    const challenges: string[] = [];
    
    if (metrics.tasksOverdue > 0) {
      challenges.push(`${metrics.tasksOverdue} tasks are overdue`);
    }
    
    if (milestoneUpdates.overdue.length > 0) {
      challenges.push(`${milestoneUpdates.overdue.length} milestone(s) are overdue`);
    }
    
    return challenges;
  }

  private async generateProgressRecommendations(metrics: ProgressMetrics, trends: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (trends.velocity < 0) {
      recommendations.push('Team velocity is declining - consider addressing blockers');
    }
    
    if (metrics.completionRate < 50 && metrics.tasksOverdue > 0) {
      recommendations.push('Focus on completing overdue tasks to get back on track');
    }
    
    return recommendations;
  }

  private identifyCriticalIssues(metrics: ProgressMetrics, riskAssessment: RiskAssessment): string[] {
    return riskAssessment.risks
      .filter(risk => risk.severity === 'high')
      .map(risk => risk.description);
  }

  private generateHealthRecommendations(riskAssessment: RiskAssessment): string[] {
    return riskAssessment.risks.map(risk => risk.mitigation);
  }

  private calculateOverallRiskLevel(risks: any[]): 'low' | 'medium' | 'high' | 'critical' {
    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;
    
    if (highRisks >= 2) return 'critical';
    if (highRisks >= 1) return 'high';
    if (mediumRisks >= 2) return 'medium';
    return 'low';
  }

  private calculateRiskScore(risks: any[]): number {
    return risks.reduce((score, risk) => {
      switch (risk.severity) {
        case 'high': return score + 20;
        case 'medium': return score + 10;
        case 'low': return score + 5;
        default: return score;
      }
    }, 0);
  }

  /**
   * Get health status of the progress tracker
   */
  async getHealthStatus(): Promise<any> {
    return {
      component: 'ProgressTracker',
      status: 'healthy',
      projectMilestonesCount: this.projectMilestones.size,
      progressHistoryCount: this.progressHistory.size,
      taskProgressCount: this.taskProgress.size,
      projectHealthCount: this.projectHealth.size,
      lastTracked: new Date().toISOString()
    };
  }
}