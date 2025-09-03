import { EventEmitter } from 'events';
import { Logger } from '../shared/utils/logger';
import { Task, TaskStatus, Priority } from '../shared/types';
import { TaskModel } from '../shared/models/Task';
import { WorkflowEngine } from './WorkflowEngine';

const logger = new Logger('TaskScheduler');

export interface QueuedTask {
  task: Task;
  priority: number;
  queuedAt: Date;
  attempts: number;
  maxAttempts: number;
  nextRetry?: Date;
}

export class TaskScheduler extends EventEmitter {
  private taskQueue: QueuedTask[] = [];
  private processingTasks = new Set<string>();
  private workflowEngine: WorkflowEngine;
  private isProcessing = false;
  private maxConcurrentTasks = 10;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(workflowEngine: WorkflowEngine) {
    super();
    this.workflowEngine = workflowEngine;
    this.startProcessing();
  }

  async scheduleTask(task: Task, priority?: number): Promise<void> {
    const taskPriority = priority || this.getPriorityScore(task.priority);
    
    const queuedTask: QueuedTask = {
      task,
      priority: taskPriority,
      queuedAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };

    // Insert task in priority order
    this.insertTaskByPriority(queuedTask);

    logger.info('Task scheduled', {
      taskId: task.id,
      taskType: task.type,
      priority: taskPriority,
      queueLength: this.taskQueue.length
    });

    this.emit('taskScheduled', queuedTask);
  }

  async scheduleTaskWithDelay(task: Task, delayMs: number): Promise<void> {
    setTimeout(() => {
      this.scheduleTask(task);
    }, delayMs);

    logger.info('Task scheduled with delay', {
      taskId: task.id,
      delayMs,
      executeAt: new Date(Date.now() + delayMs)
    });
  }

  async scheduleRecurringTask(task: Task, cronExpression: string): Promise<void> {
    const cron = await import('node-cron');
    
    cron.schedule(cronExpression, async () => {
      try {
        // Create a new task instance for each execution
        const newTask = { ...task, id: this.generateTaskId() };
        await this.scheduleTask(newTask);
      } catch (error) {
        logger.error('Failed to schedule recurring task', error, {
          taskId: task.id,
          cronExpression
        });
      }
    });

    logger.info('Recurring task scheduled', {
      taskId: task.id,
      cronExpression
    });
  }

  private insertTaskByPriority(queuedTask: QueuedTask): void {
    let inserted = false;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (queuedTask.priority > this.taskQueue[i].priority) {
        this.taskQueue.splice(i, 0, queuedTask);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.taskQueue.push(queuedTask);
    }
  }

  private getPriorityScore(priority: Priority): number {
    switch (priority) {
      case Priority.URGENT: return 1000;
      case Priority.HIGH: return 750;
      case Priority.MEDIUM: return 500;
      case Priority.LOW: return 250;
      default: return 500;
    }
  }

  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Check queue every second

