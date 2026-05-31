export enum ExternalService {
  GMAIL = 'gmail',
  OUTLOOK = 'outlook',
  SLACK = 'slack',
  TEAMS = 'teams',
  SALESFORCE = 'salesforce',
  HUBSPOT = 'hubspot',
  JIRA = 'jira',
  TRELLO = 'trello',
  GOOGLE_DRIVE = 'google-drive',
  ONEDRIVE = 'onedrive',
  DROPBOX = 'dropbox',
  MICROSOFT_TEAMS = 'microsoft_teams'
}

export interface Integration {
  id: string;
  name?: string;
  service: ExternalService | string;
  credentials: any;
  configuration?: any;
  isActive: boolean;
  lastSync?: Date;
  syncStatus: SyncStatus;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum SyncStatus {
  NEVER_SYNCED = 'never_synced',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SyncJob {
  id: string;
  integrationId: string;
  status: SyncStatus;
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  error?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}