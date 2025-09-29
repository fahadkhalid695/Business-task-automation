import { BaseIntegration, IntegrationConfig } from '../IntegrationEcosystem';
import { logger } from '../../shared/utils/Logger';
import axios, { AxiosInstance } from 'axios';

export interface Message {
  id?: string;
  text: string;
  channel?: string;
  user?: string;
  timestamp?: Date;
  attachments?: any[];
  thread?: string;
}

// Slack Integration
export class SlackIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: true,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.botToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/auth.test');
      return response.data.ok;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Slack API connected' : 'Slack API connection failed'
    };
  }

  async sendMessage(channel: string, text: string, attachments?: any[]): Promise<string | null> {
    try {
      const response = await this.client.post('/chat.postMessage', {
        channel,
        text,
        attachments
      });
      
      return response.data.ok ? response.data.ts : null;
    } catch (error) {
      logger.error('Slack send message failed:', error);
      return null;
    }
  }

  async getChannels(): Promise<any[]> {
    try {
      const response = await this.client.get('/conversations.list', {
        params: { types: 'public_channel,private_channel' }
      });
      
      return response.data.ok ? response.data.channels : [];
    } catch (error) {
      logger.error('Slack get channels failed:', error);
      return [];
    }
  }

  async getMessages(channel: string, limit: number = 100): Promise<Message[]> {
    try {
      const response = await this.client.get('/conversations.history', {
        params: { channel, limit }
      });
      
      if (!response.data.ok) return [];
      
      return response.data.messages.map((msg: any) => ({
        id: msg.ts,
        text: msg.text,
        channel,
        user: msg.user,
        timestamp: new Date(parseFloat(msg.ts) * 1000),
        attachments: msg.attachments
      }));
    } catch (error) {
      logger.error('Slack get messages failed:', error);
      return [];
    }
  }

  async createChannel(name: string, isPrivate: boolean = false): Promise<string | null> {
    try {
      const response = await this.client.post('/conversations.create', {
        name,
        is_private: isPrivate
      });
      
      return response.data.ok ? response.data.channel.id : null;
    } catch (error) {
      logger.error('Slack create channel failed:', error);
      return null;
    }
  }

  async inviteToChannel(channel: string, users: string[]): Promise<boolean> {
    try {
      const response = await this.client.post('/conversations.invite', {
        channel,
        users: users.join(',')
      });
      
      return response.data.ok;
    } catch (error) {
      logger.error('Slack invite to channel failed:', error);
      return false;
    }
  }
}

// Microsoft Teams Integration
export class MicrosoftTeamsIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: true,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/me');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Microsoft Teams connected' : 'Microsoft Teams connection failed'
    };
  }

  async sendMessage(teamId: string, channelId: string, text: string): Promise<string | null> {
    try {
      const response = await this.client.post(
        `/teams/${teamId}/channels/${channelId}/messages`,
        {
          body: {
            content: text,
            contentType: 'text'
          }
        }
      );
      
      return response.data.id;
    } catch (error) {
      logger.error('Teams send message failed:', error);
      return null;
    }
  }

  async getTeams(): Promise<any[]> {
    try {
      const response = await this.client.get('/me/joinedTeams');
      return response.data.value || [];
    } catch (error) {
      logger.error('Teams get teams failed:', error);
      return [];
    }
  }

  async getChannels(teamId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/teams/${teamId}/channels`);
      return response.data.value || [];
    } catch (error) {
      logger.error('Teams get channels failed:', error);
      return [];
    }
  }

  async getMessages(teamId: string, channelId: string): Promise<Message[]> {
    try {
      const response = await this.client.get(`/teams/${teamId}/channels/${channelId}/messages`);
      
      return response.data.value?.map((msg: any) => ({
        id: msg.id,
        text: msg.body?.content || '',
        channel: channelId,
        user: msg.from?.user?.displayName,
        timestamp: new Date(msg.createdDateTime)
      })) || [];
    } catch (error) {
      logger.error('Teams get messages failed:', error);
      return [];
    }
  }
}

// Discord Integration
export class DiscordIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: true,
      batch: false
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://discord.com/api/v10',
      headers: {
        'Authorization': `Bot ${this.config.credentials.botToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/@me');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Discord API connected' : 'Discord API connection failed'
    };
  }

  async sendMessage(channelId: string, content: string, embeds?: any[]): Promise<string | null> {
    try {
      const response = await this.client.post(`/channels/${channelId}/messages`, {
        content,
        embeds
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Discord send message failed:', error);
      return null;
    }
  }

  async getGuilds(): Promise<any[]> {
    try {
      const response = await this.client.get('/users/@me/guilds');
      return response.data || [];
    } catch (error) {
      logger.error('Discord get guilds failed:', error);
      return [];
    }
  }

  async getChannels(guildId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/guilds/${guildId}/channels`);
      return response.data || [];
    } catch (error) {
      logger.error('Discord get channels failed:', error);
      return [];
    }
  }

  async getMessages(channelId: string, limit: number = 50): Promise<Message[]> {
    try {
      const response = await this.client.get(`/channels/${channelId}/messages`, {
        params: { limit }
      });
      
      return response.data?.map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        channel: channelId,
        user: msg.author?.username,
        timestamp: new Date(msg.timestamp)
      })) || [];
    } catch (error) {
      logger.error('Discord get messages failed:', error);
      return [];
    }
  }
}