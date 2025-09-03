import { 
  IntegrationAdapter, 
  ConnectionTestResult, 
  SyncOptions, 
  SyncResult, 
  WebhookPayload, 
  WebhookResult, 
  HealthStatus,
  OutlookMessage,
  OutlookEmailAddress,
  OutlookMessageBody,
  OutlookAttachment
} from '../types/IntegrationTypes';
import { EncryptedCredentials, IntegrationConfig } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

/**
 * OutlookAdapter - Integration adapter for Microsoft Graph API (Outlook)
 */
export class OutlookAdapter implements IntegrationAdapter {
  private credentials: any;
  private config: IntegrationConfig;
  private isConnected: boolean = false;
  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private lastSyncToken?: string;

  /**
   * Connect to Microsoft Graph API
   */
  async connect(credentials: EncryptedCredentials, config: IntegrationConfig): Promise<boolean> {
    try {
      logger.info('Connecting to Microsoft Graph API');
      
      this.credentials = credentials;
      this.config = config;
      
      const testResult = await this.testConnection();
      this.isConnected = testResult.success;
      
      if (this.isConnected) {
        logger.info('Successfully connected to Microsoft Graph API');
      } else {
        logger.error('Failed to connect to Microsoft Graph API', { error: testResult.error });
      }
      
      return this.isConnected;
    } catch (error) {
      logger.error('Outlook connection failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Microsoft Graph API
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Microsoft Graph API');
      this.isConnected = false;
      this.credentials = null;
      this.config = {};
      this.lastSyncToken = undefined;
      logger.info('Disconnected from Microsoft Graph API');
    } catch (error) {
      logger.error('Error during Outlook disconnection', { error: error.message });
    }
  }

  /**
   * Test Microsoft Graph API connection
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      if (!this.credentials?.accessToken) {
        return {
          success: false,
          error: 'No access token provided',
          timestamp: new Date()
        };
      }

      const response = await fetch(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Microsoft Graph API error: ${response.status} - ${errorText}`,
          timestamp: new Date()
        };
      }

      const profile = await response.json();
      const latency = Date.now() - startTime;

      logger.info('Outlook connection test successful', {
        userPrincipalName: profile.userPrincipalName,
        latency
      });

      return {
        success: true,
        latency,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync data from Outlook
   */
  async syncData(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Microsoft Graph API');
      }

      logger.info('Starting Outlook data sync', { options });

      let recordsProcessed = 0;
      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: any[] = [];

      const queryParams = new URLSearchParams();
      queryParams.append('$top', (options?.batchSize || 100).toString());
      queryParams.append('$orderby', 'receivedDateTime desc');
      
      if (this.lastSyncToken && !options?.fullSync) {
        queryParams.append('$deltatoken', this.lastSyncToken);
      }

      if (options?.filters) {
        const filter = this.buildOutlookFilter(options.filters);
        if (filter) {
          queryParams.append('$filter', filter);
        }
      }

      const messagesResponse = await fetch(
        `${this.baseUrl}/me/messages?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!messagesResponse.ok) {
        throw new Error(`Microsoft Graph API error: ${messagesResponse.status}`);
      }

      const messagesData = await messagesResponse.json();
      const messages = messagesData.value || [];

      for (const message of messages) {
        try {
          const processedMessage = this.processMessage(message);
          
          recordsProcessed++;
          recordsCreated++;
          
          logger.debug('Processed Outlook message', {
            messageId: message.id,
            subject: processedMessage.subject,
            from: processedMessage.from.address
          });

        } catch (error) {
          errors.push({
            recordId: message.id,
            error: error.message,
            retryable: true
          });
          logger.error('Failed to process Outlook message', {
            messageId: message.id,
            error: error.message
          });
        }
      }

      if (messagesData['@odata.deltaLink']) {
        const deltaUrl = new URL(messagesData['@odata.deltaLink']);
        this.lastSyncToken = deltaUrl.searchParams.get('$deltatoken') || undefined;
      }

      const result: SyncResult = {
        success: true,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsDeleted: 0,
        errors,
        nextSyncToken: this.lastSyncToken,
        timestamp: new Date()
      };

      logger.info('Outlook sync completed', {
        recordsProcessed,
        recordsCreated,
        errors: errors.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Outlook sync failed', { error: error.message });
      
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsDeleted: 0,
        errors: [{
          error: error.message,
          retryable: true
        }],
        timestamp: new Date()
      };
    }
  }

  /**
   * Handle Outlook webhook
   */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    try {
      logger.info('Processing Outlook webhook', { event: payload.event });

      const actions: any[] = [];

      switch (payload.event) {
        case 'mail.received':
          if (payload.data.resourceData?.id) {
            const message = await this.fetchMessageDetails(payload.data.resourceData.id);
            const processedMessage = this.processMessage(message);
            
            actions.push({
              type: 'create_task',
              data: {
                type: 'email_processing',
                priority: this.determinePriority(processedMessage),
                data: processedMessage
              }
            });
          }
          break;

        case 'calendar.event.created':
          actions.push({
            type: 'create_task',
            data: {
              type: 'calendar_management',
              priority: 'high',
              data: {
                eventId: payload.data.resourceData?.id,
                changeType: payload.data.changeType
              }
            }
          });
          break;

        default:
          logger.warn(`Unhandled Outlook webhook event: ${payload.event}`);
      }

      return {
        processed: true,
        actions
      };

    } catch (error) {
      logger.error('Failed to process Outlook webhook', { error: error.message });
      
      return {
        processed: false,
        actions: [],
        error: error.message
      };
    }
  }

  /**
   * Get Outlook adapter health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const testResult = await this.testConnection();
      
      return {
        status: testResult.success ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        responseTime: testResult.latency,
        errorRate: testResult.success ? 0 : 100,
        uptime: testResult.success ? 100 : 0,
        details: {
          consecutiveFailures: testResult.success ? 0 : 1,
          lastSuccessfulSync: this.lastSyncToken ? new Date() : undefined
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        errorRate: 100,
        uptime: 0,
        details: {
          consecutiveFailures: 1
        }
      };
    }
  }

  /**
   * Fetch detailed message information
   */
  private async fetchMessageDetails(messageId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/me/messages/${messageId}?$expand=attachments`,
      {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch message ${messageId}: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Process Outlook message into standardized format
   */
  private processMessage(message: any): OutlookMessage {
    const attachments: OutlookAttachment[] = (message.attachments || []).map((att: any) => ({
      id: att.id,
      name: att.name,
      contentType: att.contentType,
      size: att.size,
      contentBytes: att.contentBytes
    }));

    return {
      id: message.id,
      conversationId: message.conversationId,
      from: {
        name: message.from?.emailAddress?.name || '',
        address: message.from?.emailAddress?.address || ''
      },
      toRecipients: (message.toRecipients || []).map((recipient: any) => ({
        name: recipient.emailAddress?.name || '',
        address: recipient.emailAddress?.address || ''
      })),
      ccRecipients: (message.ccRecipients || []).map((recipient: any) => ({
        name: recipient.emailAddress?.name || '',
        address: recipient.emailAddress?.address || ''
      })),
      bccRecipients: (message.bccRecipients || []).map((recipient: any) => ({
        name: recipient.emailAddress?.name || '',
        address: recipient.emailAddress?.address || ''
      })),
      subject: message.subject || '',
      body: {
        contentType: message.body?.contentType === 'html' ? 'html' : 'text',
        content: message.body?.content || ''
      },
      attachments,
      categories: message.categories || [],
      receivedDateTime: new Date(message.receivedDateTime),
      isRead: message.isRead || false,
      importance: message.importance || 'normal'
    };
  }

  /**
   * Build Outlook filter from filters
   */
  private buildOutlookFilter(filters: any[]): string {
    const filterParts: string[] = [];

    for (const filter of filters) {
      switch (filter.field) {
        case 'from':
          filterParts.push(`from/emailAddress/address eq '${filter.value}'`);
          break;
        case 'subject':
          filterParts.push(`contains(subject,'${filter.value}')`);
          break;
        case 'isRead':
          filterParts.push(`isRead eq ${filter.value}`);
          break;
        case 'hasAttachments':
          filterParts.push(`hasAttachments eq ${filter.value}`);
          break;
        case 'importance':
          filterParts.push(`importance eq '${filter.value}'`);
          break;
        default:
          logger.warn(`Unsupported Outlook filter field: ${filter.field}`);
      }
    }

    return filterParts.join(' and ');
  }

  /**
   * Determine message priority
   */
  private determinePriority(message: OutlookMessage): string {
    if (message.importance === 'high' || 
        /urgent|asap|emergency|critical/i.test(message.subject)) {
      return 'high';
    }
    return 'medium';
  }
}