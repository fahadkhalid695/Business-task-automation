import { EventEmitter } from 'events';
import { Logger } from '../shared/utils/logger';
import { Task, WorkflowTemplate, WorkflowStep, TaskStatus, StepType } from '../shared/types';
import { TaskModel } from '../shared/models/Task';
import { WorkflowTemplateModel } from '../shared/models/WorkflowTemplate';
import { AppError } from '../shared/utils/errors';

const logger = new Logger('WorkflowEngine');

export interface WorkflowExecution {
  id: string;
  templateId: string;
  taskId: string;
  currentStep: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  context: any;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class WorkflowEngine extends EventEmitter {
  private executions = new Map<string, WorkflowExecution>();
  private stepProcessors = new Map<StepType, (step: WorkflowStep, context: any) => Promise<any>>();

  constructor() {
    super();
    this.setupStepProcessors();
  }

  private setupStepProcessors(): void {
    this.stepProcessors.set(StepType.AI_PROCESSING, this.processAIStep.bind(this));
    this.stepProcessors.set(StepType.DATA_TRANSFORMATION, this.processDataTransformationStep.bind(this));
    this.stepProcessors.set(StepType.EXTERNAL_API_CALL, this.processExternalAPIStep.bind(this));
    this.stepProcessors.set(StepType.USER_APPROVAL, this.processUserApprovalStep.bind(this));
    this.stepProcessors.set(StepType.NOTIFICATION, this.processNotificationStep.bind(this));
    this.stepProcessors.set(StepType.CONDITIONAL, this.processConditionalStep.bind(this));
  }

  async executeWorkflow(templateId: string, taskId: string, initialContext: any = {}): Promise<string> {
    try {
      const template = await WorkflowTemplateModel.findById(templateId);
      if (!template) {
        throw new AppError(`Workflow template ${templateId} not found`, 404, 'TEMPLATE_NOT_FOUND');
      }

      const task = await TaskModel.findById(taskId);
      if (!task) {
        throw new AppError(`Task ${taskId} not found`, 404, 'TASK_NOT_FOUND');
      }

      const executionId = this.generateExecutionId();
      const execution: WorkflowExecution = {
        id: executionId,
        templateId,
        taskId,
        currentStep: 0,
        status: 'running',
        context: { ...initialContext, task: task.toObject() },
        startedAt: new Date()
      };

      this.executions.set(executionId, execution);

      logger.info('Starting workflow execution', {
        executionId,
        templateId,
        taskId,
        templateName: template.name
      });

      // Update task status
      await TaskModel.findByIdAndUpdate(taskId, { 
        status: TaskStatus.IN_PROGRESS,
        updatedAt: new Date()
      });

      // Start execution asynchronously
      this.runWorkflow(execution, template).catch(error => {
        logger.error('Workflow execution failed', error, { executionId });
        this.handleWorkflowError(execution, error);
      });

      return executionId;
    } catch (error) {
      logger.error('Failed to start workflow execution', error, { templateId, taskId });
      throw error;
    }
  }

  private async runWorkflow(execution: WorkflowExecution, template: WorkflowTemplate): Promise<void> {
    try {
      const sortedSteps = template.steps.sort((a, b) => a.order - b.order);
      
      for (let i = execution.currentStep; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        execution.currentStep = i;

        logger.info('Executing workflow step', {
          executionId: execution.id,
          stepName: step.name,
          stepType: step.type,
          stepOrder: step.order
        });

        // Check dependencies
        if (step.dependencies.length > 0) {
          const dependenciesMet = await this.checkDependencies(step.dependencies, execution.context);
          if (!dependenciesMet) {
            throw new AppError(`Dependencies not met for step ${step.name}`, 400, 'DEPENDENCIES_NOT_MET');
          }
        }

        // Execute step with timeout and retry logic
        const result = await this.executeStepWithRetry(step, execution.context);
        
        // Update context with step result
        execution.context[`step_${step.id}_result`] = result;
        execution.context.lastStepResult = result;

        this.emit('stepCompleted', {
          executionId: execution.id,
          stepId: step.id,
          stepName: step.name,
          result
        });
      }

      // Workflow completed successfully
      execution.status = 'completed';
      execution.completedAt = new Date();

      await TaskModel.findByIdAndUpdate(execution.taskId, {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        'data.output': execution.context.lastStepResult
      });

      logger.info('Workflow execution completed', {
        executionId: execution.id,
        duration: execution.completedAt.getTime() - execution.startedAt.getTime()
      });

      this.emit('workflowCompleted', execution);

    } catch (error) {
      this.handleWorkflowError(execution, error);
      throw error;
    }
  }

  private async executeStepWithRetry(step: WorkflowStep, context: any): Promise<any> {
    const maxRetries = step.retryCount || 3;
    const timeout = step.timeout || 30000; // 30 seconds default

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const processor = this.stepProcessors.get(step.type);
        if (!processor) {
          throw new AppError(`No processor found for step type ${step.type}`, 500, 'PROCESSOR_NOT_FOUND');
        }

        // Execute with timeout
        const result = await Promise.race([
          processor(step, context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Step execution timeout')), timeout)
          )
        ]);

        return result;
      } catch (error) {
        logger.warn('Step execution attempt failed', error, {
          stepId: step.id,
          stepName: step.name,
          attempt,
          maxRetries
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  private async checkDependencies(dependencies: string[], context: any): Promise<boolean> {
    return dependencies.every(dep => {
      const result = context[`step_${dep}_result`];
      return result !== undefined && result !== null;
    });
  }

  private handleWorkflowError(execution: WorkflowExecution, error: any): void {
    execution.status = 'failed';
    execution.error = error.message;
    execution.completedAt = new Date();

    TaskModel.findByIdAndUpdate(execution.taskId, {
      status: TaskStatus.FAILED,
      updatedAt: new Date()
    }).catch(err => {
      logger.error('Failed to update task status after workflow error', err);
    });

    this.emit('workflowFailed', { execution, error });
  }

  // Step processors
  private async processAIStep(step: WorkflowStep, context: any): Promise<any> {
    const { AIEngineService } = await import('../services/ai-engine/AIEngineService');
    const aiService = new AIEngineService();
    
    const { model, prompt, parameters } = step.configuration;
    return aiService.processRequest(model, prompt, { ...parameters, context });
  }

  private async processDataTransformationStep(step: WorkflowStep, context: any): Promise<any> {
    const { DataAnalyticsService } = await import('../services/data-analytics/DataAnalyticsService');
    const dataService = new DataAnalyticsService();
    
    const { operation, input, parameters } = step.configuration;
    return dataService.transformData(operation, input, parameters);
  }

  private async processExternalAPIStep(step: WorkflowStep, context: any): Promise<any> {
    const axios = await import('axios');
    const { url, method, headers, data } = step.configuration;
    
    const response = await axios.default({
      url,
      method: method || 'GET',
      headers: headers || {},
      data: data || undefined,
      timeout: 10000
    });
    
    return response.data;
  }

  private async processUserApprovalStep(step: WorkflowStep, context: any): Promise<any> {
    // This would typically involve creating a pending approval record
    // and waiting for user input through the UI
    const { approvers, message, autoApprove } = step.configuration;
    
    if (autoApprove) {
      return { approved: true, approver: 'system', timestamp: new Date() };
    }
    
    // For now, return a pending status
    // In a real implementation, this would create a pending approval
    return { 
      status: 'pending_approval', 
      approvers, 
      message,
      createdAt: new Date()
    };
  }

  private async processNotificationStep(step: WorkflowStep, context: any): Promise<any> {
    const { CommunicationService } = await import('../services/communication/CommunicationService');
    const commService = new CommunicationService();
    
    const { type, recipients, message, template } = step.configuration;
    return commService.sendNotification(type, recipients, message, template);
  }

  private async processConditionalStep(step: WorkflowStep, context: any): Promise<any> {
    const { condition, trueAction, falseAction, branches } = step.configuration;
    
    // Support for complex branching with multiple conditions
    if (branches && Array.isArray(branches)) {
      return this.processMultiBranchConditional(branches, context);
    }
    
    // Simple binary conditional
    const conditionResult = this.evaluateCondition(condition, context);
    
    if (conditionResult && trueAction) {
      return { branch: 'true', action: trueAction, result: conditionResult };
    } else if (!conditionResult && falseAction) {
      return { branch: 'false', action: falseAction, result: conditionResult };
    }
    
    return { branch: conditionResult ? 'true' : 'false', result: conditionResult };
  }

  private async processMultiBranchConditional(branches: any[], context: any): Promise<any> {
    for (const branch of branches) {
      const { condition, action, name } = branch;
      
      if (this.evaluateCondition(condition, context)) {
        logger.info('Branch condition matched', { branchName: name, condition });
        return { 
          branch: name || 'matched', 
          action, 
          result: true,
          matchedCondition: condition
        };
      }
    }
    
    // No conditions matched - check for default branch
    const defaultBranch = branches.find(b => b.isDefault);
    if (defaultBranch) {
      return { 
        branch: 'default', 
        action: defaultBranch.action, 
        result: false,
        matchedCondition: 'default'
      };
    }
    
    return { branch: 'none', result: false };
  }

  private evaluateCondition(condition: string, context: any): boolean {
    try {
      // Enhanced condition evaluation with safety checks
      if (!condition || typeof condition !== 'string') {
        return false;
      }

      // Support for common condition patterns
      if (condition.includes('context.')) {
        // Replace context references with safe property access
        const safeCondition = condition.replace(
          /context\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
          'this.getContextValue(context, "$1")'
        );
        
        const evaluator = {
          getContextValue: this.getContextValue.bind(this),
          context
        };
        
        const func = new Function('context', `
          const getContextValue = this.getContextValue;
          return ${safeCondition};
        `).bind(evaluator);
        
        return Boolean(func(context));
      }

      // Simple expression evaluation
      const func = new Function('context', `return Boolean(${condition})`);
      return func(context);
    } catch (error) {
      logger.error('Condition evaluation failed', error, { condition });
      return false;
    }
  }

  private getContextValue(context: any, path: string): any {
    try {
      const keys = path.split('.');
      let value = context;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }
      
      return value;
    } catch (error) {
      logger.warn('Failed to get context value', { path, error: error.message });
      return undefined;
    }
  }

  // Public methods
  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new AppError(`Execution ${executionId} not found`, 404, 'EXECUTION_NOT_FOUND');
    }
    
    execution.status = 'paused';
    this.emit('workflowPaused', execution);
  }

  async resumeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new AppError(`Execution ${executionId} not found`, 404, 'EXECUTION_NOT_FOUND');
    }
    
    if (execution.status !== 'paused') {
      throw new AppError('Workflow is not paused', 400, 'WORKFLOW_NOT_PAUSED');
    }
    
    execution.status = 'running';
    
    const template = await WorkflowTemplateModel.findById(execution.templateId);
    if (template) {
      this.runWorkflow(execution, template).catch(error => {
        this.handleWorkflowError(execution, error);
      });
    }
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}