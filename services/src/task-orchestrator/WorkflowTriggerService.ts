import { EventEmitter } from 'events';
import { Logger } from '../shared/utils/logger';
import { WorkflowTemplateRepository } from '../shared/repositories/WorkflowTemplateRepository';
import { TriggerType, TriggerCondition, WorkflowTemplate } from '../shared/types';
import { WorkflowEngine } from './WorkflowEngine';
import { TaskModel } from '../shared/models/Task';
import { AppError } from '../shared/utils/errors';

const logger = new Logger('WorkflowTriggerService');

export interface TriggerEvent {
  type: TriggerType;
  data: any;
  timestamp: Date;
  source: string;
  userId?: string;
}

export interface ScheduleTriggerConfig {
  cron: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface EmailTriggerConfig {
  fromPattern?: string;
  subjectPattern?: string;
  bodyPattern?: string;
  attachmentRequired?: boolean;
}

export interface FileTriggerConfig {
  path: string;
  filePattern?: string;
  minSize?: number;
  maxSize?: number;
}

export interface WebhookTriggerConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: { [key: string]: string };
  authentication?: {
    type: 'bearer' | 'basic' | 'apikey';
    credentials: any;
  };
}

export class WorkflowTriggerService extends EventEmitter {
  private repository: WorkflowTemplateRepository;
  private workflowEngine: WorkflowEngine;
  private activeTriggers = new Map<string, NodeJS.Timeout>();
  private webhookEndpoints = new Map<string, string>(); // endpoint -> templateId

  constructor(workflowEngine: WorkflowEngine) {
    super();
    this.repository = new WorkflowTemplateRepository();
    this.workflowEngine = workflowEngine;
    this.initializeTriggers();
  }

  private async initializeTriggers(): Promise<void> {
    try {
      const templates = await this.repository.findActiveTemplates();
      
      for (const template of templates) {
        for (const trigger of template.triggers) {
          await this.registerTrigger(template.id, trigger);
        }
      }

      logger.info('Workflow triggers initialized', {
        templateCount: templates.length,
        triggerCount: templates.reduce((sum, t) => sum + t.triggers.length, 0)
      });
    } catch (error) {
      logger.error('Failed to initialize workflow triggers', error);
    }
  }

  async registerTrigger(templateId: string, trigger: TriggerCondition): Promise<void> {
    try {
      const triggerId = `${templateId}_${trigger.type}_${Date.now()}`;

      switch (trigger.type) {
        case TriggerType.SCHEDULE:
          await this.registerScheduleTrigger(triggerId, templateId, trigger.configuration);
          break;

        case TriggerType.EMAIL_RECEIVED:
          await this.registerEmailTrigger(triggerId, templateId, trigger.configuration);
          break;

        case TriggerType.FILE_UPLOADED:
          await this.registerFileTrigger(triggerId, templateId, trigger.configuration);
          break;

        case TriggerType.WEBHOOK:
          await this.registerWebhookTrigger(triggerId, templateId, trigger.configuration);
          break;

        case TriggerType.MANUAL:
          // Manual triggers don't need registration
          break;

        default:
          logger.warn('Unknown trigger type', { type: trigger.type, templateId });
      }

      logger.info('Trigger registered', { triggerId, templateId, type: trigger.type });
    } catch (error) {
      logger.error('Failed to register trigger', error, { templateId, trigger });
      throw error;
    }
  }

  async unregisterTrigger(templateId: string, triggerType: TriggerType): Promise<void> {
    const triggerId = `${templateId}_${triggerType}`;
    
    // Clear scheduled triggers
    const timeout = this.activeTriggers.get(triggerId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTriggers.delete(triggerId);
    }

    // Remove webhook endpoints
    for (const [endpoint, tId] of this.webhookEndpoints.entries()) {
      if (tId === templateId) {
        this.webhookEndpoints.delete(endpoint);
      }
    }

    logger.info('Trigger unregistered', { triggerId, templateId, triggerType });
  }

