import { 
  IntegrationAdapter, 
  ConnectionTestResult, 
  SyncOptions, 
  SyncResult, 
  WebhookPayload, 
  WebhookResult, 
  HealthStatus,
  SlackMessage,
  SlackBlock,
  SlackAttachment,
  SlackReaction
} from '../types/IntegrationTypes';
import { EncryptedCredentials, IntegrationConfig } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

/**
 * SlackAdapter - Integration adapter for Slack API
 */
export class SlackAdapter implements IntegrationAdapter {
  private credentials: any;
  private config: IntegrationConfig;
  private isConnected: boolean = false;
  private baseUrl = 'https://slack.com/api';
  private lastSyncToken?: string;

  /**
   * Connect to Slack API
   */
  async connect(credentials: EncryptedCredentials, config: IntegrationConfig): Promise<boolean> {
    try {
      logger.info('Connecting to Slack API');
      
      this.credentials = credentials;
      this.config = config;
      
      const testResult = await this.testConnection();
      this.isConnected = testResult.success;
      
      if (this.isConnected) {
        logger.info('Successfully connected to Slack API');
      } else {
        logger.error('Failed to connect to Slack API', { error: testResult.error });
      }
      
      return this.isConnected;
    } catch (error) {
      logger.error('Slack connection failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Slack API
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Slack API');
      this.isConnected = false;
      this.credentials = null;
      this.config = {};
      this.lastSyncToken = undefined;
      logger.info('Disconnected from Slack API');
    } catch (error) {
      logger.error('Error during Slack disconnection', { error: error.message });
    }
  }

  /**
   * Test Slack API connection
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      if (!this.credentials?.botToken) {
        return {
          success: false,
          error: 'No bot token provided',
          timestamp: new Date()
        };
      }

      const response = await fetch(`${this.baseUrl}/auth.test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Slack API error: ${response.status}`,
          timestamp: new Date()
        };
      }

      const data = await response.json();
      
      if (!data.ok) {
        return {
          success: false,
          error: `Slack API error: ${data.error}`,
          timestamp: new Date()
        };
      }

      const latency = Date.now() - startTime;

      logger.info('Slack connection test successful', {
        team: data.team,
        user: data.user,
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
   * Sync data from Slack
   */
  async syncData(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Slack API');
      }

      logger.info('Starting Slack data sync', { options });

      let recordsProcessed = 0;
      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: any[] = [];

      // Get channels first
      const channelsResponse = await fetch(`${this.baseUrl}/conversations.list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          types: 'public_channel,private_channel,mpim,im',
          limit: 100
        })
      });

      if (!channelsResponse.ok) {
        throw new Error(`Slack API error: ${channelsResponse.status}`);
      }

      const channelsData = await channelsResponse.json();
      
      if (!channelsData.ok) {
        throw new Error(`Slack API error: ${channelsData.error}`);
      }

      const channels = channelsData.channels || [];

      // Sync messages from each channel
      for (const channel of channels) {
        try {
          const channelMessages = await this.syncChannelMessages(channel.id, options);
          recordsProcessed += channelMessages.recordsProcessed;
          recordsCreated += channelMessages.recordsCreated;
          errors.push(...channelMessages.errors);
        } catch (error) {
          errors.push({
            recordId: channel.id,
            error: error.message,
            retryable: true
          });
          logger.error('Failed to sync channel messages', {
            channelId: channel.id,
            error: error.message
          });
        }
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

      logger.info('Slack sync completed', {
        recordsProcessed,
        recordsCreated,
        errors: errors.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Slack sync failed', { error: error.message });
      
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
   * Sync messages from a specific channel
   */
  private async syncChannelMessages(channelId: string, options?: SyncOptions): Promise<{
    recordsProcessed: number;
    recordsCreated: number;
    errors: any[];
  }> {
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: any[] = [];

    const requestBody: any = {
      channel: channelId,
      limit: options?.batchSize || 100
    };

    if (this.lastSyncToken && !options?.fullSync) {
      requestBody.oldest = this.lastSyncToken;
    }

    const response = await fetch(`${this.baseUrl}/conversations.history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    const messages = data.messages || [];

    for (const message of messages) {
      try {
        const processedMessage = this.processMessage(message, channelId);
        
        recordsProcessed++;
        recordsCreated++;
        
        logger.debug('Processed Slack message', {
          messageId: message.ts,
          channel: channelId,
          user: message.user
        });

      } catch (error) {
        errors.push({
          recordId: message.ts,
          error: error.message,
          retryable: true
        });
      }
    }

    // Update sync token with latest message timestamp
    if (messages.length > 0) {
      this.lastSyncToken = messages[0].ts;
    }

    return { recordsProcessed, recordsCreated, errors };
  }

  /**
   * Handle Slack webhook
   */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    try {
      logger.info('Processing Slack webhook', { event: payload.event });

      const actions: any[] = [];

      switch (payload.event) {
        case 'message':
          // Only process messages that mention the bot or are direct messages
          if (payload.data.text?.includes(`<@${this.credentials.botUserId}>`) || 
              payload.data.channel_type === 'im') {
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

        case 'channel_created':
          actions.push({
            type: 'send_notification',
            data: {
              type: 'channel_created',
              channelId: payload.data.channel.id,
              channelName: payload.data.channel.name,
              creator: payload.data.channel.creator
            }
          });
          break;

        default:
          logger.warn(`Unhandled Slack webhook event: ${payload.event}`);
      }

      return {
        processed: true,
        actions
      };

    } catch (error) {
      logger.error('Failed to process Slack webhook', { error: error.message });
      
      return {
        processed: false,
        actions: [],
        error: error.message
      };
    }
  }

  /**
   * Get Slack adapter health status
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
   * Process Slack message into standardized format
   */
  private processMessage(message: any, channelId: string): SlackMessage {
    const blocks: SlackBlock[] = (message.blocks || []).map((block: any) => ({
      type: block.type,
      text: block.text ? {
        type: block.text.type,
        text: block.text.text
      } : undefined,
      elements: block.elements
    }));

    const attachments: SlackAttachment[] = (message.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      filetype: file.filetype,
      size: file.size,
      url_private: file.url_private
    }));

    const reactions: SlackReaction[] = (message.reactions || []).map((reaction: any) => ({
      name: reaction.name,
      count: reaction.count,
      users: reaction.users || []
    }));

    return {
      ts: message.ts,
      channel: channelId,
      user: message.user || message.bot_id,
      text: message.text || '',
      blocks,
      attachments,
      threadTs: message.thread_ts,
      reactions
    };
  }

  /**
   * Send message to Slack channel
   */
  async sendMessage(channelId: string, text: string, options?: {
    threadTs?: string;
    blocks?: SlackBlock[];
  }): Promise<boolean> {
    try {
      const requestBody: any = {
        channel: channelId,
        text
      };

      if (options?.threadTs) {
        requestBody.thread_ts = options.threadTs;
      }

      if (options?.blocks) {
        requestBody.blocks = options.blocks;
      }

      const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      logger.info('Message sent to Slack', {
        channel: channelId,
        messageTs: data.ts
      });

      return true;

    } catch (error) {
      logger.error('Failed to send Slack message', {
        channel: channelId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channelId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations.info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channel: channelId })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return data.channel;

    } catch (error) {
      logger.error('Failed to get Slack channel info', {
        channel: channelId,
        error: error.message
      });
      return null;
    }
  }
}