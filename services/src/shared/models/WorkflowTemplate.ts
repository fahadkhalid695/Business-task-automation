import mongoose, { Schema, Document } from 'mongoose';
import { WorkflowTemplate as IWorkflowTemplate, StepType, TriggerType } from '../types';

export interface WorkflowTemplateDocument extends IWorkflowTemplate, Document {}

const workflowTemplateSchema = new Schema<WorkflowTemplateDocument>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  steps: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: Object.values(StepType),
      required: true
    },
    configuration: {
      type: Schema.Types.Mixed,
      required: true
    },
    dependencies: [{
      type: String
    }],
    timeout: Number,
    retryCount: Number,
    order: {
      type: Number,
      required: true
    }
  }],
  triggers: [{
    type: {
      type: String,
      enum: Object.values(TriggerType),
      required: true
    },
    configuration: {
      type: Schema.Types.Mixed,
      required: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes
workflowTemplateSchema.index({ name: 1 });
workflowTemplateSchema.index({ category: 1 });
workflowTemplateSchema.index({ isActive: 1 });
workflowTemplateSchema.index({ createdBy: 1 });
workflowTemplateSchema.index({ createdAt: -1 });

// Compound indexes
workflowTemplateSchema.index({ category: 1, isActive: 1 });
workflowTemplateSchema.index({ createdBy: 1, isActive: 1 });

// Pre-save middleware to generate step IDs
workflowTemplateSchema.pre('save', function(next) {
  if (this.isModified('steps')) {
    this.steps.forEach((step, index) => {
      if (!step.id) {
        step.id = `step_${index + 1}_${Math.random().toString(36).substring(2, 8)}`;
      }
    });
  }
  next();
});

export const WorkflowTemplateModel = mongoose.model<WorkflowTemplateDocument>('WorkflowTemplate', workflowTemplateSchema);