  async processTriggerEvent(event: TriggerEvent): Promise<string[]> {
    try {
      const templates = await this.findMatchingTemplates(event);
      const executionIds: string[] = [];

      for (const template of templates) {
        const executionId = await this.executeTriggeredWorkflow(template, event);
        executionIds.push(executionId);
      }

      logger.info('Trigger event processed', {
        eventType: event.type,
        matchingTemplates: templates.length,
        executionIds
      });

      return executionIds;
    } catch (error) {
      logger.error('Failed to process trigger event', error, { event });
      throw error;
    }
  }

  private async registerScheduleTrigger(
    triggerId: string,
    templateId: string,
    config: ScheduleTriggerConfig
  ): Promise<void> {
    const cron = await import('node-cron');
    
    if (!cron.validate(config.cron)) {
      throw new AppError(`Invalid cron expression: ${config.cron}`, 400, 'INVALID_CRON');
    }

    const task = cron.schedule(config.cron, async () => {
      try {
        const event: TriggerEvent = {
          type: TriggerType.SCHEDULE,
          data: { cron: config.cron },
          timestamp: new Date(),
          source: 'scheduler'
        };

        await this.processTriggerEvent(event);
      } catch (error) {
        logger.error('Scheduled trigger execution failed', error, { triggerId, templateId });
      }
    }, {
      scheduled: true,
      timezone: config.timezone || 'UTC'
    });

    // Store reference for cleanup
    this.activeTriggers.set(triggerId, task as any);
  }

  private async registerEmailTrigger(
    triggerId: string,
    templateId: string,
    config: EmailTriggerConfig
  ): Promise<void> {
    // Register email event listener
    this.on('emailReceived', async (emailData: any) => {
      try {
        if (this.matchesEmailTrigger(emailData, config)) {
          const event: TriggerEvent = {
            type: TriggerType.EMAIL_RECEIVED,
            data: emailData,
            timestamp: new Date(),
            source: 'email_service',
            userId: emailData.recipientUserId
          };

          await this.processTriggerEvent(event);
        }
      } catch (error) {
        logger.error('Email trigger processing failed', error, { triggerId, templateId });
      }
    });
  }

  private async registerFileTrigger(
    triggerId: string,
    templateId: string,
    config: FileTriggerConfig
  ): Promise<void> {
    // Register file upload event listener
    this.on('fileUploaded', async (fileData: any) => {
      try {
        if (this.matchesFileTrigger(fileData, config)) {
          const event: TriggerEvent = {
            type: TriggerType.FILE_UPLOADED,
            data: fileData,
            timestamp: new Date(),
            source: 'file_service',
            userId: fileData.uploadedBy
          };

          await this.processTriggerEvent(event);
        }
      } catch (error) {
        logger.error('File trigger processing failed', error, { triggerId, templateId });
      }
    });
  }

  private async registerWebhookTrigger(
    triggerId: string,
    templateId: string,
    config: WebhookTriggerConfig
  ): Promise<void> {
    // Store webhook endpoint mapping
    this.webhookEndpoints.set(config.endpoint, templateId);
    
    logger.info('Webhook trigger registered', {
      triggerId,
      templateId,
      endpoint: config.endpoint
    });
  }

  async handleWebhookRequest(endpoint: string, data: any, headers: any): Promise<string[]> {
    const templateId = this.webhookEndpoints.get(endpoint);
    
    if (!templateId) {
      throw new AppError(`No workflow template found for webhook endpoint: ${endpoint}`, 404, 'WEBHOOK_NOT_FOUND');
    }

    const event: TriggerEvent = {
      type: TriggerType.WEBHOOK,
      data: { body: data, headers },
      timestamp: new Date(),
      source: 'webhook'
    };

    return this.processTriggerEvent(event);
  }

  private async findMatchingTemplates(event: TriggerEvent): Promise<WorkflowTemplate[]> {
    const templates = await this.repository.findTemplatesWithTrigger(event.type);
    
    return templates.filter(template => {
      return template.triggers.some(trigger => {
        if (trigger.type !== event.type) return false;
        
        return this.evaluateTriggerCondition(trigger, event);
      });
    });
  }

