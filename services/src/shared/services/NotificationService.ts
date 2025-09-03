import { Logger } from '../utils/Logger';
import nodemailer from 'nodemailer';
import axios from 'axios';

export interface AlertNotification {
  title: string;
  message: string;
  severity: string;
  service: string;
  timestamp: Date;
}

export interface ResolutionNotification {
  title: string;
  message: string;
  alertId: string;
  resolvedBy: string;
  timestamp: Date;
}

export interface EscalationNotification {
  title: string;
  message: string;
  alert: any;
  escalationLevel: number;
  recipient: string;
  channel: string;
  timestamp: Date;
}

export class NotificationService {
  private logger = Logger.getInstance();
  private emailTransporter: nodemailer.Transporter;
  private slackWebhookUrl: string;
  private smsApiKey: string;

  constructor() {
    this.initializeEmailTransporter();
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    this.smsApiKey = process.env.SMS_API_KEY || '';
  }

  private initializeEmailTransporter(): void {
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendAlert(notification: AlertNotification): Promise<void> {
    try {
      const subject = `🚨 ${notification.severity.toUpperCase()} Alert: ${notification.title}`;
      const message = this.formatAlertMessage(notification);

      // Send email notification
      await this.sendEmail({
        to: process.env.ALERT_EMAIL_RECIPIENTS || 'admin@company.com',
        subject,
        html: message
      });

      // Send Slack notification for high severity alerts
      if (['high', 'critical'].includes(notification.severity.toLowerCase())) {
        await this.sendSlackMessage({
          text: `${subject}\n${notification.message}`,
          color: this.getSeverityColor(notification.severity),
          fields: [
            { title: 'Service', value: notification.service, short: true },
            { title: 'Severity', value: notification.severity, short: true },
            { title: 'Time', value: notification.timestamp.toISOString(), short: true }
          ]
        });
      }

      // Send SMS for critical alerts
      if (notification.severity.toLowerCase() === 'critical') {
        await this.sendSMS({
          to: process.env.CRITICAL_ALERT_PHONE || '',
          message: `CRITICAL ALERT: ${notification.title} - ${notification.service}`
        });
      }

      this.logger.info(`Alert notification sent: ${notification.title}`);
    } catch (error) {
      this.logger.error('Error sending alert notification:', error);
    }
  }

  async sendResolution(notification: ResolutionNotification): Promise<void> {
    try {
      const subject = `✅ Alert Resolved: ${notification.title}`;
      const message = this.formatResolutionMessage(notification);

      await this.sendEmail({
        to: process.env.ALERT_EMAIL_RECIPIENTS || 'admin@company.com',
        subject,
        html: message
      });

      await this.sendSlackMessage({
        text: `${subject}\n${notification.message}`,
        color: 'good',
        fields: [
          { title: 'Alert ID', value: notification.alertId, short: true },
          { title: 'Resolved By', value: notification.resolvedBy, short: true },
          { title: 'Time', value: notification.timestamp.toISOString(), short: true }
        ]
      });

      this.logger.info(`Resolution notification sent: ${notification.alertId}`);
    } catch (error) {
      this.logger.error('Error sending resolution notification:', error);
    }
  }

  async sendEscalation(notification: EscalationNotification): Promise<void> {
    try {
      const subject = `⚠️ Alert Escalated (Level ${notification.escalationLevel}): ${notification.title}`;
      const message = this.formatEscalationMessage(notification);

      switch (notification.channel) {
        case 'email':
          await this.sendEmail({
            to: notification.recipient,
            subject,
            html: message
          });
          break;
        case 'slack':
          await this.sendSlackMessage({
            text: `${subject}\n${notification.message}`,
            color: 'warning',
            channel: notification.recipient
          });
          break;
        case 'sms':
          await this.sendSMS({
            to: notification.recipient,
            message: `ESCALATED ALERT (L${notification.escalationLevel}): ${notification.title}`
          });
          break;
        case 'phone':
          await this.makePhoneCall({
            to: notification.recipient,
            message: `This is an escalated alert notification. ${notification.title}. Please check the system immediately.`
          });
          break;
      }

      this.logger.info(`Escalation notification sent to ${notification.recipient} via ${notification.channel}`);
    } catch (error) {
      this.logger.error('Error sending escalation notification:', error);
    }
  }

  async sendSystemReport(report: any, recipients: string[]): Promise<void> {
    try {
      const subject = `📊 System Monitoring Report - ${new Date().toLocaleDateString()}`;
      const message = this.formatSystemReportMessage(report);

      for (const recipient of recipients) {
        await this.sendEmail({
          to: recipient,
          subject,
          html: message
        });
      }

      this.logger.info('System report sent to recipients');
    } catch (error) {
      this.logger.error('Error sending system report:', error);
    }
  }

  private async sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'monitoring@company.com',
        to: options.to,
        subject: options.subject,
        html: options.html
      });
    } catch (error) {
      this.logger.error('Error sending email:', error);
      throw error;
    }
  }

  private async sendSlackMessage(options: { text: string; color?: string; fields?: any[]; channel?: string }): Promise<void> {
    if (!this.slackWebhookUrl) {
      this.logger.warn('Slack webhook URL not configured');
      return;
    }

    try {
      const payload = {
        text: options.text,
        channel: options.channel,
        attachments: options.color || options.fields ? [{
          color: options.color || 'good',
          fields: options.fields || []
        }] : undefined
      };

      await axios.post(this.slackWebhookUrl, payload);
    } catch (error) {
      this.logger.error('Error sending Slack message:', error);
      throw error;
    }
  }

  private async sendSMS(options: { to: string; message: string }): Promise<void> {
    if (!this.smsApiKey || !options.to) {
      this.logger.warn('SMS API key or recipient not configured');
      return;
    }

    try {
      // This would integrate with your SMS provider (Twilio, AWS SNS, etc.)
      // For now, just log the SMS
      this.logger.info(`SMS would be sent to ${options.to}: ${options.message}`);
    } catch (error) {
      this.logger.error('Error sending SMS:', error);
      throw error;
    }
  }

  private async makePhoneCall(options: { to: string; message: string }): Promise<void> {
    if (!options.to) {
      this.logger.warn('Phone number not configured');
      return;
    }

    try {
      // This would integrate with your voice calling service (Twilio Voice, etc.)
      // For now, just log the call
      this.logger.info(`Phone call would be made to ${options.to}: ${options.message}`);
    } catch (error) {
      this.logger.error('Error making phone call:', error);
      throw error;
    }
  }

  private formatAlertMessage(notification: AlertNotification): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: ${this.getSeverityColor(notification.severity)}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🚨 ${notification.severity.toUpperCase()} Alert</h2>
            </div>
            
            <h3>${notification.title}</h3>
            <p>${notification.message}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Service:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.service}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Severity:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.severity}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Time:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.timestamp.toLocaleString()}</td>
              </tr>
            </table>
            
            <p style="margin-top: 30px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
              <strong>Action Required:</strong> Please investigate this alert and take appropriate action.
              You can view more details in the monitoring dashboard.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private formatResolutionMessage(notification: ResolutionNotification): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #28a745; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0;">✅ Alert Resolved</h2>
            </div>
            
            <h3>${notification.title}</h3>
            <p>${notification.message}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Alert ID:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.alertId}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Resolved By:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.resolvedBy}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Resolution Time:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.timestamp.toLocaleString()}</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  }

  private formatEscalationMessage(notification: EscalationNotification): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ffc107; color: #212529; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0;">⚠️ Alert Escalated - Level ${notification.escalationLevel}</h2>
            </div>
            
            <h3>${notification.title}</h3>
            <p>${notification.message}</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Escalation Notice:</strong> This alert has been escalated to level ${notification.escalationLevel} 
              due to lack of response or resolution. Immediate attention is required.
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Service:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.alert.service}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Severity:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.alert.severity}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Escalation Level:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.escalationLevel}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Time:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${notification.timestamp.toLocaleString()}</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  }

  private formatSystemReportMessage(report: any): string {
    const healthStatus = report.systemHealth?.overall || 'unknown';
    const healthColor = this.getHealthStatusColor(healthStatus);
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="background: #007bff; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0;">📊 System Monitoring Report</h2>
              <p style="margin: 5px 0 0 0;">Generated: ${report.generatedAt}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
              <div style="background: ${healthColor}; color: white; padding: 15px; border-radius: 5px; text-align: center;">
                <h3 style="margin: 0;">System Health</h3>
                <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">${healthStatus.toUpperCase()}</p>
                <p style="margin: 0;">Score: ${report.systemHealth?.score || 0}/100</p>
              </div>
              
              <div style="background: #28a745; color: white; padding: 15px; border-radius: 5px; text-align: center;">
                <h3 style="margin: 0;">Active Alerts</h3>
                <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">${report.summary?.activeAlerts || 0}</p>
              </div>
              
              <div style="background: #17a2b8; color: white; padding: 15px; border-radius: 5px; text-align: center;">
                <h3 style="margin: 0;">Insights</h3>
                <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">${report.summary?.totalInsights || 0}</p>
              </div>
              
              <div style="background: #dc3545; color: white; padding: 15px; border-radius: 5px; text-align: center;">
                <h3 style="margin: 0;">Critical Issues</h3>
                <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">${report.summary?.criticalAnomalies || 0}</p>
              </div>
            </div>
            
            <div style="margin: 30px 0;">
              <h3>Service Status</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f8f9fa;">
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Service</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Response Time</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${(report.systemHealth?.services || []).map((service: any) => `
                    <tr>
                      <td style="padding: 10px; border: 1px solid #ddd;">${service.name}</td>
                      <td style="padding: 10px; border: 1px solid #ddd;">
                        <span style="color: ${this.getHealthStatusColor(service.status)}; font-weight: bold;">
                          ${service.status.toUpperCase()}
                        </span>
                      </td>
                      <td style="padding: 10px; border: 1px solid #ddd;">${service.responseTime}ms</td>
                      <td style="padding: 10px; border: 1px solid #ddd;">${service.errorRate}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            ${report.insights && report.insights.length > 0 ? `
              <div style="margin: 30px 0;">
                <h3>Key Insights</h3>
                ${report.insights.slice(0, 5).map((insight: any) => `
                  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #007bff;">
                    <h4 style="margin: 0 0 10px 0;">${insight.title}</h4>
                    <p style="margin: 0;">${insight.description}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <div style="margin-top: 30px; padding: 15px; background: #f0f0f0; border-radius: 5px; text-align: center;">
              <p style="margin: 0;">
                For detailed analysis and real-time monitoring, visit the 
                <a href="${process.env.DASHBOARD_URL || '#'}" style="color: #007bff;">monitoring dashboard</a>.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  private getHealthStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'healthy': return '#28a745';
      case 'warning': return '#ffc107';
      case 'critical': return '#fd7e14';
      case 'down': return '#dc3545';
      default: return '#6c757d';
    }
  }
}