import { EmailMessage, CalendarEvent, Document, Priority, EmailCategory } from '../../shared/types';

// Email Processing Types
export interface EmailProcessingRequest {
  emails: EmailMessage[];
  options?: EmailProcessingOptions;
}

export interface EmailProcessingOptions {
  categorize?: boolean;
  analyzeSentiment?: boolean;
  extractActionItems?: boolean;
  generateSummary?: boolean;
  autoRespond?: boolean;
}

export interface EmailProcessingResult {
  processedEmails: ProcessedEmail[];
  summary: EmailSummary;
  actionItems: ActionItem[];
  suggestedResponses?: EmailResponse[];
}

export interface ProcessedEmail extends EmailMessage {
  confidence: number;
  processingNotes: string[];
  suggestedActions: string[];
}

export interface EmailSummary {
  totalEmails: number;
  categoryCounts: { [key in EmailCategory]: number };
  priorityCounts: { [key in Priority]: number };
  averageSentiment: number;
  urgentCount: number;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: Priority;
  dueDate?: Date;
  assignedTo?: string;
  sourceEmailId: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface EmailResponse {
  emailId: string;
  subject: string;
  body: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  confidence: number;
}

// Calendar Management Types
export interface CalendarRequest {
  type: 'schedule' | 'reschedule' | 'cancel' | 'find_conflicts';
  event?: Partial<CalendarEvent>;
  constraints?: SchedulingConstraints;
}

export interface SchedulingConstraints {
  preferredTimes?: TimeSlot[];
  excludedTimes?: TimeSlot[];
  duration: number; // in minutes
  attendees: string[];
  location?: string;
  isOnline?: boolean;
  buffer?: number; // minutes between meetings
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface CalendarResponse {
  success: boolean;
  event?: CalendarEvent;
  conflicts?: ConflictInfo[];
  suggestions?: TimeSlot[];
  message: string;
}

export interface ConflictInfo {
  conflictingEventId: string;
  conflictingEventTitle: string;
  conflictType: 'overlap' | 'back_to_back' | 'travel_time';
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

// Document Generation Types
export interface DocumentGenerationRequest {
  type: DocumentType;
  template?: string;
  data: DocumentData;
  options?: DocumentOptions;
}

export enum DocumentType {
  REPORT = 'report',
  CONTRACT = 'contract',
  PROPOSAL = 'proposal',
  MEETING_NOTES = 'meeting_notes',
  EMAIL_TEMPLATE = 'email_template',
  PRESENTATION = 'presentation',
  INVOICE = 'invoice',
  MEMO = 'memo'
}

export interface DocumentData {
  title: string;
  content?: any;
  variables?: { [key: string]: any };
  metadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  author: string;
  department: string;
  version: string;
  tags: string[];
  confidentiality: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface DocumentOptions {
  format: 'pdf' | 'docx' | 'html' | 'markdown';
  includeHeader?: boolean;
  includeFooter?: boolean;
  watermark?: string;
  language?: string;
}

export interface DocumentGenerationResult {
  document: Document;
  downloadUrl: string;
  previewUrl: string;
  metadata: GeneratedDocumentMetadata;
}

export interface GeneratedDocumentMetadata {
  wordCount: number;
  pageCount: number;
  generationTime: number;
  templateUsed: string;
  quality: 'draft' | 'review' | 'final';
}

// Form Processing Types
export interface FormProcessingRequest {
  formType: FormType;
  data: FormData;
  options?: FormProcessingOptions;
}

export enum FormType {
  EXPENSE_REPORT = 'expense_report',
  LEAVE_REQUEST = 'leave_request',
  PURCHASE_ORDER = 'purchase_order',
  CUSTOMER_FEEDBACK = 'customer_feedback',
  SURVEY_RESPONSE = 'survey_response',
  APPLICATION_FORM = 'application_form'
}

export interface FormData {
  fields: { [key: string]: any };
  attachments?: FormAttachment[];
  submittedBy: string;
  submittedAt: Date;
}

export interface FormAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  extractedData?: any;
}

export interface FormProcessingOptions {
  validateData?: boolean;
  extractFromAttachments?: boolean;
  autoApprove?: boolean;
  notifyApprovers?: boolean;
}

export interface FormProcessingResult {
  formId: string;
  status: 'processed' | 'pending_review' | 'rejected';
  extractedData: any;
  validationErrors: ValidationError[];
  nextSteps: string[];
  approvalRequired: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Integration Types
export interface ExternalIntegration {
  service: 'gmail' | 'outlook' | 'google_calendar' | 'microsoft_calendar';
  credentials: any;
  config: IntegrationConfig;
}

export interface IntegrationConfig {
  syncInterval: number;
  autoSync: boolean;
  filters: IntegrationFilter[];
  fieldMappings: { [key: string]: string };
}

export interface IntegrationFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith';
  value: string;
}

// Service Response Types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: ResponseMetadata;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export interface ResponseMetadata {
  processingTime: number;
  requestId: string;
  version: string;
}