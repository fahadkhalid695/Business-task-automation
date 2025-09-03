import mongoose, { Schema, Document } from 'mongoose';
import { EmailMessage as IEmailMessage, Priority, EmailCategory } from '../types';

export interface EmailMessageDocument extends IEmailMessage, Document {}

const emailMessageSchema = new Schema<EmailMessageDocument>({
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: [{
    type: String,
    required: true,
    trim: true
  }],
  cc: [{
    type: String,
    trim: true
  }],
  bcc: [{
    type: String,
    trim: true
  }],
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  body: {
    type: String,
    required: true
  },
  htmlBody: {
    type: String
  },
  priority: {
    type: String,
    enum: Object.values(Priority),
    default: Priority.MEDIUM
  },
  category: {
    type: String,
    enum: Object.values(EmailCategory),
    required: true
  },
  sentiment: {
    score: { type: Number, min: -1, max: 1 },
    confidence: { type: Number, min: 0, max: 1 },
    label: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    }
  },
  actionItems: [{
    type: String,
    trim: true
  }],
  attachments: [{
    id: String,
    filename: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: Date
  }],
  receivedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  threadId: {
    type: String
  },
  messageId: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true
});

// Indexes
emailMessageSchema.index({ from: 1 });
emailMessageSchema.index({ to: 1 });
emailMessageSchema.index({ subject: 'text', body: 'text' });
emailMessageSchema.index({ category: 1 });
emailMessageSchema.index({ priority: 1 });
emailMessageSchema.index({ receivedAt: -1 });
emailMessageSchema.index({ processedAt: 1 });
emailMessageSchema.index({ isRead: 1 });
emailMessageSchema.index({ isArchived: 1 });
emailMessageSchema.index({ threadId: 1 });
emailMessageSchema.index({ messageId: 1 });

// Compound indexes
emailMessageSchema.index({ category: 1, priority: -1, receivedAt: -1 });
emailMessageSchema.index({ from: 1, receivedAt: -1 });
emailMessageSchema.index({ isRead: 1, isArchived: 1 });

export const EmailMessageModel = mongoose.model<EmailMessageDocument>('EmailMessage', emailMessageSchema);