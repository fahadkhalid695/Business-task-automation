import { NotificationService } from '../communication-service/NotificationService';
import {
  NotificationMessage,
  NotificationChannelType,
  NotificationStatus
} from '../communication-service/types';
import nodemailer from 'nodemailer';
import axios from 'axios';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('axios');

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;

  const mockConfig = {
    email: {
      smtp: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password'
        }
      }
    },
    slack: {
      botToken: 'xoxb-test-token',
      signingSecret: 'test-signing-secret'
    },
    sms: {
      provider: 'twilio',
      apiKey: 'test-api-key',
      from: '+1234567890'
    }
  };

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn()
    } as any;

    mockedNodemailer.createTransporter.mockReturnValue(mockTransporter);

    notificationService = new NotificationService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    const mockNotification: NotificationMessage = {
      id: 'notification-123',
      title: 'Test Notification',
      content: 'This is a test notification message',
      priority: 'medium',
      channels: [NotificationChannelType.EMAIL, NotificationChannelType.SLACK],
      recipients: [
        { type: 'user', identifier: 'user@example.com' },
        { type: 'user', identifier: '#general' }
      ],
      status: NotificationStatus.PENDING
    };

    it('should send notification through multiple channels successfully', async () => {
      // Mock successful email sending
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      // Mock successful Slack sending
      mockedAxios.post.mockResolvedValue({
        data: { ok: true, ts: '1234567890.123' }
      });

      const result = await notificationService.send(mockNotification);

      expect(result.success).toBe(true);
      expect(result.results.email).toBe(true);
      expect(result.results.slack).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockNotification.status).toBe(NotificationStatus.SENT);
      expect(mockNotification.sentAt).toBeDefined();
    });

    it('should handle partial failures gracefully', async () => {
      // Mock successful email sending
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      // Mock failed Slack sending
      mockedAxios.post.mockRejectedValue(new Error('Slack API error'));

      const result = await notificationService.send(mockNotification);

      expect(result.success).toBe(true); // At least one channel succeeded
      expect(result.results.email).toBe(true);
      expect(result.results.slack).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('slack: Slack API error');
    });

    it('should handle complete failure', async () => {
      // Mock failed email sending
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      // Mock failed Slack sending
      mockedAxios.post.mockRejectedValue(new Error('Slack API error'));

      const result = await notificationService.send(mockNotification);

      expect(result.success).toBe(false);
      expect(result.results.email).toBe(false);
      expect(result.results.slack).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(mockNotification.status).toBe(NotificationStatus.FAILED);
    });

    it('should handle service-level errors', async () => {
      const invalidNotification = { ...mockNotification, channels: [] };

      const result = await notificationService.send(invalidNotification);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      const subject = 'Test Email';
      const content = 'This is a test email';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      const result = await notificationService.sendEmail(recipients, subject, content);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipients.join(', '),
          subject,
          text: content,
          html: expect.stringContaining(content.replace(/\n/g, '<br>'))
        })
      );
    });

    it('should handle email sending errors', async () => {
      const recipients = ['user@example.com'];
      const subject = 'Test Email';
      const content = 'Test content';

      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await notificationService.sendEmail(recipients, subject, content);

      expect(result).toBe(false);
    });

    it('should support HTML content and attachments', async () => {
      const recipients = ['user@example.com'];
      const subject = 'Test Email';
      const content = 'Test content';
      const options = {
        html: '<p>HTML content</p>',
        attachments: [{ filename: 'test.pdf', content: Buffer.from('test') }],
        priority: 'high' as const
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      const result = await notificationService.sendEmail(recipients, subject, content, options);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: options.html,
          attachments: options.attachments,
          priority: options.priority
        })
      );
    });
  });

  describe('sendSlack', () => {
    it('should send Slack message successfully', async () => {
      const channels = ['general', 'alerts'];
      const message = 'Test Slack message';

      mockedAxios.post.mockResolvedValue({
        data: { ok: true, ts: '1234567890.123' }
      });

      const result = await notificationService.sendSlack(channels, message);

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // One call per channel
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          channel: '#general',
          text: message,
          username: 'Business Automation Bot',
          icon_emoji: ':robot_face:'
        }),
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockConfig.slack.botToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle Slack API errors', async () => {
      const channels = ['general'];
      const message = 'Test message';

      mockedAxios.post.mockResolvedValue({
        data: { ok: false, error: 'channel_not_found' }
      });

      const result = await notificationService.sendSlack(channels, message);

      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      const channels = ['general'];
      const message = 'Test message';

      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const result = await notificationService.sendSlack(channels, message);

      expect(result).toBe(false);
    });

    it('should support custom options', async () => {
      const channels = ['general'];
      const message = 'Test message';
      const options = {
        username: 'Custom Bot',
        iconEmoji: ':warning:',
        attachments: [{ color: 'danger', text: 'Alert!' }],
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Block content' } }]
      };

      mockedAxios.post.mockResolvedValue({
        data: { ok: true, ts: '1234567890.123' }
      });

      const result = await notificationService.sendSlack(channels, message, options);

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          username: options.username,
          icon_emoji: options.iconEmoji,
          attachments: options.attachments,
          blocks: options.blocks
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendSMS', () => {
    it('should send SMS through Twilio provider', async () => {
      const phoneNumbers = ['+1234567890', '+0987654321'];
      const message = 'Test SMS message';

      // Mock Twilio SMS sending (simplified)
      const result = await notificationService.sendSMS(phoneNumbers, message);

      // Since we're using a placeholder implementation, it should return true
      expect(result).toBe(true);
    });

    it('should handle unsupported SMS providers', async () => {
      // Create service with unsupported provider
      const configWithUnsupportedProvider = {
        ...mockConfig,
        sms: {
          provider: 'unsupported',
          apiKey: 'test-key',
          from: '+1234567890'
        }
      };

      const serviceWithUnsupportedProvider = new NotificationService(configWithUnsupportedProvider);
      
      const phoneNumbers = ['+1234567890'];
      const message = 'Test message';

      const result = await serviceWithUnsupportedProvider.sendSMS(phoneNumbers, message);

      expect(result).toBe(false);
    });
  });

  describe('sendWebhook', () => {
    it('should send webhook notification successfully', async () => {
      const url = 'https://example.com/webhook';
      const payload = { message: 'Test webhook', timestamp: new Date().toISOString() };

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true }
      } as any);

      const result = await notificationService.sendWebhook(url, payload);

      expect(result).toBe(true);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'POST',
        url,
        data: payload,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    });

    it('should handle webhook errors', async () => {
      const url = 'https://example.com/webhook';
      const payload = { message: 'Test webhook' };

      mockedAxios.mockRejectedValue(new Error('Network error'));

      const result = await notificationService.sendWebhook(url, payload);

      expect(result).toBe(false);
    });

    it('should support custom options', async () => {
      const url = 'https://example.com/webhook';
      const payload = { message: 'Test webhook' };
      const options = {
        method: 'PUT' as const,
        headers: { 'Authorization': 'Bearer token' },
        timeout: 5000
      };

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true }
      } as any);

      const result = await notificationService.sendWebhook(url, payload, options);

      expect(result).toBe(true);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'PUT',
        url,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token'
        },
        timeout: 5000
      });
    });
  });

  describe('scheduleNotification', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule notification for future delivery', async () => {
      const notification: NotificationMessage = {
        id: 'scheduled-123',
        title: 'Scheduled Notification',
        content: 'This is scheduled',
        priority: 'medium',
        channels: [NotificationChannelType.EMAIL],
        recipients: [{ type: 'user', identifier: 'user@example.com' }],
        status: NotificationStatus.PENDING
      };

      const scheduledAt = new Date(Date.now() + 60000); // 1 minute from now

      const result = await notificationService.scheduleNotification(notification, scheduledAt);

      expect(result).toBe(notification.id);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('should send immediately if scheduled time is in the past', async () => {
      const notification: NotificationMessage = {
        id: 'immediate-123',
        title: 'Immediate Notification',
        content: 'This should send now',
        priority: 'medium',
        channels: [NotificationChannelType.EMAIL],
        recipients: [{ type: 'user', identifier: 'user@example.com' }],
        status: NotificationStatus.PENDING
      };

      const pastTime = new Date(Date.now() - 60000); // 1 minute ago

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      const result = await notificationService.scheduleNotification(notification, pastTime);

      expect(result).toBe(notification.id);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('should filter recipients based on channel preferences', async () => {
      const notification: NotificationMessage = {
        id: 'filtered-123',
        title: 'Filtered Notification',
        content: 'Test content',
        priority: 'medium',
        channels: [NotificationChannelType.EMAIL, NotificationChannelType.SLACK],
        recipients: [
          {
            type: 'user',
            identifier: 'user1@example.com',
            preferences: {
              channels: [NotificationChannelType.EMAIL],
              frequency: 'immediate'
            }
          },
          {
            type: 'user',
            identifier: 'user2@example.com',
            preferences: {
              channels: [NotificationChannelType.SLACK],
              frequency: 'immediate'
            }
          }
        ],
        status: NotificationStatus.PENDING
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      mockedAxios.post.mockResolvedValue({
        data: { ok: true, ts: '1234567890.123' }
      });

      const result = await notificationService.send(notification);

      expect(result.success).toBe(true);
      // Should send email to user1 and Slack to user2 based on preferences
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user1@example.com'
        })
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          channel: '#user2@example.com'
        }),
        expect.any(Object)
      );
    });

    it('should convert text to HTML properly', async () => {
      const recipients = ['user@example.com'];
      const subject = 'Test';
      const content = 'Line 1\nLine 2\n**Bold text**\n*Italic text*';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'email-123',
        response: 'OK'
      } as any);

      await notificationService.sendEmail(recipients, subject, content);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: 'Line 1<br>Line 2<br><strong>Bold text</strong><br><em>Italic text</em>'
        })
      );
    });

    it('should get appropriate priority emoji for Slack', async () => {
      const channels = ['general'];
      const message = 'Test message';

      mockedAxios.post.mockResolvedValue({
        data: { ok: true, ts: '1234567890.123' }
      });

      // Test different priority levels
      const priorities = ['urgent', 'high', 'medium', 'low'];
      const expectedEmojis = [':rotating_light:', ':warning:', ':information_source:', ':memo:'];

      for (let i = 0; i < priorities.length; i++) {
        const notification: NotificationMessage = {
          id: `test-${i}`,
          title: 'Test',
          content: message,
          priority: priorities[i] as any,
          channels: [NotificationChannelType.SLACK],
          recipients: [{ type: 'user', identifier: '#general' }],
          status: NotificationStatus.PENDING
        };

        await notificationService.send(notification);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://slack.com/api/chat.postMessage',
          expect.objectContaining({
            icon_emoji: expectedEmojis[i]
          }),
          expect.any(Object)
        );
      }
    });
  });
});