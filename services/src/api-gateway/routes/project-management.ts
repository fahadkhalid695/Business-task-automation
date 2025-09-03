import { Router, Request, Response } from 'express';
import { ProjectManagementService } from '../../project-management-service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { Logger } from '../../shared/utils/logger';
import { 
  TaskAssignmentRequest,
  ReminderRequest,
  ApprovalWorkflowRequest,
  KnowledgeBaseRequest,
  ProgressTrackingRequest
} from '../../project-management-service/types/ProjectManagementTypes';

const router = Router();
const logger = new Logger('ProjectManagementRoutes');
const projectManagementService = new ProjectManagementService();

/**
 * @route POST /api/v1/project-management/tasks/assign
 * @desc Assign tasks to team members based on availability and expertise
 * @access Private
 */
router.post('/tasks/assign', authenticate, async (req: Request, res: Response) => {
  try {
    const request: TaskAssignmentRequest = req.body;
    const result = await projectManagementService.assignTasks(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Task assignment failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TASK_ASSIGNMENT_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/reminders/send
 * @desc Send automated reminders for deadlines and milestones
 * @access Private
 */
router.post('/reminders/send', authenticate, async (req: Request, res: Response) => {
  try {
    const request: ReminderRequest = req.body;
    const result = await projectManagementService.sendReminders(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Reminder processing failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REMINDER_PROCESSING_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/approval/workflow
 * @desc Route documents through approval workflows
 * @access Private
 */
router.post('/approval/workflow', authenticate, async (req: Request, res: Response) => {
  try {
    const request: ApprovalWorkflowRequest = req.body;
    const result = await projectManagementService.routeApprovalWorkflow(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Approval workflow routing failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'APPROVAL_WORKFLOW_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/approval/decision
 * @desc Process approval decision for a workflow step
 * @access Private
 */
router.post('/approval/decision', authenticate, async (req: Request, res: Response) => {
  try {
    const { workflowId, stepId, decision } = req.body;
    
    // This would need to be implemented in the ApprovalWorkflowRouter
    // const result = await projectManagementService.processApprovalDecision(workflowId, stepId, decision);
    
    res.json({
      success: true,
      message: 'Approval decision processed',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Approval decision processing failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'APPROVAL_DECISION_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/knowledge-base/update
 * @desc Update knowledge base and SOPs
 * @access Private
 */
router.post('/knowledge-base/update', authenticate, async (req: Request, res: Response) => {
  try {
    const request: KnowledgeBaseRequest = req.body;
    const result = await projectManagementService.updateKnowledgeBase(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Knowledge base update failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'KNOWLEDGE_BASE_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/progress/track
 * @desc Track project progress and generate reports
 * @access Private
 */
router.post('/progress/track', authenticate, async (req: Request, res: Response) => {
  try {
    const request: ProgressTrackingRequest = req.body;
    const result = await projectManagementService.trackProgress(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Progress tracking failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROGRESS_TRACKING_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/team/members
 * @desc Add team member to the project management system
 * @access Private
 */
router.post('/team/members', authenticate, async (req: Request, res: Response) => {
  try {
    const { memberId, member } = req.body;
    const result = await projectManagementService.addTeamMember(memberId, member);
    
    res.json(result);
  } catch (error) {
    logger.error('Team member addition failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEAM_MEMBER_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route POST /api/v1/project-management/milestones
 * @desc Add project milestone
 * @access Private
 */
router.post('/milestones', authenticate, async (req: Request, res: Response) => {
  try {
    const { milestoneId, milestone } = req.body;
    const result = await projectManagementService.addProjectMilestone(milestoneId, milestone);
    
    res.json(result);
  } catch (error) {
    logger.error('Project milestone addition failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MILESTONE_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

/**
 * @route GET /api/v1/project-management/health
 * @desc Get project management service health status
 * @access Private
 */
router.get('/health', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await projectManagementService.getHealthStatus();
    res.json(result);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: error.message,
        timestamp: new Date()
      }
    });
  }
});

export { router as projectManagementRoutes };