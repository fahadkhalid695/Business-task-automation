import { 
  ApprovalWorkflowRequest,
  ApprovalWorkflowResult,
  ApprovalChain,
  ApprovalStep,
  ApprovalRule,
  WorkflowType,
  ApprovalStatus,
  ApprovalDecision
} from './types/ProjectManagementTypes';
import { Document, User, Priority } from '../shared/types';
import { logger } from '../shared/utils/logger';

/**
 * ApprovalWorkflowRouter - Handles approval workflow routing mechanisms with proper approval chains
 */
export class ApprovalWorkflowRouter {
  private approvalRules: Map<WorkflowType, ApprovalRule>;
  private activeWorkflows: Map<string, ApprovalChain>;
  private approvalHistory: Map<string, ApprovalDecision[]>;
  private escalationRules: Map<string, any>;

  constructor() {
    this.approvalRules = new Map();
    this.activeWorkflows = new Map();
    this.approvalHistory = new Map();
    this.escalationRules = new Map();
    
    this.initializeDefaultRules();
    
    logger.info('ApprovalWorkflowRouter initialized');
  }

  /**
   * Route workflow through appropriate approval chain
   */
  async routeWorkflow(request: ApprovalWorkflowRequest): Promise<ApprovalWorkflowResult> {
    try {
      const workflowId = this.generateWorkflowId();
      
      // Get approval rule for workflow type
      const rule = this.getApprovalRule(request.workflowType, request.document);
      
      if (!rule) {
        throw new Error(`No approval rule found for workflow type: ${request.workflowType}`);
      }

      // Create approval chain
      const approvalChain = await this.createApprovalChain(rule, request);
      
      // Start the workflow
      const result = await this.startWorkflow(workflowId, approvalChain, request);

      logger.info(`Approval workflow routed: ${workflowId}`, { 
        workflowType: request.workflowType,
        approversCount: approvalChain.steps.length
      });

      return result;
    } catch (error) {
      logger.error('Approval workflow routing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process approval decision
   */
  async processApprovalDecision(workflowId: string, stepId: string, decision: ApprovalDecision): Promise<ApprovalWorkflowResult> {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Find the current step
      const currentStep = workflow.steps.find(step => step.id === stepId);
      
      if (!currentStep) {
        throw new Error(`Approval step not found: ${stepId}`);
      }

      // Update step with decision
      currentStep.status = decision.approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
      currentStep.approvedAt = new Date();
      currentStep.comments = decision.comments;
      currentStep.approvedBy = decision.approverId;

      // Record decision in history
      this.recordApprovalDecision(workflowId, decision);

      // Determine next action
      if (decision.approved) {
        return await this.processApproval(workflowId, workflow);
      } else {
        return await this.processRejection(workflowId, workflow, decision);
      }
    } catch (error) {
      logger.error('Approval decision processing failed', { error: error.message, workflowId });
      throw error;
    }
  }

  /**
   * Get approval rule based on workflow type and document
   */
  private getApprovalRule(workflowType: WorkflowType, document: Document): ApprovalRule | null {
    const rule = this.approvalRules.get(workflowType);
    
    if (!rule) {
      return null;
    }

    // Apply conditional logic based on document properties
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, document)) {
          continue;
        }
      }
    }

    return rule;
  }

  /**
   * Create approval chain based on rule and request
   */
  private async createApprovalChain(rule: ApprovalRule, request: ApprovalWorkflowRequest): Promise<ApprovalChain> {
    const steps: ApprovalStep[] = [];
    
    for (let i = 0; i < rule.approvers.length; i++) {
      const approver = rule.approvers[i];
      
      const step: ApprovalStep = {
        id: `step-${i + 1}`,
        order: i + 1,
        approverId: approver.userId,
        approverName: approver.name,
        approverRole: approver.role,
        status: ApprovalStatus.PENDING,
        isRequired: approver.isRequired,
        timeoutHours: approver.timeoutHours || rule.defaultTimeoutHours || 48,
        createdAt: new Date()
      };

      steps.push(step);
    }

    return {
      id: this.generateWorkflowId(),
      workflowType: request.workflowType,
      documentId: request.document.id,
      requesterId: request.requesterId,
      steps,
      currentStepIndex: 0,
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
      priority: this.determineWorkflowPriority(request.document),
      escalationLevel: 0
    };
  }

  /**
   * Start approval workflow
   */
  private async startWorkflow(workflowId: string, chain: ApprovalChain, request: ApprovalWorkflowRequest): Promise<ApprovalWorkflowResult> {
    // Store active workflow
    this.activeWorkflows.set(workflowId, chain);

    // Send notification to first approver
    await this.notifyApprover(chain.steps[0], chain, request.document);

    // Set up timeout monitoring
    await this.scheduleTimeoutCheck(workflowId, chain.steps[0]);

    return {
      workflowId,
      status: ApprovalStatus.PENDING,
      currentStep: chain.steps[0],
      approvers: chain.steps.map(step => ({
        id: step.approverId,
        name: step.approverName,
        role: step.approverRole,
        status: step.status,
        order: step.order
      })),
      estimatedCompletion: this.calculateEstimatedCompletion(chain),
      nextAction: 'Waiting for approval from ' + chain.steps[0].approverName,
      createdAt: chain.createdAt
    };
  }

  /**
   * Process approval and move to next step
   */
  private async processApproval(workflowId: string, workflow: ApprovalChain): Promise<ApprovalWorkflowResult> {
    const currentStepIndex = workflow.currentStepIndex;
    const nextStepIndex = currentStepIndex + 1;

    // Check if this was the final step
    if (nextStepIndex >= workflow.steps.length) {
      return await this.completeWorkflow(workflowId, workflow);
    }

    // Move to next step
    workflow.currentStepIndex = nextStepIndex;
    const nextStep = workflow.steps[nextStepIndex];

    // Notify next approver
    await this.notifyApprover(nextStep, workflow);

    // Set up timeout monitoring for next step
    await this.scheduleTimeoutCheck(workflowId, nextStep);

    return {
      workflowId,
      status: ApprovalStatus.PENDING,
      currentStep: nextStep,
      approvers: workflow.steps.map(step => ({
        id: step.approverId,
        name: step.approverName,
        role: step.approverRole,
        status: step.status,
        order: step.order
      })),
      estimatedCompletion: this.calculateEstimatedCompletion(workflow),
      nextAction: 'Waiting for approval from ' + nextStep.approverName,
      createdAt: workflow.createdAt
    };
  }

  /**
   * Process rejection and handle escalation or termination
   */
  private async processRejection(workflowId: string, workflow: ApprovalChain, decision: ApprovalDecision): Promise<ApprovalWorkflowResult> {
    const rule = this.approvalRules.get(workflow.workflowType);
    
    if (rule && rule.allowEscalation && workflow.escalationLevel < (rule.maxEscalationLevels || 2)) {
      return await this.escalateWorkflow(workflowId, workflow, decision);
    } else {
      return await this.terminateWorkflow(workflowId, workflow, ApprovalStatus.REJECTED);
    }
  }

  /**
   * Complete workflow successfully
   */
  private async completeWorkflow(workflowId: string, workflow: ApprovalChain): Promise<ApprovalWorkflowResult> {
    workflow.status = ApprovalStatus.APPROVED;
    workflow.completedAt = new Date();

    // Notify requester of completion
    await this.notifyWorkflowCompletion(workflow, ApprovalStatus.APPROVED);

    // Archive workflow
    this.activeWorkflows.delete(workflowId);

    logger.info(`Workflow completed successfully: ${workflowId}`);

    return {
      workflowId,
      status: ApprovalStatus.APPROVED,
      currentStep: null,
      approvers: workflow.steps.map(step => ({
        id: step.approverId,
        name: step.approverName,
        role: step.approverRole,
        status: step.status,
        order: step.order
      })),
      estimatedCompletion: workflow.completedAt,
      nextAction: 'Workflow completed - document approved',
      createdAt: workflow.createdAt,
      completedAt: workflow.completedAt
    };
  }

  /**
   * Escalate workflow to higher authority
   */
  private async escalateWorkflow(workflowId: string, workflow: ApprovalChain, decision: ApprovalDecision): Promise<ApprovalWorkflowResult> {
    workflow.escalationLevel++;
    
    // Get escalation approvers
    const escalationApprovers = await this.getEscalationApprovers(workflow.workflowType, workflow.escalationLevel);
    
    if (escalationApprovers.length === 0) {
      return await this.terminateWorkflow(workflowId, workflow, ApprovalStatus.REJECTED);
    }

    // Add escalation steps
    for (const approver of escalationApprovers) {
      const escalationStep: ApprovalStep = {
        id: `escalation-${workflow.escalationLevel}-${approver.userId}`,
        order: workflow.steps.length + 1,
        approverId: approver.userId,
        approverName: approver.name,
        approverRole: approver.role,
        status: ApprovalStatus.PENDING,
        isRequired: true,
        timeoutHours: 24, // Shorter timeout for escalations
        createdAt: new Date(),
        isEscalation: true,
        escalationReason: decision.comments
      };

      workflow.steps.push(escalationStep);
    }

    // Move to first escalation step
    workflow.currentStepIndex = workflow.steps.length - escalationApprovers.length;
    const nextStep = workflow.steps[workflow.currentStepIndex];

    // Notify escalation approver
    await this.notifyEscalation(nextStep, workflow, decision);

    logger.info(`Workflow escalated: ${workflowId}`, { escalationLevel: workflow.escalationLevel });

    return {
      workflowId,
      status: ApprovalStatus.ESCALATED,
      currentStep: nextStep,
      approvers: workflow.steps.map(step => ({
        id: step.approverId,
        name: step.approverName,
        role: step.approverRole,
        status: step.status,
        order: step.order
      })),
      estimatedCompletion: this.calculateEstimatedCompletion(workflow),
      nextAction: `Escalated to ${nextStep.approverName} - Level ${workflow.escalationLevel}`,
      createdAt: workflow.createdAt,
      escalationLevel: workflow.escalationLevel
    };
  }

  /**
   * Terminate workflow
   */
  private async terminateWorkflow(workflowId: string, workflow: ApprovalChain, status: ApprovalStatus): Promise<ApprovalWorkflowResult> {
    workflow.status = status;
    workflow.completedAt = new Date();

    // Notify requester of termination
    await this.notifyWorkflowCompletion(workflow, status);

    // Archive workflow
    this.activeWorkflows.delete(workflowId);

    logger.info(`Workflow terminated: ${workflowId}`, { status });

    return {
      workflowId,
      status,
      currentStep: null,
      approvers: workflow.steps.map(step => ({
        id: step.approverId,
        name: step.approverName,
        role: step.approverRole,
        status: step.status,
        order: step.order
      })),
      estimatedCompletion: workflow.completedAt,
      nextAction: status === ApprovalStatus.REJECTED ? 'Workflow rejected' : 'Workflow terminated',
      createdAt: workflow.createdAt,
      completedAt: workflow.completedAt
    };
  }

  /**
   * Notify approver of pending approval
   */
  private async notifyApprover(step: ApprovalStep, workflow: ApprovalChain, document?: Document): Promise<void> {
    // Mock implementation - would integrate with notification service
    logger.info(`Notifying approver: ${step.approverName}`, {
      workflowId: workflow.id,
      stepId: step.id,
      documentId: workflow.documentId
    });
  }

  /**
   * Notify escalation
   */
  private async notifyEscalation(step: ApprovalStep, workflow: ApprovalChain, originalDecision: ApprovalDecision): Promise<void> {
    // Mock implementation - would integrate with notification service
    logger.info(`Notifying escalation approver: ${step.approverName}`, {
      workflowId: workflow.id,
      escalationLevel: workflow.escalationLevel,
      originalReason: originalDecision.comments
    });
  }

  /**
   * Notify workflow completion
   */
  private async notifyWorkflowCompletion(workflow: ApprovalChain, status: ApprovalStatus): Promise<void> {
    // Mock implementation - would integrate with notification service
    logger.info(`Notifying workflow completion: ${workflow.id}`, {
      status,
      requesterId: workflow.requesterId
    });
  }

  /**
   * Schedule timeout check for approval step
   */
  private async scheduleTimeoutCheck(workflowId: string, step: ApprovalStep): Promise<void> {
    // Mock implementation - would integrate with job scheduler
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() + step.timeoutHours);
    
    logger.info(`Scheduled timeout check for step: ${step.id}`, {
      workflowId,
      timeoutDate: timeoutDate.toISOString()
    });
  }

  /**
   * Get escalation approvers for workflow type and level
   */
  private async getEscalationApprovers(workflowType: WorkflowType, escalationLevel: number): Promise<any[]> {
    // Mock implementation - would query user/role database
    const escalationApprovers = [
      { userId: 'manager-1', name: 'Senior Manager', role: 'senior_manager' },
      { userId: 'director-1', name: 'Director', role: 'director' }
    ];

    return escalationLevel <= escalationApprovers.length ? [escalationApprovers[escalationLevel - 1]] : [];
  }

  /**
   * Evaluate condition against document
   */
  private evaluateCondition(condition: any, document: Document): boolean {
    // Mock implementation - would evaluate complex conditions
    switch (condition.field) {
      case 'amount':
        return this.evaluateNumericCondition(condition, document.metadata);
      case 'type':
        return document.type === condition.value;
      case 'category':
        return document.metadata.category === condition.value;
      default:
        return true;
    }
  }

  /**
   * Evaluate numeric condition
   */
  private evaluateNumericCondition(condition: any, metadata: any): boolean {
    const value = metadata[condition.field];
    if (typeof value !== 'number') return false;

    switch (condition.operator) {
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'eq':
        return value === condition.value;
      default:
        return false;
    }
  }

  /**
   * Determine workflow priority based on document
   */
  private determineWorkflowPriority(document: Document): Priority {
    // Logic to determine priority based on document properties
    if (document.metadata.urgent || document.metadata.amount > 10000) {
      return Priority.HIGH;
    } else if (document.metadata.amount > 1000) {
      return Priority.MEDIUM;
    } else {
      return Priority.LOW;
    }
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletion(workflow: ApprovalChain): Date {
    const remainingSteps = workflow.steps.slice(workflow.currentStepIndex);
    const totalHours = remainingSteps.reduce((sum, step) => sum + step.timeoutHours, 0);
    
    const estimatedCompletion = new Date();
    estimatedCompletion.setHours(estimatedCompletion.getHours() + totalHours);
    
    return estimatedCompletion;
  }

  /**
   * Record approval decision in history
   */
  private recordApprovalDecision(workflowId: string, decision: ApprovalDecision): void {
    const history = this.approvalHistory.get(workflowId) || [];
    history.push({
      ...decision,
      timestamp: new Date()
    });
    this.approvalHistory.set(workflowId, history);
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize default approval rules
   */
  private initializeDefaultRules(): void {
    // Document approval rule
    this.approvalRules.set(WorkflowType.DOCUMENT_APPROVAL, {
      workflowType: WorkflowType.DOCUMENT_APPROVAL,
      approvers: [
        { userId: 'supervisor-1', name: 'Supervisor', role: 'supervisor', isRequired: true, timeoutHours: 24 },
        { userId: 'manager-1', name: 'Manager', role: 'manager', isRequired: true, timeoutHours: 48 }
      ],
      conditions: [],
      allowEscalation: true,
      maxEscalationLevels: 2,
      defaultTimeoutHours: 48
    });

    // Budget approval rule
    this.approvalRules.set(WorkflowType.BUDGET_APPROVAL, {
      workflowType: WorkflowType.BUDGET_APPROVAL,
      approvers: [
        { userId: 'finance-manager-1', name: 'Finance Manager', role: 'finance_manager', isRequired: true, timeoutHours: 24 },
        { userId: 'cfo-1', name: 'CFO', role: 'cfo', isRequired: true, timeoutHours: 72 }
      ],
      conditions: [
        { field: 'amount', operator: 'gt', value: 1000 }
      ],
      allowEscalation: true,
      maxEscalationLevels: 1,
      defaultTimeoutHours: 48
    });

    // Contract approval rule
    this.approvalRules.set(WorkflowType.CONTRACT_APPROVAL, {
      workflowType: WorkflowType.CONTRACT_APPROVAL,
      approvers: [
        { userId: 'legal-1', name: 'Legal Counsel', role: 'legal', isRequired: true, timeoutHours: 48 },
        { userId: 'director-1', name: 'Director', role: 'director', isRequired: true, timeoutHours: 72 }
      ],
      conditions: [],
      allowEscalation: true,
      maxEscalationLevels: 2,
      defaultTimeoutHours: 72
    });
  }

  /**
   * Get health status of the approval workflow router
   */
  async getHealthStatus(): Promise<any> {
    return {
      component: 'ApprovalWorkflowRouter',
      status: 'healthy',
      approvalRulesCount: this.approvalRules.size,
      activeWorkflowsCount: this.activeWorkflows.size,
      approvalHistoryCount: this.approvalHistory.size,
      escalationRulesCount: this.escalationRules.size,
      lastProcessed: new Date().toISOString()
    };
  }
}