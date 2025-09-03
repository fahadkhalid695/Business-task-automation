import { 
  IntegrationAdapter, 
  ConnectionTestResult, 
  SyncOptions, 
  SyncResult, 
  WebhookPayload, 
  WebhookResult, 
  HealthStatus,
  GmailMessage,
  GmailAttachment
} from '../types/IntegrationTypes';
import { EncryptedCredentials, IntegrationConfig } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

/**
 * GmailAdapter - Integration adapter for Gmail API
 */
export class GmailAdapter implements IntegrationAdapter {
  private credentials: any;
  private config: IntegrationConfig;
  private isConnected: boolean = false;
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  private lastSyncToken?: string;

  /**
   * Connect to Gmail API
   */
  async connect(credentials: EncryptedCredentials, config: IntegrationConfig): Promise<boolean> {
    try {
      logger.info('Connecting to Gmail API');
      
      // In a real implementation, you would decrypt credentials here
      this.credentials = credentials; // Assume already decrypted for this example
      this.config = config;
      
      // Test the connection
      const testResult = await this.testConnection();
      this.isConnected = testResult.success;
      
      if (this.isConnected) {
        logger.info('Successfully connected to Gmail API');
      } else {
        logger.error('Failed to connect to Gmail API', { error: testResult.error });
      }
      
      return this.isConnected;
    } catch (error) {
      logger.error('Gmail connection failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Gmail API
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Gmail API');
      this.isConnected = false;
      this.credentials = null;
      this.config = {};
      this.lastSyncToken = undefined;
      logger.info('Disconnected from Gmail API');
    } catch (error) {
      logger.error('Error during Gmail disconnection', { error: error.message });
    }
  }

  /**
   * Test Gmail API connection
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

      // Test connection by getting user profile
      const response = await fetch(`${this.baseUrl}/users/me/profile`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Gmail API error: ${response.status} - ${errorText}`,
          timestamp: new Date()
        };
      }

      const profile = await response.json();
      const latency = Date.now() - startTime;

      logger.info('Gmail connection test successful', {
        emailAddress: profile.emailAddress,
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
   * Sync data from Gmail
   */
  async syncData(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Gmail API');
      }

      logger.info('Starting Gmail data sync', { options });

      let recordsProcessed = 0;
      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: any[] = [];

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('maxResults', (options?.batchSize || 100).toString());
      
      if (this.lastSyncToken && !options?.fullSync) {
        queryParams.append('pageToken', this.lastSyncToken);
      }

      // Apply filters if provided
      if (options?.filters) {
        const query = this.buildGmailQuery(options.filters);
        if (query) {
          queryParams.append('q', query);
        }
      }

      // Fetch messages
      const messagesResponse = await fetch(
        `${this.baseUrl}/users/me/messages?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!messagesResponse.ok) {
        throw new Error(`Gmail API error: ${messagesResponse.status}`);
      }

      const messagesData = await messagesResponse.json();
      const messages = messagesData.messages || [];

      // Process each message
      for (const messageRef of messages) {
        try {
          const message = await this.fetchMessageDetails(messageRef.id);
          const processedMessage = this.processMessage(message);
          
          // In a real implementation, you would save this to your database
          // For now, we'll just count it as processed
          recordsProcessed++;
          recordsCreated++; // Assuming all are new for this example
          
          logger.debug('Processed Gmail message', {
            messageId: message.id,
            subject: processedMessage.subject,
            from: processedMessage.from
          });

        } catch (error) {
          errors.push({
            recordId: messageRef.id,
            error: error.message,
            retryable: true
          });
          logger.error('Failed to process Gmail message', {
            messageId: messageRef.id,
            error: error.message
          });
        }
      }

      // Update sync token for next sync
      if (messagesData.nextPageToken) {
        this.lastSyncToken = messagesData.nextPageToken;
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

      logger.info('Gmail sync completed', {
        recordsProcessed,
        recordsCreated,
        errors: errors.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Gmail sync failed', { error: error.message });
      
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
   * Handle Gmail webhook
   */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    try {
      logger.info('Processing Gmail webhook', { event: payload.event });

      const actions: any[] = [];

      switch (payload.event) {
        case 'message_received':
          // Fetch the new message details
          if (payload.data.messageId) {
            const message = await this.fetchMessageDetails(payload.data.messageId);
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

      return {
        processed: true,
        actions
      };

    } catch (error) {
      logger.error('Failed to process Gmail webhook', { error: error.message });
      
      return {
        processed: false,
        actions: [],
        error: error.message
      };
    }
  }

  /**
   * Get Gmail adapter health status
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
      `${this.baseUrl}/users/me/messages/${messageId}?format=full`,
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
   * Process Gmail message into standardized format
   */
  private processMessage(message: any): GmailMessage {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract body content
    let body = '';
    let htmlBody = '';
    
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    // Extract attachments
    const attachments: GmailAttachment[] = [];
    if (message.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0
          });
        }
      }
    }

    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeader('From'),
      to: getHeader('To').split(',').map((email: string) => email.trim()).filter(Boolean),
      cc: getHeader('Cc').split(',').map((email: string) => email.trim()).filter(Boolean),
      bcc: getHeader('Bcc').split(',').map((email: string) => email.trim()).filter(Boolean),
      subject: getHeader('Subject'),
      body,
      htmlBody: htmlBody || undefined,
      attachments,
      labels: message.labelIds || [],
      receivedAt: new Date(parseInt(message.internalDate)),
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT') || false
    };
  }

  /**
   * Build Gmail query from filters
   */
  private buildGmailQuery(filters: any[]): string {
    const queryParts: string[] = [];

    for (const filter of filters) {
      switch (filter.field) {
        case 'from':
          queryParts.push(`from:${filter.value}`);
          break;
        case 'to':
          queryParts.push(`to:${filter.value}`);
          break;
        case 'subject':
          queryParts.push(`subject:${filter.value}`);
          break;
        case 'label':
          queryParts.push(`label:${filter.value}`);
          break;
        case 'has_attachment':
          if (filter.value) {
            queryParts.push('has:attachment');
          }
          break;
        case 'is_unread':
          if (filter.value) {
            queryParts.push('is:unread');
          }
          break;
        default:
          logger.warn(`Unsupported Gmail filter field: ${filter.field}`);
      }
    }

    return queryParts.join(' ');
  }

  /**
   * Determine message priority based on content and metadata
   */
  private determinePriority(message: GmailMessage): string {
    // High priority if marked as important or urgent keywords in subject
    if (message.isImportant || 
        /urgent|asap|emergency|critical/i.test(message.subject)) {
      return 'high';
    }

    // Medium priority for most emails
    return 'medium';
  }
}