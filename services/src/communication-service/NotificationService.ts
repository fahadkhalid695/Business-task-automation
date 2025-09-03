import nodemailer from 'nodemailer';
import axios from 'axios';
import {
  NotificationMessage,
  NotificationChannelType,
  NotificationRecipient,
  NotificationStatus,
  NotificationChannelConfig
} from './types';
import { logger } from '../shared/utils/logger';

export class NotificationService {
  private emailTransporter: nodemailer.Transporter;
  private slackConfig: { botToken: string; signingSecret: string };
  private smsConfig: { provider: string; apiKey: string; from: string };
  private webhookConfig: { defaultTimeout: number };

  constructor(config: {
    email: {
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: { user: string; pass: string };
      };
    };
    slack: {
      botToken: string;
      signingSecret: string;
    };
    sms: {
      provider: string;
      apiKey: string;
      from: string;
    };
  }) {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: config.email.smtp.auth
    });

    this.slackConfig = config.slack;
    this.smsConfig = config.sms;
    this.webhookConfig = { defaultTimeout: 10000 };
  }

  /**
   * Send notification through multiple channels
   * Requirement 3.5: Implement notification system for various channels
   */
  async send(notification: NotificationMessage): Promise<{
    success: boolean;
    results: { [channel: string]: boolean };
    errors: string[];
  }> {
    try {
      logger.info('Sending notification', {
        notificationId: notification.id,
        channels: notification.channels,
        recipientCount: notification.recipients.length
      });

      const results: { [channel: string]: boolean } = {};
      const errors: string[] = [];

      // Send through each channel
      const channelPromises = notification.channels.map(async (channel) => {
        try {
          const success = await this.sendToChannel(notification, channel);
          results[channel] = success;
          return success;
        } catch (error) {
          logger.error(`Error sending to ${channel}`, error);
          results[channel] = false;
          errors.push(`${channel}: ${error.message}`);
          return false;
        }
      });

      const channelResults = await Promise.allSettled(channelPromises);
      const overallSuccess = channelResults.some(result => 
        result.status === 'fulfilled' && result.value === true
      );

      // Update notification status
      notification.status = overallSuccess ? NotificationStatus.SENT : NotificationStatus.FAILED;
      notification.sentAt = new Date();

      logger.info('Notification sending completed', {
        notificationId: notification.id,
        success: overallSuccess,
        results,
        errorCount: errors.length
      });

      return {
        success: overallSuccess,
        results,
        errors
      };

    } catch (error) {
      logger.error('Error sending notification', error);
      notification.status = NotificationStatus.FAILED;
      
      return {
        success: false,
        results: {},
        errors: [error.message]
      };
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(
    recipients: string[],
    subject: string,
    content: string,
    options: {
      html?: string;
      attachments?: any[];
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@businessautomation.com',
        to: recipients.join(', '),
        subject,
        text: content,
        html: options.html || this.convertTextToHtml(content),
        attachments: options.attachments || [],
        priority: options.priority || 'normal'
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        recipients: recipients.length,
        subject
      });

      return true;

    } catch (error) {
      logger.error('Error sending email', error);
      return false;
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlack(
    channels: string[],
    message: string,
    options: {
      username?: string;
      iconEmoji?: string;
      attachments?: any[];
      blocks?: any[];
    } = {}
  ): Promise<boolean> {
    try {
      const promises = channels.map(async (channel) => {
        const payload = {
          channel: channel.startsWith('#') ? channel : `#${channel}`,
          text: message,
          username: options.username || 'Business Automation Bot',
          icon_emoji: options.iconEmoji || ':robot_face:',
          attachments: options.attachments,
          blocks: options.blocks
        };

        const response = await axios.post(
          'https://slack.com/api/chat.postMessage',
          payload,
          {
            headers: {
              'Authorization': `Bearer ${this.slackConfig.botToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.data.ok) {
          throw new Error(`Slack API error: ${response.data.error}`);
        }

        return true;
      });

      const results = await Promise.all(promises);
      const success = results.every(result => result === true);

      logger.info('Slack notification sent', {
        channels: channels.length,
        success
      });

      return success;

    } catch (error) {
      logger.error('Error sending Slack notification', error);
      return false;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(
    phoneNumbers: string[],
    message: string
  ): Promise<boolean> {
    try {
      // This is a simplified SMS implementation
      // In a real implementation, you'd integrate with services like Twilio, AWS SNS, etc.
      
      if (this.smsConfig.provider === 'twilio') {
        return await this.sendTwilioSMS(phoneNumbers, message);
      } else if (this.smsConfig.provider === 'aws-sns') {
        return await this.sendAWSSNS(phoneNumbers, message);
      } else {
        throw new Error(`Unsupported SMS provider: ${this.smsConfig.provider}`);
      }

    } catch (error) {
      logger.error('Error sending SMS', error);
      return false;
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(
    url: string,
    payload: any,
    options: {
      method?: 'POST' | 'PUT';
      headers?: { [key: string]: string };
      timeout?: number;
    } = {}
  ): Promise<boolean> {
    try {
      const response = await axios({
        method: options.method || 'POST',
        url,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: options.timeout || this.webhookConfig.defaultTimeout
      });

      const success = response.status >= 200 && response.status < 300;
      
      logger.info('Webhook notification sent', {
        url,
        status: response.status,
        success
      });

      return success;

    } catch (error) {
      logger.error('Error sending webhook notification', error);
      return false;
    }
  }

  /**
   * Schedule notification for later delivery
   */
  async scheduleNotification(
    notification: NotificationMessage,
    scheduledAt: Date
  ): Promise<string> {
    try {
      // In a real implementation, this would integrate with a job queue like Bull
      // For now, we'll use a simple setTimeout for demonstration
      
      const delay = scheduledAt.getTime() - Date.now();
      
      if (delay <= 0) {
        // Send immediately if scheduled time is in the past
        await this.send(notification);
        return notification.id;
      }

      setTimeout(async () => {
        try {
          await this.send(notification);
        } catch (error) {
          logger.error('Error sending scheduled notification', error);
        }
      }, delay);

      logger.info('Notification scheduled', {
        notificationId: notification.id,
        scheduledAt,
        delay
      });

      return notification.id;

    } catch (error) {
      logger.error('Error scheduling notification', error);
      throw error;
    }
  }

  // Private helper methods
  private async sendToChannel(
    notification: NotificationMessage,
    channel: NotificationChannelType
  ): Promise<boolean> {
    const recipients = this.getRecipientsForChannel(notification.recipients, channel);
    
    if (recipients.length === 0) {
      logger.warn(`No recipients found for channel ${channel}`);
      return false;
    }

    switch (channel) {
      case NotificationChannelType.EMAIL:
        return await this.sendEmail(
          recipients,
          notification.title,
          notification.content,
          {
            priority: notification.priority === 'urgent' ? 'high' : 'normal'
          }
        );

      case NotificationChannelType.SLACK:
        return await this.sendSlack(
          recipients,
          `*${notification.title}*\n${notification.content}`,
          {
            username: 'Business Automation',
            iconEmoji: this.getPriorityEmoji(notification.priority)
          }
        );

      case NotificationChannelType.SMS:
        const smsMessage = `${notification.title}: ${notification.content}`;
        return await this.sendSMS(recipients, smsMessage);

      case NotificationChannelType.WEBHOOK:
        if (recipients.length > 0) {
          return await this.sendWebhook(recipients[0], {
            id: notification.id,
            title: notification.title,
            content: notification.content,
            priority: notification.priority,
            timestamp: new Date().toISOString()
          });
        }
        return false;

      default:
        logger.warn(`Unsupported notification channel: ${channel}`);
        return false;
    }
  }

  private getRecipientsForChannel(
    recipients: NotificationRecipient[],
    channel: NotificationChannelType
  ): string[] {
    return recipients
      .filter(recipient => 
        !recipient.preferences || 
        recipient.preferences.channels.includes(channel)
      )
      .map(recipient => {
        // In a real implementation, you'd resolve user/group/role identifiers
        // to actual contact information (email, phone, slack channel, etc.)
        return recipient.identifier;
      });
  }

  private getPriorityEmoji(priority: string): string {
    const emojiMap: { [key: string]: string } = {
      'urgent': ':rotating_light:',
      'high': ':warning:',
      'medium': ':information_source:',
      'low': ':memo:'
    };

    return emojiMap[priority] || ':information_source:';
  }

  private convertTextToHtml(text: string): string {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  private async sendTwilioSMS(phoneNumbers: string[], message: string): Promise<boolean> {
    try {
      // Placeholder for Twilio integration
      // const twilio = require('twilio')(accountSid, authToken);
      
      logger.info('Twilio SMS would be sent here', {
        phoneNumbers: phoneNumbers.length,
        messageLength: message.length
      });

      return true;

    } catch (error) {
      logger.error('Error sending Twilio SMS', error);
      return false;
    }
  }

  private async sendAWSSNS(phoneNumbers: string[], message: string): Promise<boolean> {
    try {
      // Placeholder for AWS SNS integration
      logger.info('AWS SNS SMS would be sent here', {
        phoneNumbers: phoneNumbers.length,
        messageLength: message.length
      });

      return true;

    } catch (error) {
      logger.error('Error sending AWS SNS SMS', error);
      return false;
    }
  }
}