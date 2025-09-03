import { TaskAssignmentEngine } from './TaskAssignmentEngine';
import { ReminderNotificationSystem } from './ReminderNotificationSystem';
import { ApprovalWorkflowRouter } from './ApprovalWorkflowRouter';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';
import { ProgressTracker } from './ProgressTracker';
import { 
  ProjectManagementRequest,
  ProjectManagementResult,
  TaskAssignmentRequest,
  TaskAssignmentResult,
  ReminderRequest,
  ReminderResult,
  ApprovalWorkflowRequest,
  ApprovalWorkflowResult,
  KnowledgeBaseRequest,
  KnowledgeBaseResult,
  ProgressTrackingRequest,
  ProgressTrackingResult,
  ServiceResponse,
  TeamMember,
  ProjectMilestone
} from './types/ProjectManagementTypes';
import { logger } from '../shared/utils/logger';
import { Task, TaskStatus, TaskType, User, WorkflowTemplate } from '../shared/types';

/**
 * ProjectManagementService - Main service class for handling project management tasks
 * Coordinates task assignment, reminders, approval workflows, knowledge base updates, and progress tracking
 */
export class ProjectManagementService {
  private taskAssignmentEngine: TaskAssignmentEngine;
  private reminderNotificationSystem: ReminderNotificationSystem;
  private approvalWorkflowRouter: ApprovalWorkflowRouter;
  private knowledgeBaseManager: KnowledgeBaseManager;
  private progressTracker: ProgressTracker;
  private teamMembers: Map<string, TeamMember>;
  private projectMilestones: Map<string, ProjectMilestone>;

  constructor() {
    this.taskAssignmentEngine = new TaskAssignmentEngine();
    this.reminderNotificationSystem = new ReminderNotificationSystem();
    this.approvalWorkflowRouter = new ApprovalWorkflowRouter();
    this.knowledgeBaseManager = new KnowledgeBaseManager();
    this.progressTracker = new ProgressTracker();
    this.teamMembers = new Map();
    this.projectMilestones = new Map();
    
    logger.info('ProjectManagementService initialized');
  }

  /**
   * Assign tasks automatically based on team member availability and expertise
   */
  async assignTasks(request: TaskAssignmentRequest): Promise<ServiceResponse<TaskAssignmentResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Assigning ${request.tasks.length} tasks`, { requestId });

      const result = await this.taskAssignmentEngine.assignTasks(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Task assignment completed in ${processingTime}ms`, { 
        requestId, 
        taskCount: request.tasks.length,
        assignedCount: result.assignments.length
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Task assignment failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'TASK_ASSIGNMENT_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Send automated reminders for deadlines and milestones
   */
  async sendReminders(request: ReminderRequest): Promise<ServiceResponse<ReminderResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Processing reminder request for ${request.type}`, { requestId });

      const result = await this.reminderNotificationSystem.processReminders(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Reminder processing completed in ${processingTime}ms`, { 
        requestId, 
        reminderType: request.type,
        notificationsSent: result.notificationsSent
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Reminder processing failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'REMINDER_PROCESSING_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Route documents through approval workflows with proper approval chains
   */
  async routeApprovalWorkflow(request: ApprovalWorkflowRequest): Promise<ServiceResponse<ApprovalWorkflowResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Routing approval workflow: ${request.workflowType}`, { requestId });

      const result = await this.approvalWorkflowRouter.routeWorkflow(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Approval workflow routing completed in ${processingTime}ms`, { 
        requestId, 
        workflowType: request.workflowType,
        approversCount: result.approvers.length
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Approval workflow routing failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'APPROVAL_WORKFLOW_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Update knowledge base and SOPs automatically
   */
  async updateKnowledgeBase(request: KnowledgeBaseRequest): Promise<ServiceResponse<KnowledgeBaseResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Updating knowledge base: ${request.updateType}`, { requestId });

      const result = await this.knowledgeBaseManager.updateKnowledgeBase(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Knowledge base update completed in ${processingTime}ms`, { 
        requestId, 
        updateType: request.updateType,
        documentsUpdated: result.documentsUpdated
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Knowledge base update failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'KNOWLEDGE_BASE_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Track project progress and generate milestone reports
   */
  async trackProgress(request: ProgressTrackingRequest): Promise<ServiceResponse<ProgressTrackingResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Tracking progress for project: ${request.projectId}`, { requestId });

      const result = await this.progressTracker.trackProgress(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Progress tracking completed in ${processingTime}ms`, { 
        requestId, 
        projectId: request.projectId,
        completionPercentage: result.completionPercentage
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Progress tracking failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'PROGRESS_TRACKING_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Add team member to the project management system
   */
  async addTeamMember(memberId: string, member: TeamMember): Promise<ServiceResponse<void>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Adding team member: ${member.name}`, { requestId, memberId });

      this.teamMembers.set(memberId, member);

      // Update task assignment engine with new team member
      await this.taskAssignmentEngine.updateTeamMember(memberId, member);

      const processingTime = Date.now() - startTime;
      logger.info(`Team member added successfully in ${processingTime}ms`, { 
        requestId, 
        memberId,
        memberName: member.name
      });

      return {
        success: true,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Team member addition failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'TEAM_MEMBER_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Add project milestone
   */
  async addProjectMilestone(milestoneId: string, milestone: ProjectMilestone): Promise<ServiceResponse<void>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Adding project milestone: ${milestone.name}`, { requestId, milestoneId });

      this.projectMilestones.set(milestoneId, milestone);

      // Update progress tracker with new milestone
      await this.progressTracker.updateMilestone(milestoneId, milestone);

      const processingTime = Date.now() - startTime;
      logger.info(`Project milestone added successfully in ${processingTime}ms`, { 
        requestId, 
        milestoneId,
        milestoneName: milestone.name
      });

      return {
        success: true,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Project milestone addition failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'MILESTONE_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<ServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const status = {
        service: 'ProjectManagementService',
        status: 'healthy',
        components: {
          taskAssignmentEngine: await this.taskAssignmentEngine.getHealthStatus(),
          reminderNotificationSystem: await this.reminderNotificationSystem.getHealthStatus(),
          approvalWorkflowRouter: await this.approvalWorkflowRouter.getHealthStatus(),
          knowledgeBaseManager: await this.knowledgeBaseManager.getHealthStatus(),
          progressTracker: await this.progressTracker.getHealthStatus()
        },
        teamMembersCount: this.teamMembers.size,
        milestonesCount: this.projectMilestones.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: status,
        metadata: {
          processingTime,
          requestId: this.generateRequestId(),
          version: '1.0.0'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Health check failed', { error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId: this.generateRequestId(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `pm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}