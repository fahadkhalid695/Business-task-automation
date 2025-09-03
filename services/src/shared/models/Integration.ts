import mongoose, { Schema, Document } from 'mongoose';
import { Integration as IIntegration, ExternalService, SyncStatus } from '../types';

export interface IntegrationDocument extends IIntegration, Document {}

const integrationSchema = new Schema<IntegrationDocument>({
  service: {
    type: String,
    enum: Object.values(ExternalService),
    required: true
  },
  credentials: {
    encrypted: { type: String, required: true },
    algorithm: { type: String, required: true },
    iv: { type: String, required: true }
  },
  configuration: {
    apiEndpoint: String,
    webhookUrl: String,
    syncInterval: { type: Number, default: 300000 }, // 5 minutes
    fieldMappings: { type: Map, of: String },
    filters: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'contains', 'startsWith', 'endsWith']
      },
      value: String
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    enum: Object.values(SyncStatus),
    default: SyncStatus.NEVER_SYNCED
  },
  errorCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
integrationSchema.index({ service: 1 });
integrationSchema.index({ isActive: 1 });
integrationSchema.index({ syncStatus: 1 });
integrationSchema.index({ lastSync: 1 });
integrationSchema.index({ errorCount: 1 });

// Compound indexes
integrationSchema.index({ service: 1, isActive: 1 });
integrationSchema.index({ isActive: 1, syncStatus: 1 });

// Pre-save middleware to reset error count on successful sync
integrationSchema.pre('save', function(next) {
  if (this.isModified('syncStatus') && this.syncStatus === SyncStatus.SUCCESS) {
    this.errorCount = 0;
  }
  next();
});

export const IntegrationModel = mongoose.model<IntegrationDocument>('Integration', integrationSchema);