import { FilterQuery } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { TaskModel, TaskDocument } from '../models/Task';
import { TaskStatus, Priority, TaskType } from '../types';

export class TaskRepository extends BaseRepository<TaskDocument> {
  constructor() {
    super(TaskModel, 'Task');
  }

  async findByStatus(status: TaskStatus): Promise<TaskDocument[]> {
    return this.findMany({ status }, { sort: { priority: -1, createdAt: -1 } });
  }

  async findByAssignee(assignedTo: string): Promise<TaskDocument[]> {
    return this.findMany({ assignedTo }, { sort: { priority: -1, dueDate: 1 } });
  }

  async findByCreator(createdBy: string): Promise<TaskDocument[]> {
    return this.findMany({ createdBy }, { sort: { createdAt: -1 } });
  }

  async findByType(type: TaskType): Promise<TaskDocument[]> {
    return this.findMany({ type }, { sort: { createdAt: -1 } });
  }

  async findOverdueTasks(): Promise<TaskDocument[]> {
    const now = new Date();
    return this.findMany({
      dueDate: { $lt: now },
      status: { $in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] }
    }, { sort: { dueDate: 1 } });
  }

  async findHighPriorityTasks(): Promise<TaskDocument[]> {
    return this.findMany({
      priority: { $in: [Priority.HIGH, Priority.URGENT] },
      status: { $in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] }
    }, { sort: { priority: -1, createdAt: 1 } });
  }

  async findTasksDueWithin(hours: number): Promise<TaskDocument[]> {
    const futureTime = new Date(Date.now() + hours * 60 * 60 * 1000);
    return this.findMany({
      dueDate: { $lte: futureTime, $gte: new Date() },
      status: { $in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] }
    }, { sort: { dueDate: 1 } });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, updatedBy?: string): Promise<TaskDocument | null> {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };

    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (updatedBy) {
      updateData.lastUpdatedBy = updatedBy;
    }

    return this.updateById(taskId, updateData);
  }

  async assignTask(taskId: string, assignedTo: string, assignedBy?: string): Promise<TaskDocument | null> {
    const updateData: any = {
      assignedTo,
      updatedAt: new Date()
    };

    if (assignedBy) {
      updateData.assignedBy = assignedBy;
      updateData.assignedAt = new Date();
    }

    return this.updateById(taskId, updateData);
  }

  async getTaskStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    overdue: number;
    completedToday: number;
    avgCompletionTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      total,
      statusStats,
      priorityStats,
      typeStats,
      overdue,
      completedToday,
      avgCompletionTime
    ] = await Promise.all([
      this.count(),
      this.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      this.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      this.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      this.count({
        dueDate: { $lt: new Date() },
        status: { $in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] }
      }),
      this.count({
        status: TaskStatus.COMPLETED,
        completedAt: { $gte: today, $lt: tomorrow }
      }),
      this.aggregate([
        {
          $match: {
            status: TaskStatus.COMPLETED,
            actualDuration: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$actualDuration' }
          }
        }
      ])
    ]);

    const byStatus = statusStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    const byPriority = priorityStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    const byType = typeStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    return {
      total,
      byStatus,
      byPriority,
      byType,
      overdue,
      completedToday,
      avgCompletionTime: avgCompletionTime[0]?.avgDuration || 0
    };
  }

  async searchTasks(query: string, filters?: {
    status?: TaskStatus[];
    priority?: Priority[];
    type?: TaskType[];
    assignedTo?: string;
    createdBy?: string;
  }): Promise<TaskDocument[]> {
    const searchFilter: FilterQuery<TaskDocument> = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };

    if (filters) {
      if (filters.status?.length) {
        searchFilter.status = { $in: filters.status };
      }
      if (filters.priority?.length) {
        searchFilter.priority = { $in: filters.priority };
      }
      if (filters.type?.length) {
        searchFilter.type = { $in: filters.type };
      }
      if (filters.assignedTo) {
        searchFilter.assignedTo = filters.assignedTo;
      }
      if (filters.createdBy) {
        searchFilter.createdBy = filters.createdBy;
      }
    }

    return this.findMany(searchFilter, { 
      sort: { priority: -1, createdAt: -1 },
      limit: 50 
    });
  }

  async getTasksForWorkflow(workflowId: string): Promise<TaskDocument[]> {
    return this.findMany({
      'data.context.workflowId': workflowId
    }, { sort: { createdAt: 1 } });
  }

  async bulkUpdateStatus(taskIds: string[], status: TaskStatus): Promise<{ matchedCount: number; modifiedCount: number }> {
    return this.updateMany(
      { _id: { $in: taskIds } },
      { 
        status,
        updatedAt: new Date(),
        ...(status === TaskStatus.COMPLETED && { completedAt: new Date() })
      }
    );
  }
}