import { Logger } from '../shared/utils/logger';
import { WorkflowTemplateRepository } from '../shared/repositories/WorkflowTemplateRepository';
import { WorkflowTemplate, WorkflowStep, TriggerCondition, StepType, TriggerType } from '../shared/types';
import { AppError } from '../shared/utils/errors';
import { WorkflowTemplateDocument } from '../shared/models/WorkflowTemplate';

const logger = new Logger('WorkflowTemplateService');

export interface WorkflowTemplateCreateRequest {
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  triggers: TriggerCondition[];
  createdBy: string;
}

export interface WorkflowTemplateUpdateRequest {
  name?: string;
  description?: string;
  category?: string;
  steps?: WorkflowStep[];
  triggers?: TriggerCondition[];
  isActive?: boolean;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration: number;
}

export class WorkflowTemplateService {
  private repository: WorkflowTemplateRepository;

  constructor() {
    this.repository = new WorkflowTemplateRepository();
  }

  async createTemplate(request: WorkflowTemplateCreateRequest): Promise<WorkflowTemplateDocument> {
    try {
      // Validate template structure
      const validation = await this.validateWorkflowTemplate({
        ...request,
        id: '',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      if (!validation.isValid) {
        throw new AppError(
          `Invalid workflow template: ${validation.errors.join(', ')}`,
          400,
          'INVALID_WORKFLOW_TEMPLATE'
        );
      }

      // Check for duplicate names
      const existing = await this.repository.findOne({ name: request.name });
      if (existing) {
        throw new AppError(
          `Workflow template with name "${request.name}" already exists`,
          409,
          'TEMPLATE_NAME_EXISTS'
        );
      }

      // Assign step IDs and validate dependencies
      const processedSteps = this.processWorkflowSteps(request.steps);

      const template = await this.repository.create({
        ...request,
        steps: processedSteps,
        isActive: true,
        version: 1
      });

      logger.info('Workflow template created', {
        templateId: template.id,
        name: template.name,
        stepCount: template.steps.length,
        complexity: validation.complexity
      });

      return template;
    } catch (error) {
      logger.error('Failed to create workflow template', error, { request });
      throw error;
    }
  }

  async updateTemplate(
    templateId: string,
    request: WorkflowTemplateUpdateRequest,
    createNewVersion: boolean = false
  ): Promise<WorkflowTemplateDocument> {
    try {
      const existingTemplate = await this.repository.findByIdOrThrow(templateId);

      if (createNewVersion) {
        // Create new version
        const newVersion = await this.repository.createNewVersion(templateId, request);
        logger.info('New workflow template version created', {
          originalId: templateId,
          newId: newVersion.id,
          version: newVersion.version
        });
        return newVersion;
      } else {
        // Update existing template
        const updateData: any = { ...request };
        
        if (request.steps) {
          updateData.steps = this.processWorkflowSteps(request.steps);
        }

        const updatedTemplate = await this.repository.update(templateId, updateData);
        
        logger.info('Workflow template updated', {
          templateId,
          changes: Object.keys(request)
        });

        return updatedTemplate;
      }
    } catch (error) {
      logger.error('Failed to update workflow template', error, { templateId, request });
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<WorkflowTemplateDocument> {
    return this.repository.findByIdOrThrow(templateId);
  }

  async getTemplates(filters: {
    category?: string;
    isActive?: boolean;
    createdBy?: string;
    search?: string;
  } = {}): Promise<WorkflowTemplateDocument[]> {
    try {
      if (filters.search) {
        return this.repository.searchTemplates(filters.search);
      }

      if (filters.category) {
        return this.repository.findByCategory(filters.category);
      }

      if (filters.createdBy) {
        return this.repository.findByCreator(filters.createdBy);
      }

      if (filters.isActive !== undefined) {
        return filters.isActive 
          ? this.repository.findActiveTemplates()
          : this.repository.findMany({ isActive: false });
      }

      return this.repository.findActiveTemplates();
    } catch (error) {
      logger.error('Failed to get workflow templates', error, { filters });
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Soft delete by setting isActive to false
      await this.repository.update(templateId, { isActive: false });
      
      logger.info('Workflow template deleted (soft)', { templateId });
    } catch (error) {
      logger.error('Failed to delete workflow template', error, { templateId });
      throw error;
    }
  }

  async duplicateTemplate(
    templateId: string,
    newName: string,
    createdBy: string
  ): Promise<WorkflowTemplateDocument> {
    try {
      const duplicated = await this.repository.duplicateTemplate(templateId, newName, createdBy);
      
      logger.info('Workflow template duplicated', {
        originalId: templateId,
        newId: duplicated.id,
        newName
      });

      return duplicated;
    } catch (error) {
      logger.error('Failed to duplicate workflow template', error, { templateId, newName });
      throw error;
    }
  }

  async validateWorkflowTemplate(template: WorkflowTemplate): Promise<WorkflowValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.steps || template.steps.length === 0) {
      errors.push('Template must have at least one step');
    }

    if (template.steps) {
      // Validate steps
      const stepIds = new Set<string>();
      const stepOrders = new Set<number>();

      for (const step of template.steps) {
        // Check for duplicate step IDs
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        }
        stepIds.add(step.id);

        // Check for duplicate orders
        if (stepOrders.has(step.order)) {
          errors.push(`Duplicate step order: ${step.order}`);
        }
        stepOrders.add(step.order);

        // Validate step configuration
        const stepValidation = this.validateStep(step);
        errors.push(...stepValidation.errors);
        warnings.push(...stepValidation.warnings);

        // Validate dependencies
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(`Step ${step.id} depends on non-existent step: ${depId}`);
          }
        }
      }

      // Check for circular dependencies
      const circularDeps = this.detectCircularDependencies(template.steps);
      if (circularDeps.length > 0) {
        errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
      }
    }