    logger.info('Task scheduler started');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.taskQueue.length > 0 && this.processingTasks.size < this.maxConcurrentTasks) {
        const queuedTask = this.taskQueue.shift();
        if (!queuedTask) break;

        // Check if task should be retried
        if (queuedTask.nextRetry && queuedTask.nextRetry > new Date()) {
          // Re-queue for later
          this.insertTaskByPriority(queuedTask);
          continue;
        }

        this.processTask(queuedTask);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(queuedTask: QueuedTask): Promise<void> {
    const { task } = queuedTask;
    
    if (this.processingTasks.has(task.id)) {
      return; // Already processing
    }

    this.processingTasks.add(task.id);
    queuedTask.attempts++;

    logger.info('Processing task', {
      taskId: task.id,
      taskType: task.type,
      attempt: queuedTask.attempts,
      maxAttempts: queuedTask.maxAttempts
    });

    try {
      // Update task status to in progress
      await TaskModel.findByIdAndUpdate(task.id, {
        status: TaskStatus.IN_PROGRESS,
        updatedAt: new Date()
      });

      // Process the task based on its type
      const result = await this.executeTask(task);

      // Update task with result
      await TaskModel.findByIdAndUpdate(task.id, {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        'data.output': result
      });

      logger.info('Task completed successfully', {
        taskId: task.id,
        processingTime: Date.now() - queuedTask.queuedAt.getTime()
      });

      this.emit('taskCompleted', { task, result });

    } catch (error) {
      logger.error('Task processing failed', error, {
        taskId: task.id,
        attempt: queuedTask.attempts
      });

      await this.handleTaskError(queuedTask, error);
    } finally {
      this.processingTasks.delete(task.id);
    }
  }

  private async executeTask(task: Task): Promise<any> {
    // Route task to appropriate service based on type
    switch (task.type) {
      case 'email_processing':
        return this.executeEmailProcessingTask(task);
      case 'calendar_management':
        return this.executeCalendarTask(task);
      case 'document_generation':
        return this.executeDocumentTask(task);
      case 'data_analysis':
        return this.executeDataAnalysisTask(task);
      case 'communication':
        return this.executeCommunicationTask(task);
      default:
        // Check if task has a workflow
        if (task.workflow && task.workflow.length > 0) {
          // Execute as workflow
          const templateId = task.data.context?.workflowTemplateId;
          if (templateId) {
            return this.workflowEngine.executeWorkflow(templateId, task.id, task.data);
          }
        }
        
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async executeEmailProcessingTask(task: Task): Promise<any> {
    const { AdministrativeService } = await import('../services/administrative/AdministrativeService');
    const adminService = new AdministrativeService();
    return adminService.processEmail(task.data.input);
  }

  private async executeCalendarTask(task: Task): Promise<any> {
    const { AdministrativeService } = await import('../services/administrative/AdministrativeService');
    const adminService = new AdministrativeService();
    return adminService.manageCalendar(task.data.input);
  }

  private async executeDocumentTask(task: Task): Promise<any> {
    const { AdministrativeService } = await import('../services/administrative/AdministrativeService');
    const adminService = new AdministrativeService();
    return adminService.generateDocument(task.data.input);
  }

  private async executeDataAnalysisTask(task: Task): Promise<any> {
    const { DataAnalyticsService } = await import('../services/data-analytics/DataAnalyticsService');
    const dataService = new DataAnalyticsService();
    return dataService.analyzeData(task.data.input);
  }

  private async executeCommunicationTask(task: Task): Promise<any> {
    const { CommunicationService } = await import('../services/communication/CommunicationService');
    const commService = new CommunicationService();
    return commService.processMessage(task.data.input);
  }

  private async handleTaskError(queuedTask: QueuedTask, error: any): Promise<void> {
    const { task } = queuedTask;

    if (queuedTask.attempts < queuedTask.maxAttempts) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, queuedTask.attempts) * 1000; // 2^attempt seconds
      queuedTask.nextRetry = new Date(Date.now() + retryDelay);
      
      this.insertTaskByPriority(queuedTask);
      
      logger.info('Task scheduled for retry', {
        taskId: task.id,
        attempt: queuedTask.attempts,
        nextRetry: queuedTask.nextRetry,
        retryDelay
      });
    } else {
      // Max attempts reached, mark as failed
      await TaskModel.findByIdAndUpdate(task.id, {
        status: TaskStatus.FAILED,
        updatedAt: new Date(),
        'data.error': error.message
      });

      logger.error('Task failed permanently', error, {
        taskId: task.id,
        totalAttempts: queuedTask.attempts
      });

      this.emit('taskFailed', { task, error });
    }
  }

  // Public methods
  getQueueStatus(): {
    queueLength: number;
    processingCount: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.taskQueue.length,
      processingCount: this.processingTasks.size,
      maxConcurrent: this.maxConcurrentTasks
    };
  }

  async cancelTask(taskId: string): Promise<boolean> {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(qt => qt.task.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      
      await TaskModel.findByIdAndUpdate(taskId, {
        status: TaskStatus.CANCELLED,
        updatedAt: new Date()
      });
      
      logger.info('Task cancelled from queue', { taskId });
      return true;
    }

    // Check if currently processing
    if (this.processingTasks.has(taskId)) {
      // Mark for cancellation (the processing logic should check this)
      await TaskModel.findByIdAndUpdate(taskId, {
        status: TaskStatus.CANCELLED,
        updatedAt: new Date()
      });
      
      logger.info('Task marked for cancellation', { taskId });
      return true;
    }

    return false;
  }

  async pauseTask(taskId: string): Promise<boolean> {
    const queueIndex = this.taskQueue.findIndex(qt => qt.task.id === taskId);
    if (queueIndex !== -1) {
      const queuedTask = this.taskQueue.splice(queueIndex, 1)[0];
      
      await TaskModel.findByIdAndUpdate(taskId, {
        status: TaskStatus.PAUSED,
        updatedAt: new Date()
      });
      
      logger.info('Task paused', { taskId });
      return true;
    }
    
    return false;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = await TaskModel.findById(taskId);
    if (task && task.status === TaskStatus.PAUSED) {
      await this.scheduleTask(task);
      
      await TaskModel.findByIdAndUpdate(taskId, {
        status: TaskStatus.PENDING,
        updatedAt: new Date()
      });
      
      logger.info('Task resumed', { taskId });
      return true;
    }
    
    return false;
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info('Task scheduler stopped');
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}