import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { 
  WebhookRegistration, 
  WebhookPayload, 
  WebhookResult, 
  WebhookAction,
  IntegrationEventType 
} from './types/IntegrationTypes';
import { ExternalService } from '../shared/types';
import { logger } from '../shared/utils/logger';

/**
 * WebhookHandler - Manages webhook registration and processing for real-time updates
 */
export class WebhookHandler extends EventEmitter {
  private registrations: Map<string, WebhookRegistration>;
  private processors: Map<ExternalService, (payload: WebhookPayload) => Promise<WebhookAction[]>>;
  private signatureValidators: Map<ExternalService, (payload: any, signature: string, secret: string) => boolean>;

  constructor() {
    super();
    this.registrations = new Map();
    this.processors = new Map();
    this.signatureValidators = new Map();
    
    this.setupProcessors();
    this.setupSignatureValidators();
    
    logger.info('WebhookHandler initialized');
  }

  /**
   * Register webhook for integration
   */
  async register(registration: WebhookRegistration): Promise<boolean> {
    try {
      logger.info(`Registering webhook for integration ${registration.integrationId}`, {
        events: registration.events,
        url: registration.url
      });

      // Validate URL
      if (!this.isValidUrl(registration.url)) {
        throw new Error('Invalid webhook URL');
      }

      // Store registration
      this.registrations.set(registration.integrationId, registration);

      // In a real implementation, you would also register the webhook with the external service
      // This would involve making API calls to each service to set up the webhook endpoints

      logger.info(`Webhook registered successfully for integration ${registration.integrationId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to register webhook for integration ${registration.integrationId}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Unregister webhook for integration
   */
  async unregister(integrationId: string): Promise<boolean> {
    try {
      const registration = this.registrations.get(integrationId);
      if (!registration) {
        logger.warn(`No webhook registration found for integration ${integrationId}`);
        return false;
      }

      // Remove registration
      this.registrations.delete(integrationId);

      // In a real implementation, you would also unregister the webhook with the external service

      logger.info(`Webhook unregistered for integration ${integrationId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to unregister webhook for integration ${integrationId}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Process incoming webhook payload
   */
  async process(integrationId: string, payload: any): Promise<WebhookResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing webhook for integration ${integrationId}`);

      const registration = this.registrations.get(integrationId);
      if (!registration) {
        throw new Error(`No webhook registration found for integration ${integrationId}`);
      }

      // Validate signature if secret is provided
      if (registration.secret && payload.signature) {
        const service = this.getServiceFromPayload(payload);
        const validator = this.signatureValidators.get(service);
        
        if (validator && !validator(payload, payload.signature, registration.secret)) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Parse webhook payload
      const webhookPayload = this.parsePayload(payload);
      
      // Get processor for the service
      const processor = this.processors.get(webhookPayload.source);
      if (!processor) {
        throw new Error(`No processor found for service: ${webhookPayload.source}`);
      }

      // Process the webhook
      const actions = await processor(webhookPayload);

      // Execute actions
      await this.executeActions(integrationId, actions);

      // Emit webhook processed event
      this.emit('webhook:processed', {
        integrationId,
        payload: webhookPayload,
        actions,
        processingTime: Date.now() - startTime
      });

      logger.info(`Webhook processed successfully for integration ${integrationId}`, {
        actionsCount: actions.length,
        processingTime: Date.now() - startTime
      });

      return {
        processed: true,
        actions
      };

    } catch (error) {
      logger.error(`Failed to process webhook for integration ${integrationId}`, {
        error: error.message,
        processingTime: Date.now() - startTime
      });

      this.emit('webhook:error', {
        integrationId,
        error: error.message,
        payload
      });

      return {
        processed: false,
        actions: [],
        error: error.message
      };
    }
  }

  /**
   * Setup webhook processors for different services
   */
  private setupProcessors(): void {
    // Gmail webhook processor
    this.processors.set(ExternalService.GMAIL, async (payload: WebhookPayload): Promise<WebhookAction[]> => {
      const actions: WebhookAction[] = [];

      switch (payload.event) {
        case 'message_received':
          actions.push({
            type: 'create_task',
            data: {
              type: 'email_processing',
              priority: 'medium',
              data: {
                emailId: payload.data.messageId,
                from: payload.data.from,
                subject: payload.data.subject
              }
            }
          });
          break;

        case 'message_sent':
          actions.push({
            type: 'update_record',
            data: {
              type: 'email_sent',
              messageId: payload.data.messageId,
              timestamp: payload.timestamp
            }
          });
          break;

        default:
          logger.warn(`Unhandled Gmail webhook event: ${payload.event}`);
      }

      return actions;
    });

    // Outlook webhook processor
    this.processors.set(ExternalService.OUTLOOK, async (payload: WebhookPayload): Promise<WebhookAction[]> => {
      const actions: WebhookAction[] = [];

      switch (payload.event) {
        case 'mail.received':
          actions.push({
            type: 'create_task',
            data: {
              type: 'email_processing',
              priority: 'medium',
              data: {
                emailId: payload.data.id,
                from: payload.data.from?.emailAddress?.address,
                subject: payload.data.subject
              }
            }
          });
          break;

        case 'calendar.event.created':
          actions.push({
            type: 'create_task',
            data: {
              type: 'calendar_management',
              priority: 'high',
              data: {
                eventId: payload.data.id,
                subject: payload.data.subject,
                start: payload.data.start,
                end: payload.data.end
              }
            }
          });
          break;

        default:
          logger.warn(`Unhandled Outlook webhook event: ${payload.event}`);
      }

      return actions;
    });

    // Slack webhook processor
    this.processors.set(ExternalService.SLACK, async (payload: WebhookPayload): Promise<WebhookAction[]> => {
      const actions: WebhookAction[] = [];

      switch (payload.event) {
        case 'message':
          // Only process messages that mention the bot or are direct messages
          if (payload.data.text?.includes('@bot') || payload.data.channel_type === 'im') {
            actions.push({
              type: 'create_task',
              data: {
                type: 'communication',
                priority: 'medium',
                data: {
                  messageId: payload.data.ts,
                  channel: payload.data.channel,
                  user: payload.data.user,
                  text: payload.data.text
                }
              }
            });
          }
          break;

        case 'file_shared':
          actions.push({
            type: 'create_task',
            data: {
              type: 'document_processing',
              priority: 'low',
              data: {
                fileId: payload.data.file_id,
                filename: payload.data.name,
                user: payload.data.user
              }
            }
          });
          break;

        default:
          logger.warn(`Unhandled Slack webhook event: ${payload.event}`);
      }

      return actions;
    });

    // Salesforce webhook processor
    this.processors.set(ExternalService.SALESFORCE, async (payload: WebhookPayload): Promise<WebhookAction[]> => {
      const actions: WebhookAction[] = [];

      switch (payload.event) {
        case 'lead.created':
          actions.push({
            type: 'create_task',
            data: {
              type: 'lead_processing',
              priority: 'high',
              data: {
                leadId: payload.data.Id,
                name: payload.data.Name,
                email: payload.data.Email,
                company: payload.data.Company
              }
            }
          });
          break;

        case 'opportunity.updated':
          actions.push({
            type: 'send_notification',
            data: {
              type: 'opportunity_update',
              opportunityId: payload.data.Id,
              stage: payload.data.StageName,
              amount: payload.data.Amount
            }
          });
          break;

        case 'case.created':
          actions.push({
            type: 'create_task',
            data: {
              type: 'case_processing',
              priority: 'urgent',
              data: {
                caseId: payload.data.Id,
                subject: payload.data.Subject,
                priority: payload.data.Priority,
                accountId: payload.data.AccountId
              }
            }
          });
          break;

        default:
          logger.warn(`Unhandled Salesforce webhook event: ${payload.event}`);
      }

      return actions;
    });

    // Microsoft Teams webhook processor
    this.processors.set('microsoft_teams' as ExternalService, async (payload: WebhookPayload): Promise<WebhookAction[]> => {
      const actions: WebhookAction[] = [];

      switch (payload.event) {
        case 'message.created':
          // Only process messages that mention the bot
          if (payload.data.mentions?.some((mention: any) => mention.mentioned?.application)) {
            actions.push({
              type: 'create_task',
              data: {
                type: 'communication',
                priority: 'medium',
                data: {
                  messageId: payload.data.id,
                  chatId: payload.data.chatId,
                  channelId: payload.data.channelIdentity?.channelId,
                  from: payload.data.from,
                  body: payload.data.body
                }
              }
            });
          }
          break;

        case 'meeting.started':
          actions.push({
            type: 'create_task',
            data: {
              type: 'meeting_processing',
              priority: 'medium',
              data: {
                meetingId: payload.data.id,
                subject: payload.data.subject,
                organizer: payload.data.organizer,
                startTime: payload.data.startDateTime
              }
            }
          });
          break;

        default:
          logger.warn(`Unhandled Microsoft Teams webhook event: ${payload.event}`);
      }

      return actions;
    });
  }

  /**
   * Setup signature validators for different services
   */
  private setupSignatureValidators(): void {
    // Gmail/Google webhook signature validation
    this.signatureValidators.set(ExternalService.GMAIL, (payload: any, signature: string, secret: string): boolean => {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    });

    // Slack webhook signature validation
    this.signatureValidators.set(ExternalService.SLACK, (payload: any, signature: string, secret: string): boolean => {
      const timestamp = payload.timestamp || Math.floor(Date.now() / 1000);
      const baseString = `v0:${timestamp}:${JSON.stringify(payload)}`;
      const expectedSignature = 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(baseString)
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    });

    // Salesforce webhook signature validation
    this.signatureValidators.set(ExternalService.SALESFORCE, (payload: any, signature: string, secret: string): boolean => {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('base64');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    });

    // Microsoft webhook signature validation (used for Outlook and Teams)
    const microsoftValidator = (payload: any, signature: string, secret: string): boolean => {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    };

    this.signatureValidators.set(ExternalService.OUTLOOK, microsoftValidator);
    this.signatureValidators.set('microsoft_teams' as ExternalService, microsoftValidator);
  }

  /**
   * Parse webhook payload into standard format
   */
  private parsePayload(payload: any): WebhookPayload {
    // Detect service from payload structure
    const source = this.getServiceFromPayload(payload);
    
    return {
      source,
      event: payload.event || payload.eventType || payload.type || 'unknown',
      data: payload.data || payload,
      timestamp: new Date(payload.timestamp || payload.eventTime || Date.now()),
      signature: payload.signature || payload.headers?.['x-signature']
    };
  }

  /**
   * Detect service from payload structure
   */
  private getServiceFromPayload(payload: any): ExternalService {
    // Gmail/Google webhooks typically have a 'message' field and 'emailAddress'
    if (payload.message || payload.emailAddress) {
      return ExternalService.GMAIL;
    }

    // Outlook webhooks have 'subscriptionId' and Microsoft Graph structure
    if (payload.subscriptionId || payload.resource?.includes('microsoft.graph')) {
      return ExternalService.OUTLOOK;
    }

    // Slack webhooks have 'team_id' or 'api_app_id'
    if (payload.team_id || payload.api_app_id || payload.event?.type) {
      return ExternalService.SLACK;
    }

    // Salesforce webhooks have 'organizationId' or Salesforce-specific fields
    if (payload.organizationId || payload.sobject) {
      return ExternalService.SALESFORCE;
    }

    // Microsoft Teams webhooks have 'activity' or Teams-specific structure
    if (payload.activity || payload.channelData?.tenant) {
      return 'microsoft_teams' as ExternalService;
    }

    // Default fallback
    logger.warn('Could not detect service from webhook payload', { payload });
    return ExternalService.GMAIL; // Default fallback
  }

  /**
   * Execute webhook actions
   */
  private async executeActions(integrationId: string, actions: WebhookAction[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_task':
            this.emit('action:create_task', {
              integrationId,
              taskData: action.data
            });
            break;

          case 'update_record':
            this.emit('action:update_record', {
              integrationId,
              recordData: action.data
            });
            break;

          case 'send_notification':
            this.emit('action:send_notification', {
              integrationId,
              notificationData: action.data
            });
            break;

          case 'trigger_workflow':
            this.emit('action:trigger_workflow', {
              integrationId,
              workflowData: action.data
            });
            break;

          default:
            logger.warn(`Unknown webhook action type: ${action.type}`);
        }
      } catch (error) {
        logger.error(`Failed to execute webhook action`, {
          integrationId,
          actionType: action.type,
          error: error.message
        });
      }
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:'; // Only allow HTTPS for security
    } catch {
      return false;
    }
  }

  /**
   * Get webhook registration for integration
   */
  getRegistration(integrationId: string): WebhookRegistration | undefined {
    return this.registrations.get(integrationId);
  }

  /**
   * Get all webhook registrations
   */
  getAllRegistrations(): WebhookRegistration[] {
    return Array.from(this.registrations.values());
  }
}