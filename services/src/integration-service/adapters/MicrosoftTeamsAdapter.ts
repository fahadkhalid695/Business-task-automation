import { 
  IntegrationAdapter, 
  ConnectionTestResult, 
  SyncOptions, 
  SyncResult, 
  WebhookPayload, 
  WebhookResult, 
  HealthStatus,
  TeamsMessage,
  TeamsUser,
  TeamsMessageBody,
  TeamsAttachment,
  TeamsMention
} from '../types/IntegrationTypes';
import { EncryptedCredentials, IntegrationConfig } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

/**
 * MicrosoftTeamsAdapter - Integration adapter for Microsoft Teams API
 */
export class MicrosoftTeamsAdapter implements IntegrationAdapter {
  private credentials: any;
  private config: IntegrationConfig;
  private isConnected: boolean = false;
  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private lastSyncToken?: string;

  /**
   * Connect to Microsoft Teams API
   */
  async connect(credentials: EncryptedCredentials, config: IntegrationConfig): Promise<boolean> {
    try {
      logger.info('Connecting to Microsoft Teams API');
      
      this.credentials = credentials;
      this.config = config;
      
      const testResult = await this.testConnection();
      this.isConnected = testResult.success;
      
      if (this.isConnected) {
        logger.info('Successfully connected to Microsoft Teams API');
      } else {
        logger.error('Failed to connect to Microsoft Teams API', { error: testResult.error });
      }
      
      return this.isConnected;
    } catch (error) {
      logger.error('Microsoft Teams connection failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Microsoft Teams API
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Microsoft Teams API');
      this.isConnected = false;
      this.credentials = null;
      this.config = {};
      this.lastSyncToken = undefined;
      logger.info('Disconnected from Microsoft Teams API');
    } catch (error) {
      logger.error('Error during Microsoft Teams disconnection', { error: error.message });
    }
  }

  /**
   * Test Microsoft Teams API connection
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

      logger.info('Microsoft Teams connection test successful', {
        userPrincipalName: profile.userPrincipalName,
        displayName: profile.displayName,
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
   * Sync data from Microsoft Teams
   */
  async syncData(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Microsoft Teams API');
      }

      logger.info('Starting Microsoft Teams data sync', { options });

      let recordsProcessed = 0;
      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: any[] = [];

      // Get teams first
      const teamsResponse = await fetch(`${this.baseUrl}/me/joinedTeams`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!teamsResponse.ok) {
        throw new Error(`Microsoft Teams API error: ${teamsResponse.status}`);
      }

      const teamsData = await teamsResponse.json();
      const teams = teamsData.value || [];

      // Sync messages from each team
      for (const team of teams) {
        try {
          const teamResult = await this.syncTeamMessages(team.id, options);
          recordsProcessed += teamResult.recordsProcessed;
          recordsCreated += teamResult.recordsCreated;
          errors.push(...teamResult.errors);
        } catch (error) {
          errors.push({
            recordId: team.id,
            error: error.message,
            retryable: true
          });
          logger.error('Failed to sync team messages', {
            teamId: team.id,
            error: error.message
          });
        }
      }

      // Also sync direct chats
      try {
        const chatsResult = await this.syncChatMessages(options);
        recordsProcessed += chatsResult.recordsProcessed;
        recordsCreated += chatsResult.recordsCreated;
        errors.push(...chatsResult.errors);
      } catch (error) {
        errors.push({
          recordId: 'chats',
          error: error.message,
          retryable: true
        });
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

      logger.info('Microsoft Teams sync completed', {
        recordsProcessed,
        recordsCreated,
        errors: errors.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Microsoft Teams sync failed', { error: error.message });
      
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
   * Sync messages from a specific team
   */
  private async syncTeamMessages(teamId: string, options?: SyncOptions): Promise<{
    recordsProcessed: number;
    recordsCreated: number;
    errors: any[];
  }> {
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: any[] = [];

    try {
      // Get channels in the team
      const channelsResponse = await fetch(`${this.baseUrl}/teams/${teamId}/channels`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!channelsResponse.ok) {
        throw new Error(`Failed to get channels for team ${teamId}: ${channelsResponse.status}`);
      }

      const channelsData = await channelsResponse.json();
      const channels = channelsData.value || [];

      // Sync messages from each channel
      for (const channel of channels) {
        try {
          const channelResult = await this.syncChannelMessages(teamId, channel.id, options);
          recordsProcessed += channelResult.recordsProcessed;
          recordsCreated += channelResult.recordsCreated;
          errors.push(...channelResult.errors);
        } catch (error) {
          errors.push({
            recordId: `${teamId}/${channel.id}`,
            error: error.message,
            retryable: true
          });
        }
      }

    } catch (error) {
      errors.push({
        recordId: teamId,
        error: error.message,
        retryable: true
      });
    }

    return { recordsProcessed, recordsCreated, errors };
  }

  /**
   * Sync messages from a specific channel
   */
  private async syncChannelMessages(teamId: string, channelId: string, options?: SyncOptions): Promise<{
    recordsProcessed: number;
    recordsCreated: number;
    errors: any[];
  }> {
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: any[] = [];

    try {
      let url = `${this.baseUrl}/teams/${teamId}/channels/${channelId}/messages`;
      
      if (options?.batchSize) {
        url += `?$top=${options.batchSize}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.status}`);
      }

      const data = await response.json();
      const messages = data.value || [];

      for (const message of messages) {
        try {
          const processedMessage = this.processMessage(message, channelId);
          
          recordsProcessed++;
          recordsCreated++;
          
          logger.debug('Processed Teams message', {
            messageId: message.id,
            channelId,
            from: message.from?.user?.displayName
          });

        } catch (error) {
          errors.push({
            recordId: message.id,
            error: error.message,
            retryable: true
          });
        }
      }

    } catch (error) {
      errors.push({
        recordId: `${teamId}/${channelId}`,
        error: error.message,
        retryable: true
      });
    }

    return { recordsProcessed, recordsCreated, errors };
  }

  /**
   * Sync direct chat messages
   */
  private async syncChatMessages(options?: SyncOptions): Promise<{
    recordsProcessed: number;
    recordsCreated: number;
    errors: any[];
  }> {
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: any[] = [];

    try {
      let url = `${this.baseUrl}/me/chats`;
      
      if (options?.batchSize) {
        url += `?$top=${options.batchSize}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get chats: ${response.status}`);
      }

      const data = await response.json();
      const chats = data.value || [];

      for (const chat of chats) {
        try {
          const chatResult = await this.syncSingleChatMessages(chat.id, options);
          recordsProcessed += chatResult.recordsProcessed;
          recordsCreated += chatResult.recordsCreated;
          errors.push(...chatResult.errors);
        } catch (error) {
          errors.push({
            recordId: chat.id,
            error: error.message,
            retryable: true
          });
        }
      }

    } catch (error) {
      errors.push({
        recordId: 'chats',
        error: error.message,
        retryable: true
      });
    }

    return { recordsProcessed, recordsCreated, errors };
  }

  /**
   * Sync messages from a single chat
   */
  private async syncSingleChatMessages(chatId: string, options?: SyncOptions): Promise<{
    recordsProcessed: number;
    recordsCreated: number;
    errors: any[];
  }> {
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: any[] = [];

    try {
      let url = `${this.baseUrl}/me/chats/${chatId}/messages`;
      
      if (options?.batchSize) {
        url += `?$top=${options.batchSize}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get chat messages: ${response.status}`);
      }

      const data = await response.json();
      const messages = data.value || [];

      for (const message of messages) {
        try {
          const processedMessage = this.processMessage(message, chatId);
          
          recordsProcessed++;
          recordsCreated++;

        } catch (error) {
          errors.push({
            recordId: message.id,
            error: error.message,
            retryable: true
          });
        }
      }

    } catch (error) {
      errors.push({
        recordId: chatId,
        error: error.message,
        retryable: true
      });
    }

    return { recordsProcessed, recordsCreated, errors };
  }

  /**
   * Handle Microsoft Teams webhook
   */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    try {
      logger.info('Processing Microsoft Teams webhook', { event: payload.event });

      const actions: any[] = [];

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

        case 'file.shared':
          actions.push({
            type: 'create_task',
            data: {
              type: 'document_processing',
              priority: 'low',
              data: {
                fileId: payload.data.id,
                filename: payload.data.name,
                sharedBy: payload.data.sharedBy
              }
            }
          });
          break;

        default:
          logger.warn(`Unhandled Microsoft Teams webhook event: ${payload.event}`);
      }

      return {
        processed: true,
        actions
      };

    } catch (error) {
      logger.error('Failed to process Microsoft Teams webhook', { error: error.message });
      
      return {
        processed: false,
        actions: [],
        error: error.message
      };
    }
  }

  /**
   * Get Microsoft Teams adapter health status
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
   * Process Teams message into standardized format
   */
  private processMessage(message: any, contextId: string): TeamsMessage {
    const from: TeamsUser = {
      id: message.from?.user?.id || message.from?.application?.id || '',
      displayName: message.from?.user?.displayName || message.from?.application?.displayName || '',
      userPrincipalName: message.from?.user?.userIdentityType === 'aadUser' ? 
        message.from.user.userPrincipalName : ''
    };

    const body: TeamsMessageBody = {
      contentType: message.body?.contentType === 'html' ? 'html' : 'text',
      content: message.body?.content || ''
    };

    const attachments: TeamsAttachment[] = (message.attachments || []).map((att: any) => ({
      id: att.id,
      name: att.name,
      contentType: att.contentType,
      contentUrl: att.contentUrl
    }));

    const mentions: TeamsMention[] = (message.mentions || []).map((mention: any) => ({
      id: mention.id,
      mentionText: mention.mentionText,
      mentioned: {
        id: mention.mentioned?.user?.id || mention.mentioned?.application?.id || '',
        displayName: mention.mentioned?.user?.displayName || mention.mentioned?.application?.displayName || '',
        userPrincipalName: mention.mentioned?.user?.userPrincipalName || ''
      }
    }));

    return {
      id: message.id,
      chatId: message.chatId,
      channelId: contextId,
      from,
      body,
      attachments,
      mentions,
      createdDateTime: new Date(message.createdDateTime),
      importance: message.importance || 'normal'
    };
  }

  /**
   * Send message to Teams channel or chat
   */
  async sendMessage(
    targetId: string, 
    content: string, 
    options?: {
      isChannel?: boolean;
      teamId?: string;
      contentType?: 'text' | 'html';
    }
  ): Promise<boolean> {
    try {
      let url: string;
      
      if (options?.isChannel && options?.teamId) {
        url = `${this.baseUrl}/teams/${options.teamId}/channels/${targetId}/messages`;
      } else {
        url = `${this.baseUrl}/me/chats/${targetId}/messages`;
      }

      const requestBody = {
        body: {
          contentType: options?.contentType || 'text',
          content
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Microsoft Teams API error: ${response.status}`);
      }

      const data = await response.json();

      logger.info('Message sent to Microsoft Teams', {
        targetId,
        messageId: data.id,
        isChannel: options?.isChannel
      });

      return true;

    } catch (error) {
      logger.error('Failed to send Microsoft Teams message', {
        targetId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get team information
   */
  async getTeamInfo(teamId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/teams/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Microsoft Teams API error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      logger.error('Failed to get Microsoft Teams team info', {
        teamId,
        error: error.message
      });
      return null;
    }
  }
}