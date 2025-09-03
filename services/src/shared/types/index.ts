// Core Entity Interfaces
export interface User {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  permissions: Permission[];
  preferences: UserPreferences;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assignedTo: string;
  createdBy: string;
  title: string;
  description: string;
  data: TaskData;
  workflow: WorkflowStep[];
  estimatedDuration?: number;
  actualDuration?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  dueDate?: Date;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  triggers: TriggerCondition[];
  isActive: boolean;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  content: string;
  metadata: DocumentMetadata;
  tags: string[];
  createdBy: string;
  version: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Integration {
  id: string;
  service: ExternalService;
  credentials: EncryptedCredentials;
  configuration: IntegrationConfig;
  isActive: boolean;
  lastSync: Date;
  syncStatus: SyncStatus;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Enums and Types
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum Permission {
  READ_TASKS = 'read:tasks',
  WRITE_TASKS = 'write:tasks',
  CREATE_TASKS = 'create:tasks',
  DELETE_TASKS = 'delete:tasks',
  MANAGE_USERS = 'manage:users',
  MANAGE_INTEGRATIONS = 'manage:integrations',
  VIEW_ANALYTICS = 'view:analytics',
  MANAGE_WORKFLOWS = 'manage:workflows',
  READ_PERSONAL_DATA = 'read:personal_data',
  READ_HEALTH_DATA = 'read:health_data',
  ADMIN_ACCESS = 'admin:access'
}

export enum TaskType {
  EMAIL_PROCESSING = 'email_processing',
  CALENDAR_MANAGEMENT = 'calendar_management',
  DOCUMENT_GENERATION = 'document_generation',
  DATA_ANALYSIS = 'data_analysis',
  REPORT_GENERATION = 'report_generation',
  COMMUNICATION = 'communication',
  PROJECT_MANAGEMENT = 'project_management',
  FINANCE_HR = 'finance_hr',
  CREATIVE = 'creative'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
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

export enum ExternalService {
  GMAIL = 'gmail',
  OUTLOOK = 'outlook',
  SLACK = 'slack',
  SALESFORCE = 'salesforce',
  GOOGLE_CALENDAR = 'google_calendar',
  MICROSOFT_CALENDAR = 'microsoft_calendar',
  DROPBOX = 'dropbox',
  GOOGLE_DRIVE = 'google_drive'
}

export enum SyncStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  IN_PROGRESS = 'in_progress',
  NEVER_SYNCED = 'never_synced'
}

// Supporting Interfaces
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  dashboard: DashboardSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  slack: boolean;
  taskReminders: boolean;
  workflowUpdates: boolean;
}

export interface DashboardSettings {
  widgets: string[];
  layout: 'grid' | 'list';
  refreshInterval: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  configuration: StepConfiguration;
  dependencies: string[];
  timeout?: number;
  retryCount?: number;
  order: number;
}

export enum StepType {
  AI_PROCESSING = 'ai_processing',
  DATA_TRANSFORMATION = 'data_transformation',
  EXTERNAL_API_CALL = 'external_api_call',
  USER_APPROVAL = 'user_approval',
  NOTIFICATION = 'notification',
  CONDITIONAL = 'conditional'
}

export interface StepConfiguration {
  [key: string]: any;
}

export interface TriggerCondition {
  type: TriggerType;
  configuration: TriggerConfiguration;
}

export enum TriggerType {
  SCHEDULE = 'schedule',
  EMAIL_RECEIVED = 'email_received',
  FILE_UPLOADED = 'file_uploaded',
  WEBHOOK = 'webhook',
  MANUAL = 'manual'
}

export interface TriggerConfiguration {
  [key: string]: any;
}

export interface TaskData {
  input: any;
  output?: any;
  context: TaskContext;
  attachments?: Attachment[];
}

export interface TaskContext {
  userId: string;
  workflowId?: string;
  integrationId?: string;
  metadata: { [key: string]: any };
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface DocumentMetadata {
  author: string;
  category: string;
  keywords: string[];
  language: string;
  wordCount?: number;
  lastModifiedBy: string;
}

export interface EncryptedCredentials {
  encrypted: string;
  algorithm: string;
  iv: string;
}

export interface IntegrationConfig {
  apiEndpoint?: string;
  webhookUrl?: string;
  syncInterval?: number;
  fieldMappings?: { [key: string]: string };
  filters?: IntegrationFilter[];
}

export interface IntegrationFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith';
  value: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

// Service-specific Types
export interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  priority: Priority;
  category: EmailCategory;
  sentiment: SentimentScore;
  actionItems: string[];
  attachments: Attachment[];
  receivedAt: Date;
  processedAt?: Date;
}

export enum EmailCategory {
  URGENT = 'urgent',
  MEETING = 'meeting',
  INVOICE = 'invoice',
  NEWSLETTER = 'newsletter',
  SPAM = 'spam',
  PERSONAL = 'personal',
  WORK = 'work'
}

export interface SentimentScore {
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  label: 'positive' | 'negative' | 'neutral';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: EventAttendee[];
  location?: string;
  isOnline: boolean;
  meetingUrl?: string;
  conflictsWith: string[];
  status: EventStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAttendee {
  email: string;
  name: string;
  status: AttendeeStatus;
  isOptional: boolean;
}

export enum EventStatus {
  CONFIRMED = 'confirmed',
  TENTATIVE = 'tentative',
  CANCELLED = 'cancelled'
}

export enum AttendeeStatus {
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  TENTATIVE = 'tentative',
  PENDING = 'pending'
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  source: DataSource;
  schema: DataSchema;
  qualityScore: number;
  rowCount: number;
  columnCount: number;
  lastCleaned: Date;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSource {
  type: 'file' | 'database' | 'api' | 'stream';
  location: string;
  credentials?: EncryptedCredentials;
  refreshInterval?: number;
}

export interface DataSchema {
  columns: DataColumn[];
  primaryKey?: string;
  foreignKeys?: ForeignKey[];
}

export interface DataColumn {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json';
  nullable: boolean;
  unique: boolean;
  description?: string;
}

export interface ForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface Report {
  id: string;
  name: string;
  type: ReportType;
  parameters: ReportParameters;
  data: ReportData;
  generatedAt: Date;
  schedule?: ReportSchedule;
  recipients: string[];
  format: ReportFormat;
  createdBy: string;
}

export enum ReportType {
  SALES = 'sales',
  FINANCIAL = 'financial',
  PERFORMANCE = 'performance',
  ANALYTICS = 'analytics',
  CUSTOM = 'custom'
}

export interface ReportParameters {
  dateRange: DateRange;
  filters: ReportFilter[];
  groupBy?: string[];
  metrics: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReportFilter {
  field: string;
  operator: string;
  value: any;
}

export interface ReportData {
  headers: string[];
  rows: any[][];
  summary?: ReportSummary;
  charts?: ChartData[];
}

export interface ReportSummary {
  totalRecords: number;
  keyMetrics: { [key: string]: number };
  insights: string[];
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  data: any[];
  options?: any;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  isActive: boolean;
}

export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
  HTML = 'html'
}