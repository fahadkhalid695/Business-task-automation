import { 
  ReminderRequest,
  ReminderResult,
  ReminderType,
  NotificationChannel,
  ReminderSchedule,
  NotificationTemplate,
  ReminderRule
} from './types/ProjectManagementTypes';
import { Task, Priority, User } from '../shared/types';
import { logger } from '../shared/utils/logger';

/**
 * ReminderNotificationSystem - Handles automated reminder and notification systems for deadlines and milestones
 */
export class ReminderNotificationSystem {
  private reminderRules: Map<string, ReminderRule>;
  private notificationTemplates: Map<string, NotificationTemplate>;
  private scheduledReminders: Map<string, ReminderSchedule>;
  private notificationChannels: Map<string, NotificationChannel>;

  constructor() {
    this.reminderRules = new Map();
    this.notificationTemplates = new Map();
    this.scheduledReminders = new Map();
    this.notificationChannels = new Map();
    
    this.initializeDefaultRules();
    this.initializeDefaultTemplates();
    
    logger.info('ReminderNotificationSystem initialized');
  }

  /**
   * Process reminders based on request type and criteria
   */
  async processReminders(request: ReminderRequest): Promise<ReminderResult> {
    try {
      const notifications: any[] = [];
      const failedNotifications: any[] = [];
      let notificationsSent = 0;

      switch (request.type) {
        case ReminderType.DEADLINE:
          const deadlineNotifications = await this.processDeadlineReminders(request);
          notifications.push(...deadlineNotifications.successful);
          failedNotifications.push(...deadlineNotifications.failed);
          break;

        case ReminderType.MILESTONE:
          const milestoneNotifications = await this.processMilestoneReminders(request);
          notifications.push(...milestoneNotifications.successful);
          failedNotifications.push(...milestoneNotifications.failed);
          break;

        case ReminderType.OVERDUE:
          const overdueNotifications = await this.processOverdueReminders(request);
          notifications.push(...overdueNotifications.successful);
          failedNotifications.push(...overdueNotifications.failed);
          break;

        case ReminderType.FOLLOW_UP:
          const followUpNotifications = await this.processFollowUpReminders(request);
          notifications.push(...followUpNotifications.successful);
          failedNotifications.push(...followUpNotifications.failed);
          break;

        default:
          throw new Error(`Unsupported reminder type: ${request.type}`);
      }

      notificationsSent = notifications.length;

      logger.info(`Reminder processing completed: ${notificationsSent} sent, ${failedNotifications.length} failed`);

      return {
        notificationsSent,
        notifications,
        failedNotifications,
        reminderType: request.type,
        processedAt: new Date(),
        nextScheduledCheck: this.calculateNextCheck(request.type)
      };
    } catch (error) {
      logger.error('Reminder processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process deadline reminders for upcoming task due dates
   */
  private async processDeadlineReminders(request: ReminderRequest): Promise<{ successful: any[], failed: any[] }> {
    const successful: any[] = [];
    const failed: any[] = [];

    if (!request.tasks) {
      return { successful, failed };
    }

    for (const task of request.tasks) {
      try {
        const reminderNeeded = await this.shouldSendDeadlineReminder(task);
        
        if (reminderNeeded) {
          const notification = await this.createDeadlineNotification(task);
          const sent = await this.sendNotification(notification);
          
          if (sent) {
            successful.push(notification);
            await this.updateReminderSchedule(task.id, ReminderType.DEADLINE);
          } else {
            failed.push({ task: task.id, reason: 'Failed to send notification' });
          }
        }
      } catch (error) {
        failed.push({ task: task.id, reason: error.message });
      }
    }

    return { successful, failed };
  }

  /**
   * Process milestone reminders for project milestones
   */
  private async processMilestoneReminders(request: ReminderRequest): Promise<{ successful: any[], failed: any[] }> {
    const successful: any[] = [];
    const failed: any[] = [];

    if (!request.milestones) {
      return { successful, failed };
    }

    for (const milestone of request.milestones) {
      try {
        const reminderNeeded = await this.shouldSendMilestoneReminder(milestone);
        
        if (reminderNeeded) {
          const notification = await this.createMilestoneNotification(milestone);
          const sent = await this.sendNotification(notification);
          
          if (sent) {
            successful.push(notification);
            await this.updateReminderSchedule(milestone.id, ReminderType.MILESTONE);
          } else {
            failed.push({ milestone: milestone.id, reason: 'Failed to send notification' });
          }
        }
      } catch (error) {
        failed.push({ milestone: milestone.id, reason: error.message });
      }
    }

    return { successful, failed };
  }

  /**
   * Process overdue task reminders
   */
  private async processOverdueReminders(request: ReminderRequest): Promise<{ successful: any[], failed: any[] }> {
    const successful: any[] = [];
    const failed: any[] = [];

    if (!request.tasks) {
      return { successful, failed };
    }

    const overdueTasks = request.tasks.filter(task => 
      task.dueDate && new Date() > task.dueDate && task.status !== 'completed'
    );

    for (const task of overdueTasks) {
      try {
        const notification = await this.createOverdueNotification(task);
        const sent = await this.sendNotification(notification);
        
        if (sent) {
          successful.push(notification);
        } else {
          failed.push({ task: task.id, reason: 'Failed to send overdue notification' });
        }
      } catch (error) {
        failed.push({ task: task.id, reason: error.message });
      }
    }

    return { successful, failed };
  }

  /**
   * Process follow-up reminders for completed tasks
   */
  private async processFollowUpReminders(request: ReminderRequest): Promise<{ successful: any[], failed: any[] }> {
    const successful: any[] = [];
    const failed: any[] = [];

    if (!request.tasks) {
      return { successful, failed };
    }

    const completedTasks = request.tasks.filter(task => 
      task.status === 'completed' && task.completedAt
    );

    for (const task of completedTasks) {
      try {
        const followUpNeeded = await this.shouldSendFollowUpReminder(task);
        
        if (followUpNeeded) {
          const notification = await this.createFollowUpNotification(task);
          const sent = await this.sendNotification(notification);
          
          if (sent) {
            successful.push(notification);
          } else {
            failed.push({ task: task.id, reason: 'Failed to send follow-up notification' });
          }
        }
      } catch (error) {
        failed.push({ task: task.id, reason: error.message });
      }
    }

    return { successful, failed };
  }

  /**
   * Check if deadline reminder should be sent
   */
  private async shouldSendDeadlineReminder(task: Task): Promise<boolean> {
    if (!task.dueDate || task.status === 'completed') {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Get reminder rule based on task priority
    const rule = this.getReminderRule(task.priority);
    
    // Check if we're within the reminder window
    for (const reminderHour of rule.reminderHours) {
      if (hoursUntilDue <= reminderHour && hoursUntilDue > (reminderHour - 1)) {
        // Check if we haven't already sent this reminder
        const lastReminder = this.scheduledReminders.get(`${task.id}-${reminderHour}`);
        if (!lastReminder || this.shouldResendReminder(lastReminder)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if milestone reminder should be sent
   */
  private async shouldSendMilestoneReminder(milestone: any): Promise<boolean> {
    if (!milestone.dueDate || milestone.status === 'completed') {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(milestone.dueDate);
    const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Send reminders at 7 days, 3 days, and 1 day before milestone
    const reminderDays = [7, 3, 1];
    
    for (const reminderDay of reminderDays) {
      if (daysUntilDue <= reminderDay && daysUntilDue > (reminderDay - 1)) {
        const lastReminder = this.scheduledReminders.get(`${milestone.id}-${reminderDay}d`);
        if (!lastReminder || this.shouldResendReminder(lastReminder)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if follow-up reminder should be sent
   */
  private async shouldSendFollowUpReminder(task: Task): Promise<boolean> {
    if (!task.completedAt) {
      return false;
    }

    const now = new Date();
    const completedDate = new Date(task.completedAt);
    const daysSinceCompletion = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);

    // Send follow-up reminders at 1 day and 7 days after completion
    const followUpDays = [1, 7];
    
    for (const followUpDay of followUpDays) {
      if (daysSinceCompletion >= followUpDay && daysSinceCompletion < (followUpDay + 1)) {
        const lastReminder = this.scheduledReminders.get(`${task.id}-followup-${followUpDay}d`);
        if (!lastReminder || this.shouldResendReminder(lastReminder)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Create deadline notification
   */
  private async createDeadlineNotification(task: Task): Promise<any> {
    const template = this.notificationTemplates.get('deadline') || this.getDefaultDeadlineTemplate();
    
    return {
      id: `deadline-${task.id}-${Date.now()}`,
      type: 'deadline',
      taskId: task.id,
      title: template.subject.replace('{taskTitle}', task.title),
      message: template.body
        .replace('{taskTitle}', task.title)
        .replace('{dueDate}', task.dueDate?.toLocaleDateString() || 'N/A')
        .replace('{priority}', task.priority),
      recipients: [task.assignedTo],
      channels: this.getNotificationChannels(task.priority),
      createdAt: new Date(),
      priority: task.priority
    };
  }

  /**
   * Create milestone notification
   */
  private async createMilestoneNotification(milestone: any): Promise<any> {
    const template = this.notificationTemplates.get('milestone') || this.getDefaultMilestoneTemplate();
    
    return {
      id: `milestone-${milestone.id}-${Date.now()}`,
      type: 'milestone',
      milestoneId: milestone.id,
      title: template.subject.replace('{milestoneName}', milestone.name),
      message: template.body
        .replace('{milestoneName}', milestone.name)
        .replace('{dueDate}', milestone.dueDate?.toLocaleDateString() || 'N/A')
        .replace('{projectName}', milestone.projectName || 'Unknown Project'),
      recipients: milestone.stakeholders || [],
      channels: ['email', 'slack'],
      createdAt: new Date(),
      priority: Priority.HIGH
    };
  }

  /**
   * Create overdue notification
   */
  private async createOverdueNotification(task: Task): Promise<any> {
    const template = this.notificationTemplates.get('overdue') || this.getDefaultOverdueTemplate();
    
    const daysPastDue = task.dueDate ? 
      Math.floor((new Date().getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    return {
      id: `overdue-${task.id}-${Date.now()}`,
      type: 'overdue',
      taskId: task.id,
      title: template.subject.replace('{taskTitle}', task.title),
      message: template.body
        .replace('{taskTitle}', task.title)
        .replace('{daysPastDue}', daysPastDue.toString())
        .replace('{originalDueDate}', task.dueDate?.toLocaleDateString() || 'N/A'),
      recipients: [task.assignedTo, task.createdBy],
      channels: ['email', 'slack', 'push'],
      createdAt: new Date(),
      priority: Priority.URGENT
    };
  }

  /**
   * Create follow-up notification
   */
  private async createFollowUpNotification(task: Task): Promise<any> {
    const template = this.notificationTemplates.get('followup') || this.getDefaultFollowUpTemplate();
    
    return {
      id: `followup-${task.id}-${Date.now()}`,
      type: 'followup',
      taskId: task.id,
      title: template.subject.replace('{taskTitle}', task.title),
      message: template.body
        .replace('{taskTitle}', task.title)
        .replace('{completedDate}', task.completedAt?.toLocaleDateString() || 'N/A'),
      recipients: [task.createdBy],
      channels: ['email'],
      createdAt: new Date(),
      priority: Priority.LOW
    };
  }

  /**
   * Send notification through appropriate channels
   */
  private async sendNotification(notification: any): Promise<boolean> {
    try {
      for (const channelName of notification.channels) {
        const channel = this.notificationChannels.get(channelName);
        if (channel && channel.isActive) {
          await this.sendThroughChannel(notification, channel);
        }
      }
      
      logger.info(`Notification sent: ${notification.id}`, { 
        type: notification.type,
        recipients: notification.recipients.length
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to send notification: ${notification.id}`, { error: error.message });
      return false;
    }
  }

  /**
   * Send notification through specific channel
   */
  private async sendThroughChannel(notification: any, channel: NotificationChannel): Promise<void> {
    // Implementation would depend on the specific channel
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(notification, channel);
        break;
      case 'slack':
        await this.sendSlackNotification(notification, channel);
        break;
      case 'push':
        await this.sendPushNotification(notification, channel);
        break;
      case 'sms':
        await this.sendSMSNotification(notification, channel);
        break;
      default:
        logger.warn(`Unsupported notification channel: ${channel.type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any, channel: NotificationChannel): Promise<void> {
    // Mock implementation - would integrate with actual email service
    logger.info(`Sending email notification: ${notification.title}`, {
      recipients: notification.recipients,
      channel: channel.name
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: any, channel: NotificationChannel): Promise<void> {
    // Mock implementation - would integrate with Slack API
    logger.info(`Sending Slack notification: ${notification.title}`, {
      recipients: notification.recipients,
      channel: channel.name
    });
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: any, channel: NotificationChannel): Promise<void> {
    // Mock implementation - would integrate with push notification service
    logger.info(`Sending push notification: ${notification.title}`, {
      recipients: notification.recipients,
      channel: channel.name
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(notification: any, channel: NotificationChannel): Promise<void> {
    // Mock implementation - would integrate with SMS service
    logger.info(`Sending SMS notification: ${notification.title}`, {
      recipients: notification.recipients,
      channel: channel.name
    });
  }

  /**
   * Get reminder rule based on priority
   */
  private getReminderRule(priority: Priority): ReminderRule {
    const rule = this.reminderRules.get(priority);
    return rule || this.reminderRules.get(Priority.MEDIUM) || {
      priority: Priority.MEDIUM,
      reminderHours: [24, 4, 1],
      channels: ['email']
    };
  }

  /**
   * Get notification channels based on priority
   */
  private getNotificationChannels(priority: Priority): string[] {
    switch (priority) {
      case Priority.URGENT:
        return ['email', 'slack', 'push', 'sms'];
      case Priority.HIGH:
        return ['email', 'slack', 'push'];
      case Priority.MEDIUM:
        return ['email', 'slack'];
      case Priority.LOW:
        return ['email'];
      default:
        return ['email'];
    }
  }

  /**
   * Check if reminder should be resent
   */
  private shouldResendReminder(schedule: ReminderSchedule): boolean {
    const now = new Date();
    const lastSent = new Date(schedule.lastSent);
    const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastSent >= 24; // Resend after 24 hours
  }

  /**
   * Update reminder schedule
   */
  private async updateReminderSchedule(itemId: string, type: ReminderType): Promise<void> {
    const scheduleId = `${itemId}-${type}`;
    this.scheduledReminders.set(scheduleId, {
      itemId,
      type,
      lastSent: new Date(),
      nextScheduled: this.calculateNextCheck(type)
    });
  }

  /**
   * Calculate next check time
   */
  private calculateNextCheck(type: ReminderType): Date {
    const nextCheck = new Date();
    
    switch (type) {
      case ReminderType.DEADLINE:
        nextCheck.setHours(nextCheck.getHours() + 1); // Check every hour
        break;
      case ReminderType.MILESTONE:
        nextCheck.setHours(nextCheck.getHours() + 6); // Check every 6 hours
        break;
      case ReminderType.OVERDUE:
        nextCheck.setHours(nextCheck.getHours() + 2); // Check every 2 hours
        break;
      case ReminderType.FOLLOW_UP:
        nextCheck.setDate(nextCheck.getDate() + 1); // Check daily
        break;
      default:
        nextCheck.setHours(nextCheck.getHours() + 4); // Default 4 hours
    }
    
    return nextCheck;
  }

  /**
   * Initialize default reminder rules
   */
  private initializeDefaultRules(): void {
    this.reminderRules.set(Priority.URGENT, {
      priority: Priority.URGENT,
      reminderHours: [72, 24, 4, 1],
      channels: ['email', 'slack', 'push', 'sms']
    });

    this.reminderRules.set(Priority.HIGH, {
      priority: Priority.HIGH,
      reminderHours: [48, 24, 4],
      channels: ['email', 'slack', 'push']
    });

    this.reminderRules.set(Priority.MEDIUM, {
      priority: Priority.MEDIUM,
      reminderHours: [24, 4],
      channels: ['email', 'slack']
    });

    this.reminderRules.set(Priority.LOW, {
      priority: Priority.LOW,
      reminderHours: [24],
      channels: ['email']
    });
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    this.notificationTemplates.set('deadline', this.getDefaultDeadlineTemplate());
    this.notificationTemplates.set('milestone', this.getDefaultMilestoneTemplate());
    this.notificationTemplates.set('overdue', this.getDefaultOverdueTemplate());
    this.notificationTemplates.set('followup', this.getDefaultFollowUpTemplate());
  }

  /**
   * Get default deadline template
   */
  private getDefaultDeadlineTemplate(): NotificationTemplate {
    return {
      id: 'deadline-default',
      name: 'Deadline Reminder',
      subject: 'Reminder: {taskTitle} is due soon',
      body: 'Hi,\n\nThis is a reminder that the task "{taskTitle}" is due on {dueDate}.\n\nPriority: {priority}\n\nPlease ensure it is completed on time.\n\nBest regards,\nProject Management System'
    };
  }

  /**
   * Get default milestone template
   */
  private getDefaultMilestoneTemplate(): NotificationTemplate {
    return {
      id: 'milestone-default',
      name: 'Milestone Reminder',
      subject: 'Milestone Approaching: {milestoneName}',
      body: 'Hi,\n\nThe milestone "{milestoneName}" for project {projectName} is approaching.\n\nDue Date: {dueDate}\n\nPlease ensure all related tasks are on track.\n\nBest regards,\nProject Management System'
    };
  }

  /**
   * Get default overdue template
   */
  private getDefaultOverdueTemplate(): NotificationTemplate {
    return {
      id: 'overdue-default',
      name: 'Overdue Task',
      subject: 'OVERDUE: {taskTitle}',
      body: 'Hi,\n\nThe task "{taskTitle}" is now {daysPastDue} day(s) overdue.\n\nOriginal Due Date: {originalDueDate}\n\nPlease complete this task as soon as possible.\n\nBest regards,\nProject Management System'
    };
  }

  /**
   * Get default follow-up template
   */
  private getDefaultFollowUpTemplate(): NotificationTemplate {
    return {
      id: 'followup-default',
      name: 'Task Follow-up',
      subject: 'Follow-up: {taskTitle} completed',
      body: 'Hi,\n\nThe task "{taskTitle}" was completed on {completedDate}.\n\nPlease review the results and provide feedback if necessary.\n\nBest regards,\nProject Management System'
    };
  }

  /**
   * Get health status of the reminder notification system
   */
  async getHealthStatus(): Promise<any> {
    return {
      component: 'ReminderNotificationSystem',
      status: 'healthy',
      reminderRulesCount: this.reminderRules.size,
      notificationTemplatesCount: this.notificationTemplates.size,
      scheduledRemindersCount: this.scheduledReminders.size,
      notificationChannelsCount: this.notificationChannels.size,
      lastProcessed: new Date().toISOString()
    };
  }
}