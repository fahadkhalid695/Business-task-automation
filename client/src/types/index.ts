// User types
export interface User {
  id: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  preferences: UserPreferences;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum Permission {
  READ_TASKS = 'read:tasks',
  WRITE_TASKS = 'write:tasks',
  DELETE_TASKS = 'delete:tasks',
  MANAGE_USERS = 'manage:users',
  MANAGE_INTEGRATIONS = 'manage:integrations',
  VIEW_ANALYTICS = 'view:analytics',
  MANAGE_WORKFLOWS = 'manage:workflows'
}

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

// Task types
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
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  dueDate?: string;
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
  uploadedAt: string;
}

// Workflow types
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
  createdAt: string;
  updatedAt: string;
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

// API Response types
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
  timestamp: string;
  requestId: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}