export interface Integration {
  id: string;
  name: string;
  type: ExternalService;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

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

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

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