    // Calculate complexity and estimated duration
    const complexity = this.calculateComplexity(template.steps || []);
    const estimatedDuration = this.estimateDuration(template.steps || []);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complexity,
      estimatedDuration
    };
  }

  private processWorkflowSteps(steps: WorkflowStep[]): WorkflowStep[] {
    return steps.map((step, index) => ({
      ...step,
      id: step.id || `step_${index + 1}_${Math.random().toString(36).substring(2, 8)}`,
      order: step.order || index + 1
    }));
  }

  private validateStep(step: WorkflowStep): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!step.name || step.name.trim().length === 0) {
      errors.push(`Step ${step.id} must have a name`);
    }

    if (!Object.values(StepType).includes(step.type)) {
      errors.push(`Step ${step.id} has invalid type: ${step.type}`);
    }

    if (!step.configuration) {
      errors.push(`Step ${step.id} must have configuration`);
    }

    // Type-specific validation
    switch (step.type) {
      case StepType.AI_PROCESSING:
        if (!step.configuration.model || !step.configuration.prompt) {
          errors.push(`AI processing step ${step.id} must have model and prompt`);
        }
        break;

      case StepType.EXTERNAL_API_CALL:
        if (!step.configuration.url) {
          errors.push(`External API step ${step.id} must have URL`);
        }
        break;

      case StepType.CONDITIONAL:
        if (!step.configuration.condition) {
          errors.push(`Conditional step ${step.id} must have condition`);
        }
        break;

      case StepType.USER_APPROVAL:
        if (!step.configuration.approvers || step.configuration.approvers.length === 0) {
          warnings.push(`User approval step ${step.id} has no approvers specified`);
        }
        break;
    }

    // Timeout validation
    if (step.timeout && step.timeout < 1000) {
      warnings.push(`Step ${step.id} has very short timeout (${step.timeout}ms)`);
    }

    return { errors, warnings };
  }

  private detectCircularDependencies(steps: WorkflowStep[]): string[] {
    const stepMap = new Map(steps.map(step => [step.id, step]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDeps: string[] = [];

    const dfs = (stepId: string, path: string[]): void => {
      if (recursionStack.has(stepId)) {
        const cycleStart = path.indexOf(stepId);
        circularDeps.push(path.slice(cycleStart).join(' -> ') + ' -> ' + stepId);
        return;
      }

      if (visited.has(stepId)) {
        return;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = stepMap.get(stepId);
      if (step) {
        for (const depId of step.dependencies) {
          dfs(depId, [...path, stepId]);
        }
      }

      recursionStack.delete(stepId);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        dfs(step.id, []);
      }
    }

    return circularDeps;
  }

  private calculateComplexity(steps: WorkflowStep[]): 'simple' | 'moderate' | 'complex' {
    const stepCount = steps.length;
    const conditionalSteps = steps.filter(s => s.type === StepType.CONDITIONAL).length;
    const maxDependencies = Math.max(...steps.map(s => s.dependencies.length), 0);

    if (stepCount <= 3 && conditionalSteps === 0 && maxDependencies <= 1) {
      return 'simple';
    }

    if (stepCount <= 10 && conditionalSteps <= 2 && maxDependencies <= 3) {
      return 'moderate';
    }

    return 'complex';
  }

  private estimateDuration(steps: WorkflowStep[]): number {
    // Estimate duration in milliseconds based on step types and configuration
    let totalDuration = 0;

    for (const step of steps) {
      let stepDuration = 0;

      switch (step.type) {
        case StepType.AI_PROCESSING:
          stepDuration = 5000; // 5 seconds for AI processing
          break;
        case StepType.DATA_TRANSFORMATION:
          stepDuration = 3000; // 3 seconds for data transformation
          break;
        case StepType.EXTERNAL_API_CALL:
          stepDuration = 2000; // 2 seconds for API calls
          break;
        case StepType.USER_APPROVAL:
          stepDuration = 0; // User approval doesn't count toward automated duration
          break;
        case StepType.NOTIFICATION:
          stepDuration = 1000; // 1 second for notifications
          break;
        case StepType.CONDITIONAL:
          stepDuration = 500; // 0.5 seconds for condition evaluation
          break;
        default:
          stepDuration = 1000; // Default 1 second
      }

      // Add configured timeout if specified
      if (step.timeout) {
        stepDuration = Math.max(stepDuration, step.timeout);
      }

      totalDuration += stepDuration;
    }

    return totalDuration;
  }
}