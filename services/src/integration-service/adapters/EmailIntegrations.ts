import { BaseIntegration, IntegrationConfig } from '../IntegrationEcosystem';
import { logger } from '../../shared/utils/Logger';
import axios, { AxiosInstance } from 'axios';
import nodemailer from 'nodemailer';

// Gmail Integration
export class GmailIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: false,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://gmail.googleapis.com/gmail/v1',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me/profile');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Gmail API connected' : 'Gmail API connection failed'
    };
  }

  async sendEmail(to: string[], subject: string, body: string, attachments?: any[]): Promise<boolean> {
    try {
      const emailContent = this.createEmailContent(to, subject, body, attachments);
      const response = await this.client.post('/users/me/messages/send', {
        raw: Buffer.from(emailContent).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      });
      return response.status === 200;
    } catch (error) {
      logger.error('Gmail send failed:', error);
      return false;
    }
  }

  async getEmails(query: string = '', maxResults: number = 10): Promise<any[]> {
    try {
      const response = await this.client.get('/users/me/messages', {
        params: { q: query, maxResults }
      });
      return response.data.messages || [];
    } catch (error) {
      logger.error('Gmail fetch failed:', error);
      return [];
    }
  }

  private createEmailContent(to: string[], subject: string, body: string, attachments?: any[]): string {
    const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
    
    let content = [
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      body,
      ''
    ].join('\r\n');

    if (attachments) {
      for (const attachment of attachments) {
        content += [
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          '',
          attachment.content.toString('base64'),
          ''
        ].join('\r\n');
      }
    }

    content += `--${boundary}--`;
    return content;
  }
}

// Outlook Integration
export class OutlookIntegration extends BaseIntegration {
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
      message: isHealthy ? 'Outlook API connected' : 'Outlook API connection failed'
    };
  }

  async sendEmail(to: string[], subject: string, body: string, attachments?: any[]): Promise<boolean> {
    try {
      const message = {
        subject,
        body: {
          contentType: 'HTML',
          content: body
        },
        toRecipients: to.map(email => ({
          emailAddress: { address: email }
        })),
        attachments: attachments?.map(att => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.filename,
          contentType: att.contentType,
          contentBytes: att.content.toString('base64')
        })) || []
      };

      const response = await this.client.post('/me/sendMail', { message });
      return response.status === 202;
    } catch (error) {
      logger.error('Outlook send failed:', error);
      return false;
    }
  }

  async getEmails(filter?: string, top: number = 10): Promise<any[]> {
    try {
      const params: any = { $top: top };
      if (filter) params.$filter = filter;

      const response = await this.client.get('/me/messages', { params });
      return response.data.value || [];
    } catch (error) {
      logger.error('Outlook fetch failed:', error);
      return [];
    }
  }
}

// Exchange Integration
export class ExchangeIntegration extends BaseIntegration {
  private transporter: nodemailer.Transporter;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: false,
      realtime: false,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.transporter = nodemailer.createTransporter({
      host: this.config.credentials.host,
      port: this.config.credentials.port || 587,
      secure: this.config.credentials.secure || false,
      auth: {
        user: this.config.credentials.username,
        pass: this.config.credentials.password
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Exchange server connected' : 'Exchange server connection failed'
    };
  }

  async sendEmail(to: string[], subject: string, body: string, attachments?: any[]): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.config.credentials.from,
        to: to.join(', '),
        subject,
        html: body,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        })) || []
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      logger.error('Exchange send failed:', error);
      return false;
    }
  }
}