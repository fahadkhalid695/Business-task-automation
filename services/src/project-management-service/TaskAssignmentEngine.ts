import { 
  TaskAssignmentRequest,
  TaskAssignmentResult,
  TeamMember,
  TaskAssignment,
  AssignmentCriteria,
  SkillMatch,
  AvailabilityStatus
} from './types/ProjectManagementTypes';
import { Task, Priority, TaskStatus } from '../shared/types';
import { logger } from '../shared/utils/logger';

/**
 * TaskAssignmentEngine - Handles automatic task assignment based on team member availability and expertise
 */
export class TaskAssignmentEngine {
  private teamMembers: Map<string, TeamMember>;
  private assignmentHistory: Map<string, TaskAssignment[]>;
  private workloadThresholds: Map<string, number>;

  constructor() {
    this.teamMembers = new Map();
    this.assignmentHistory = new Map();
    this.workloadThresholds = new Map();
    
    logger.info('TaskAssignmentEngine initialized');
  }

  /**
   * Assign tasks to team members based on availability and expertise
   */
  async assignTasks(request: TaskAssignmentRequest): Promise<TaskAssignmentResult> {
    try {
      const assignments: TaskAssignment[] = [];
      const unassignedTasks: Task[] = [];
      const assignmentReasons: string[] = [];

      for (const task of request.tasks) {
        const assignment = await this.findBestAssignment(task, request.criteria);
        
        if (assignment) {
          assignments.push(assignment);
          assignmentReasons.push(`Task ${task.id} assigned to ${assignment.assigneeId} based on ${assignment.reason}`);
          
          // Update team member workload
          await this.updateWorkload(assignment.assigneeId, task);
        } else {
          unassignedTasks.push(task);
          assignmentReasons.push(`Task ${task.id} could not be assigned - no suitable team member found`);
        }
      }

      logger.info(`Task assignment completed: ${assignments.length} assigned, ${unassignedTasks.length} unassigned`);

      return {
        assignments,
        unassignedTasks,
        assignmentReasons,
        totalTasks: request.tasks.length,
        assignmentRate: (assignments.length / request.tasks.length) * 100,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Task assignment failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Find the best team member assignment for a task
   */
  private async findBestAssignment(task: Task, criteria: AssignmentCriteria): Promise<TaskAssignment | null> {
    const availableMembers = await this.getAvailableMembers(task.dueDate);
    
    if (availableMembers.length === 0) {
      return null;
    }

    let bestMember: TeamMember | null = null;
    let bestScore = 0;
    let assignmentReason = '';

    for (const member of availableMembers) {
      const score = await this.calculateAssignmentScore(task, member, criteria);
      
      if (score > bestScore) {
        bestScore = score;
        bestMember = member;
        assignmentReason = await this.generateAssignmentReason(task, member, score);
      }
    }

    if (!bestMember || bestScore < criteria.minimumScore) {
      return null;
    }

    return {
      taskId: task.id,
      assigneeId: bestMember.id,
      assigneeName: bestMember.name,
      assignedAt: new Date(),
      estimatedCompletion: this.calculateEstimatedCompletion(task, bestMember),
      confidence: bestScore,
      reason: assignmentReason,
      skillsMatched: await this.getMatchedSkills(task, bestMember)
    };
  }

  /**
   * Calculate assignment score based on multiple factors
   */
  private async calculateAssignmentScore(task: Task, member: TeamMember, criteria: AssignmentCriteria): Promise<number> {
    let score = 0;

    // Skill matching (40% weight)
    const skillScore = await this.calculateSkillScore(task, member);
    score += skillScore * 0.4;

    // Availability (30% weight)
    const availabilityScore = await this.calculateAvailabilityScore(member, task.dueDate);
    score += availabilityScore * 0.3;

    // Workload balance (20% weight)
    const workloadScore = await this.calculateWorkloadScore(member);
    score += workloadScore * 0.2;

    // Priority handling experience (10% weight)
    const priorityScore = await this.calculatePriorityScore(task, member);
    score += priorityScore * 0.1;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Calculate skill matching score
   */
  private async calculateSkillScore(task: Task, member: TeamMember): Promise<number> {
    const requiredSkills = this.extractRequiredSkills(task);
    const memberSkills = member.skills;

    if (requiredSkills.length === 0) {
      return 50; // Neutral score if no specific skills required
    }

    let matchedSkills = 0;
    let totalSkillLevel = 0;

    for (const requiredSkill of requiredSkills) {
      const memberSkill = memberSkills.find(s => s.name.toLowerCase() === requiredSkill.toLowerCase());
      if (memberSkill) {
        matchedSkills++;
        totalSkillLevel += memberSkill.level;
      }
    }

    const matchPercentage = (matchedSkills / requiredSkills.length) * 100;
    const averageSkillLevel = matchedSkills > 0 ? totalSkillLevel / matchedSkills : 0;

    return (matchPercentage * 0.7) + (averageSkillLevel * 10 * 0.3);
  }

  /**
   * Calculate availability score
   */
  private async calculateAvailabilityScore(member: TeamMember, dueDate?: Date): Promise<number> {
    if (member.availability.status === AvailabilityStatus.UNAVAILABLE) {
      return 0;
    }

    if (member.availability.status === AvailabilityStatus.LIMITED) {
      return 30;
    }

    if (member.availability.status === AvailabilityStatus.AVAILABLE) {
      // Check if due date conflicts with scheduled time off
      if (dueDate && member.availability.scheduledTimeOff) {
        for (const timeOff of member.availability.scheduledTimeOff) {
          if (dueDate >= timeOff.start && dueDate <= timeOff.end) {
            return 20; // Reduced score for conflict
          }
        }
      }
      return 100;
    }

    return 50; // Default score
  }

  /**
   * Calculate workload balance score
   */
  private async calculateWorkloadScore(member: TeamMember): Promise<number> {
    const currentWorkload = member.currentWorkload || 0;
    const maxWorkload = this.workloadThresholds.get(member.id) || 40; // Default 40 hours per week

    const workloadPercentage = (currentWorkload / maxWorkload) * 100;

    if (workloadPercentage >= 100) {
      return 0; // Overloaded
    } else if (workloadPercentage >= 80) {
      return 20; // High workload
    } else if (workloadPercentage >= 60) {
      return 60; // Moderate workload
    } else {
      return 100; // Low workload
    }
  }

  /**
   * Calculate priority handling experience score
   */
  private async calculatePriorityScore(task: Task, member: TeamMember): Promise<number> {
    const memberHistory = this.assignmentHistory.get(member.id) || [];
    
    // Count successful high-priority task completions
    const highPriorityTasks = memberHistory.filter(assignment => 
      assignment.taskPriority === Priority.HIGH || assignment.taskPriority === Priority.URGENT
    );

    if (task.priority === Priority.HIGH || task.priority === Priority.URGENT) {
      return Math.min(highPriorityTasks.length * 10, 100);
    }

    return 50; // Neutral score for normal priority tasks
  }

  /**
   * Extract required skills from task description and type
   */
  private extractRequiredSkills(task: Task): string[] {
    const skills: string[] = [];

    // Extract from task type
    switch (task.type) {
      case 'project_management':
        skills.push('project management', 'planning', 'coordination');
        break;
      default:
        // Extract from description using keywords
        const description = task.description.toLowerCase();
        if (description.includes('frontend') || description.includes('ui')) {
          skills.push('frontend development', 'ui/ux');
        }
        if (description.includes('backend') || description.includes('api')) {
          skills.push('backend development', 'api development');
        }
        if (description.includes('database') || description.includes('sql')) {
          skills.push('database management', 'sql');
        }
        if (description.includes('design') || description.includes('graphics')) {
          skills.push('design', 'graphics');
        }
        break;
    }

    return skills;
  }

  /**
   * Get available team members for a specific date
   */
  private async getAvailableMembers(dueDate?: Date): Promise<TeamMember[]> {
    const availableMembers: TeamMember[] = [];

    for (const member of this.teamMembers.values()) {
      if (member.availability.status !== AvailabilityStatus.UNAVAILABLE) {
        // Check if member is available on due date
        if (!dueDate || await this.isMemberAvailableOnDate(member, dueDate)) {
          availableMembers.push(member);
        }
      }
    }

    return availableMembers;
  }

  /**
   * Check if member is available on a specific date
   */
  private async isMemberAvailableOnDate(member: TeamMember, date: Date): Promise<boolean> {
    if (!member.availability.scheduledTimeOff) {
      return true;
    }

    for (const timeOff of member.availability.scheduledTimeOff) {
      if (date >= timeOff.start && date <= timeOff.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate estimated completion date
   */
  private calculateEstimatedCompletion(task: Task, member: TeamMember): Date {
    const baseEstimate = task.estimatedDuration || 8; // Default 8 hours
    const memberEfficiency = member.efficiency || 1.0;
    const adjustedHours = baseEstimate / memberEfficiency;

    const completionDate = new Date();
    completionDate.setHours(completionDate.getHours() + adjustedHours);

    return completionDate;
  }

  /**
   * Generate assignment reason
   */
  private async generateAssignmentReason(task: Task, member: TeamMember, score: number): Promise<string> {
    const reasons: string[] = [];

    if (score >= 80) {
      reasons.push('excellent skill match');
    } else if (score >= 60) {
      reasons.push('good skill match');
    }

    if (member.availability.status === AvailabilityStatus.AVAILABLE) {
      reasons.push('high availability');
    }

    if (member.currentWorkload && member.currentWorkload < 30) {
      reasons.push('low current workload');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'best available option';
  }

  /**
   * Get matched skills between task and member
   */
  private async getMatchedSkills(task: Task, member: TeamMember): Promise<SkillMatch[]> {
    const requiredSkills = this.extractRequiredSkills(task);
    const matches: SkillMatch[] = [];

    for (const requiredSkill of requiredSkills) {
      const memberSkill = member.skills.find(s => s.name.toLowerCase() === requiredSkill.toLowerCase());
      if (memberSkill) {
        matches.push({
          skillName: memberSkill.name,
          requiredLevel: 1, // Default required level
          memberLevel: memberSkill.level,
          match: memberSkill.level >= 1
        });
      }
    }

    return matches;
  }

  /**
   * Update team member workload after assignment
   */
  private async updateWorkload(memberId: string, task: Task): Promise<void> {
    const member = this.teamMembers.get(memberId);
    if (member) {
      const taskHours = task.estimatedDuration || 8;
      member.currentWorkload = (member.currentWorkload || 0) + taskHours;
      this.teamMembers.set(memberId, member);
    }
  }

  /**
   * Update team member information
   */
  async updateTeamMember(memberId: string, member: TeamMember): Promise<void> {
    this.teamMembers.set(memberId, member);
    logger.info(`Team member updated: ${member.name}`, { memberId });
  }

  /**
   * Set workload threshold for a team member
   */
  async setWorkloadThreshold(memberId: string, threshold: number): Promise<void> {
    this.workloadThresholds.set(memberId, threshold);
    logger.info(`Workload threshold set for member ${memberId}: ${threshold} hours`);
  }

  /**
   * Get health status of the task assignment engine
   */
  async getHealthStatus(): Promise<any> {
    return {
      component: 'TaskAssignmentEngine',
      status: 'healthy',
      teamMembersCount: this.teamMembers.size,
      assignmentHistoryCount: this.assignmentHistory.size,
      lastAssignment: new Date().toISOString()
    };
  }
}