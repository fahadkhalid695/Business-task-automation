import { ExternalAPIService } from '../../shared/services/ExternalAPIService';
import { logger } from '../../shared/utils/Logger';

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export class GmailIntegration {
  private apiService: ExternalAPIService;

  constructor() {
    this.apiService = ExternalAPIService.getInstance();
  }

  async sendEmail(message: EmailMessage): Promise<boolean> {
    try {
      const gmailClient = this.apiService.getClient('gmail');
      if (!gmailClient) {
        throw new Error('Gmail API not configured');
      }

      const emailContent = this.createEmailContent(message);
      
      const response = await gmailClient.post('/users/me/messages/send', {
        raw: Buffer.from(emailContent).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      });

      logger.info(`Email sent successfully: ${response.data.id}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async getEmails(query: string = '', maxResults: number = 10): Promise<any[]> {
    try {
      const gmailClient = this.apiService.getClient('gmail');
      if (!gmailClient) {
        throw new Error('Gmail API not configured');
      }

      const response = await gmailClient.get('/users/me/messages', {
        params: { q: query, maxResults }
      });

      const messages = [];
      for (const message of response.data.messages || []) {
        const messageDetail = await gmailClient.get(`/users/me/messages/${message.id}`);
        messages.push(messageDetail.data);
      }

      return messages;
    } catch (error) {
      logger.error('Failed to get emails:', error);
      return [];
    }
  }

  private createEmailContent(message: EmailMessage): string {
    const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
    
    let content = [
      `To: ${message.to.join(', ')}`,
      message.cc ? `Cc: ${message.cc.join(', ')}` : '',
      message.bcc ? `Bcc: ${message.bcc.join(', ')}` : '',
      `Subject: ${message.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      message.body,
      ''
    ].filter(Boolean).join('\r\n');

    // Add attachments if any
    if (message.attachments) {
      for (const attachment of message.attachments) {
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