import mongoose, { Schema, Document } from 'mongoose';
import { Task as ITask, TaskType, TaskStatus, Priority } from '../types';

export interface TaskDocument extends ITask, Document {}

const taskSchema = new Schema<TaskDocument>({
  type: {
    type: String,
    enum: Object.values(TaskType),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING
  },
  priority: {
    type: String,
    enum: Object.values(Priority),
    default: Priority.MEDIUM
  },
  assignedTo: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  data: {
    input: Schema.Types.Mixed,
    output: Schema.Types.Mixed,
    context: {
      userId: { type: String, required: true },
      workflowId: String,
      integrationId: String,
      metadata: Schema.Types.Mixed
    },
    attachments: [{
      id: String,
      filename: String,
      mimeType: String,
      size: Number,
      url: String,
      uploadedAt: Date
    }]
  },
  workflow: [{
    id: String,
    name: String,
    type: String,
    configuration: Schema.Types.Mixed,
    dependencies: [String],
    timeout: Number,
    retryCount: Number,
    order: Number
  }],
  estimatedDuration: Number,
  actualDuration: Number,
  dueDate: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Indexes
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ type: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ 'data.context.userId': 1 });

// Compound indexes
taskSchema.index({ status: 1, priority: -1, createdAt: -1 });
taskSchema.index({ assignedTo: 1, status: 1 });

// Pre-save middleware
taskSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === TaskStatus.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
    
    if (this.createdAt) {
      this.actualDuration = this.completedAt.getTime() - this.createdAt.getTime();
    }
  }
  next();
});

export const TaskModel = mongoose.model<TaskDocument>('Task', taskSchema);