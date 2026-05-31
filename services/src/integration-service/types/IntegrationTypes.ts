export interface EncryptedCredentials {
  encrypted: string;
  algorithm: string;
  iv: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface IntegrationCredentials {
  [key: string]: any;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  secure?: boolean;
}

export interface WebhookPayload {
  source: ExternalService;
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

export interface HealthDetails {
  apiQuotaUsed?: number;
  apiQuotaLimit?: number;
  rateLimitRemaining?: number;
  lastSuccessfulSync?: Date;
  consecutiveFailures: number;
  [key: string]: any;
}

export type ExternalService = 'gmail' | 'outlook' | 'slack' | 'teams' | 'salesforce' | 'hubspot' | 'jira' | 'trello' | 'google-drive' | 'onedrive' | 'dropbox' | 'microsoft_teams' | string;

export interface IntegrationEvent {
  type: IntegrationEventType;
  integrationId: string;
  service: ExternalService | string;
  data?: any;
  error?: Error;
  timestamp: Date;
}

export interface IntegrationAdapter {
  id: string;
  name: string;
  testConnection(): Promise<ConnectionTestResult>;
  connect(credentials: EncryptedCredentials, configuration?: any): Promise<boolean>;
  disconnect(): Promise<void>;
  syncData(options?: any): Promise<SyncResult>;
  getHealthStatus(): Promise<HealthStatus>;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  latency?: number;
}

export interface SyncResult {
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsDeleted: number;
  errors?: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
  uptime: number;
  details?: HealthDetails;
}

export enum IntegrationEventType {
  CONNECTED = 'integration:connected',
  DISCONNECTED = 'integration:disconnected',
  ERROR_OCCURRED = 'integration:error',
  SYNC_STARTED = 'sync:started',
  SYNC_COMPLETED = 'sync:completed',
  SYNC_FAILED = 'sync:failed',
  WEBHOOK_RECEIVED = 'webhook:received',
  HEALTH_CHECK = 'health:check',
  STATUS_CHANGE = 'health:status_change'
}

export interface IntegrationRequest {
  service: ExternalService;
  credentials: any;
  configuration?: any;
  webhookUrl?: string;
  options?: {
    timeout?: number;
    retries?: number;
  };
}

export interface IntegrationResponse {
  success: boolean;
  integrationId?: string;
  connectionTest?: ConnectionTestResult;
  data?: any;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metadata?: {
    responseTime: number;
    timestamp: Date;
  };
}

export interface DataSyncRequest {
  integrationId: string;
  options?: {
    syncType?: 'full' | 'incremental';
    filters?: any;
    lastSyncTime?: Date;
  };
}

export interface DataSyncResponse {
  success: boolean;
  result?: SyncResult;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface WebhookRegistration {
  integrationId: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookResult {
  processed: boolean;
  actions: WebhookAction[];
  error?: string;
}

export interface WebhookAction {
  type: 'create_task' | 'update_record' | 'send_notification' | 'trigger_workflow';
  data: any;
}

export interface IntegrationMetrics {
  integrationId: string;
  service: ExternalService | string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  errorRate: number;
  lastSyncTime?: Date;
  lastActivity?: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}
