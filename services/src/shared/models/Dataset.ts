import mongoose, { Schema, Document } from 'mongoose';
import { Dataset as IDataset } from '../types';

export interface DatasetDocument extends IDataset, Document {}

const datasetSchema = new Schema<DatasetDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  source: {
    type: {
      type: String,
      enum: ['file', 'database', 'api', 'stream'],
      required: true
    },
    location: { type: String, required: true },
    credentials: {
      encrypted: String,
      algorithm: String,
      iv: String
    },
    refreshInterval: Number
  },
  schema: {
    columns: [{
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ['string', 'number', 'boolean', 'date', 'json'],
        required: true
      },
      nullable: { type: Boolean, default: true },
      unique: { type: Boolean, default: false },
      description: String
    }],
    primaryKey: String,
    foreignKeys: [{
      column: String,
      referencedTable: String,
      referencedColumn: String
    }]
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  rowCount: {
    type: Number,
    default: 0
  },
  columnCount: {
    type: Number,
    default: 0
  },
  lastCleaned: {
    type: Date
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  createdBy: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  dataQualityIssues: [{
    type: {
      type: String,
      enum: ['missing_values', 'duplicates', 'outliers', 'format_errors', 'inconsistent_data']
    },
    column: String,
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    count: Number,
    detectedAt: { type: Date, default: Date.now }
  }],
  processingHistory: [{
    operation: String,
    parameters: Schema.Types.Mixed,
    executedAt: { type: Date, default: Date.now },
    executedBy: String,
    result: {
      success: Boolean,
      message: String,
      affectedRows: Number
    }
  }]
}, {
  timestamps: true
});

// Indexes
datasetSchema.index({ name: 1 });
datasetSchema.index({ createdBy: 1 });
datasetSchema.index({ tags: 1 });
datasetSchema.index({ qualityScore: -1 });
datasetSchema.index({ lastCleaned: 1 });
datasetSchema.index({ isActive: 1 });
datasetSchema.index({ 'source.type': 1 });

// Compound indexes
datasetSchema.index({ createdBy: 1, isActive: 1 });
datasetSchema.index({ qualityScore: -1, lastCleaned: -1 });

// Pre-save middleware to update column count
datasetSchema.pre('save', function(next) {
  if (this.isModified('schema.columns')) {
    this.columnCount = this.schema.columns.length;
  }
  next();
});

export const DatasetModel = mongoose.model<DatasetDocument>('Dataset', datasetSchema);