  private evaluateTriggerCondition(trigger: TriggerCondition, event: TriggerEvent): boolean {
    switch (trigger.type) {
      case TriggerType.SCHEDULE:
        return true; // Schedule triggers are always matched when fired

      case TriggerType.EMAIL_RECEIVED:
        return this.matchesEmailTrigger(event.data, trigger.configuration);

      case TriggerType.FILE_UPLOADED:
        return this.matchesFileTrigger(event.data, trigger.configuration);

      case TriggerType.WEBHOOK:
        return this.matchesWebhookTrigger(event.data, trigger.configuration);

      case TriggerType.MANUAL:
        return true; // Manual triggers are always matched when explicitly fired

      default:
        return false;
    }
  }

  private matchesEmailTrigger(emailData: any, config: EmailTriggerConfig): boolean {
    if (config.fromPattern && !this.matchesPattern(emailData.from, config.fromPattern)) {
      return false;
    }

    if (config.subjectPattern && !this.matchesPattern(emailData.subject, config.subjectPattern)) {
      return false;
    }

    if (config.bodyPattern && !this.matchesPattern(emailData.body, config.bodyPattern)) {
      return false;
    }

    if (config.attachmentRequired && (!emailData.attachments || emailData.attachments.length === 0)) {
      return false;
    }

    return true;
  }

  private matchesFileTrigger(fileData: any, config: FileTriggerConfig): boolean {
    if (config.path && !fileData.path.startsWith(config.path)) {
      return false;
    }

    if (config.filePattern && !this.matchesPattern(fileData.filename, config.filePattern)) {
      return false;
    }

    if (config.minSize && fileData.size < config.minSize) {
      return false;
    }

    if (config.maxSize && fileData.size > config.maxSize) {
      return false;
    }

    return true;
  }

  private matchesWebhookTrigger(webhookData: any, config: WebhookTriggerConfig): boolean {
    // Basic webhook matching - can be extended with more sophisticated logic
    return true;
  }

  private matchesPattern(text: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    } catch (error) {
      logger.warn('Invalid regex pattern', { pattern, error: error.message });
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  private async executeTriggeredWorkflow(template: WorkflowTemplate, event: TriggerEvent): Promise<string> {
    // Create a task for the triggered workflow
    const task = await TaskModel.create({
      type: 'workflow_execution',
      status: 'pending',
      priority: 'medium',
      assignedTo: 'system',
      createdBy: event.userId || 'system',
      title: `Triggered: ${template.name}`,
      description: `Workflow triggered by ${event.type} event`,
      data: {
        input: event.data,
        context: {
          userId: event.userId || 'system',
          workflowTemplateId: template.id,
          triggerEvent: event,
          metadata: {
            triggeredAt: event.timestamp,
            triggerSource: event.source
          }
        }
      },
      workflow: template.steps
    });

    // Execute the workflow
    const executionId = await this.workflowEngine.executeWorkflow(template.id, task.id, {
      triggerEvent: event,
      triggeredAt: event.timestamp
    });

    logger.info('Workflow triggered and executed', {
      templateId: template.id,
      templateName: template.name,
      taskId: task.id,
      executionId,
      triggerType: event.type
    });

    return executionId;
  }

  async getActiveWebhookEndpoints(): Promise<{ endpoint: string; templateId: string }[]> {
    return Array.from(this.webhookEndpoints.entries()).map(([endpoint, templateId]) => ({
      endpoint,
      templateId
    }));
  }

  async refreshTriggers(): Promise<void> {
    // Clear all existing triggers
    for (const timeout of this.activeTriggers.values()) {
      clearTimeout(timeout);
    }
    this.activeTriggers.clear();
    this.webhookEndpoints.clear();

    // Reinitialize triggers
    await this.initializeTriggers();
  }
}