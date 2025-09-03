import mongoose, { Schema, Document as MongoDocument } from 'mongoose';
import { Document as IDocument, DocumentType } from '../types';

export interface DocumentDocument extends IDocument, MongoDocument {}

const documentSchema = new Schema<DocumentDocument>({
  type: {
    type: String,
    enum: Object.values(DocumentType),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    author: { type: String, required: true },
    category: { type: String, required: true },
    keywords: [{ type: String }],
    language: { type: String, default: 'en' },
    wordCount: { type: Number },
    lastModifiedBy: { type: String, required: true }
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
  version: {
    type: Number,
    default: 1
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ title: 'text', content: 'text', tags: 'text' });
documentSchema.index({ type: 1 });
documentSchema.index({ createdBy: 1 });
documentSchema.index({ 'metadata.category': 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ isPublic: 1 });

// Compound indexes
documentSchema.index({ type: 1, createdBy: 1 });
documentSchema.index({ 'metadata.category': 1, isPublic: 1 });

// Pre-save middleware to calculate word count
documentSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    this.metadata.wordCount = this.content.split(/\s+/).length;
  }
  next();
});

export const DocumentModel = mongoose.model<DocumentDocument>('Document', documentSchema);