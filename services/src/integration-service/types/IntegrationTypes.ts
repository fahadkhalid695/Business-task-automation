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
  integrationId: string;
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
}

export type ExternalService = 'gmail' | 'outlook' | 'slack' | 'teams' | 'salesforce' | 'hubspot' | 'jira' | 'trello' | 'google-drive' | 'onedrive' | 'dropbox';

export interface IntegrationEvent {
  type: 'connected' | 'disconnected' | 'error' | 'data_sync' | 'webhook_received';
  integrationId: string;
  data?: any;
  error?: Error;
  timestamp: Date;
}

export interface IntegrationAdapter {
  id: string;
  name: string;
  testConnection(): Promise<boolean>;
  getHealthStatus(): Promise<HealthStatus>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
  uptime: number;
  details?: HealthDetails;
}

export type IntegrationEventType = 'health_check' | 'status_change' | 'error' | 'recovery';

export interface IntegrationRequest {
  integrationId: string;
  action: string;
  data: any;
  options?: {
    timeout?: number;
    retries?: number;
  };
}

export interface IntegrationResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    responseTime: number;
    timestamp: Date;
  };
}

export interface DataSyncRequest {
  integrationId: string;
  syncType: 'full' | 'incremental';
  filters?: any;
  lastSyncTime?: Date;
}

export interface DataSyncResponse {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsDeleted: number;
  nextSyncTime?: Date;
  error?: string;
}

export interface WebhookRegistration {
  integrationId: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface IntegrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  lastActivity: Date;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';