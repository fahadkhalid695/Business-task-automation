import mongoose, { Schema, Document } from 'mongoose';
import { Report as IReport, ReportType, ReportFormat } from '../types';

export interface ReportDocument extends IReport, Document {}

const reportSchema = new Schema<ReportDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  type: {
    type: String,
    enum: Object.values(ReportType),
    required: true
  },
  parameters: {
    dateRange: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    filters: [{
      field: String,
      operator: String,
      value: Schema.Types.Mixed
    }],
    groupBy: [String],
    metrics: [String]
  },
  data: {
    headers: [String],
    rows: [[Schema.Types.Mixed]],
    summary: {
      totalRecords: Number,
      keyMetrics: { type: Map, of: Number },
      insights: [String]
    },
    charts: [{
      type: {
        type: String,
        enum: ['bar', 'line', 'pie', 'scatter']
      },
      title: String,
      data: [Schema.Types.Mixed],
      options: Schema.Types.Mixed
    }]
  },
  generatedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  schedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    time: String,
    isActive: { type: Boolean, default: false }
  },
  recipients: [{
    type: String,
    trim: true
  }],
  format: {
    type: String,
    enum: Object.values(ReportFormat),
    default: ReportFormat.PDF
  },
  createdBy: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  executionTime: {
    type: Number // in milliseconds
  },
  fileSize: {
    type: Number // in bytes
  },
  filePath: {
    type: String
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ name: 1 });
reportSchema.index({ type: 1 });
reportSchema.index({ createdBy: 1 });
reportSchema.index({ generatedAt: -1 });
reportSchema.index({ status: 1 });
reportSchema.index({ tags: 1 });
reportSchema.index({ isPublic: 1 });
reportSchema.index({ 'schedule.isActive': 1 });

// Compound indexes
reportSchema.index({ type: 1, createdBy: 1 });
reportSchema.index({ status: 1, generatedAt: -1 });
reportSchema.index({ createdBy: 1, generatedAt: -1 });

// Pre-save validation
reportSchema.pre('save', function(next) {
  if (this.parameters.dateRange.end <= this.parameters.dateRange.start) {
    next(new Error('End date must be after start date'));
  }
  next();
});

export const ReportModel = mongoose.model<ReportDocument>('Report', reportSchema);