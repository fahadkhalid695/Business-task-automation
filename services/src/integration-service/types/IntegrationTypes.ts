import { ExternalService, EncryptedCredentials, IntegrationConfig, SyncStatus } from '../../shared/types';

// Core Integration Types
export interface IntegrationAdapter {
  connect(credentials: EncryptedCredentials, config: IntegrationConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  syncData(options?: SyncOptions): Promise<SyncResult>;
  handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
  getHealthStatus(): Promise<HealthStatus>;
}

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  timestamp: Date;
}

export interface SyncOptions {
  fullSync?: boolean;
  lastSyncTime?: Date;
  batchSize?: number;
  filters?: SyncFilter[];
}

export interface SyncFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errors: SyncError[];
  nextSyncToken?: string;
  timestamp: Date;
}

export interface SyncError {
  recordId?: string;
  error: string;
  retryable: boolean;
}

export interface WebhookPayload {
  source: ExternalService;
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
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

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
  uptime: number;
  details?: HealthDetails;
}

export interface HealthDetails {
  apiQuotaUsed?: number;
  apiQuotaLimit?: number;
  rateLimitRemaining?: number;
  lastSuccessfulSync?: Date;
  consecutiveFailures: number;
}

// Service-specific Types
export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments: GmailAttachment[];
  labels: string[];
  receivedAt: Date;
  isRead: boolean;
  isImportant: boolean;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded
}

export interface OutlookMessage {
  id: string;
  conversationId: string;
  from: OutlookEmailAddress;
  toRecipients: OutlookEmailAddress[];
  ccRecipients?: OutlookEmailAddress[];
  bccRecipients?: OutlookEmailAddress[];
  subject: string;
  body: OutlookMessageBody;
  attachments: OutlookAttachment[];
  categories: string[];
  receivedDateTime: Date;
  isRead: boolean;
  importance: 'low' | 'normal' | 'high';
}

export interface OutlookEmailAddress {
  name: string;
  address: string;
}

export interface OutlookMessageBody {
  contentType: 'text' | 'html';
  content: string;
}

export interface OutlookAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string; // base64 encoded
}

export interface SlackMessage {
  ts: string;
  channel: string;
  user: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  reactions?: SlackReaction[];
}

export interface SlackBlock {
  type: string;
  text?: SlackText;
  elements?: any[];
}

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
}

export interface SlackAttachment {
  id: string;
  name: string;
  mimetype: string;
  filetype: string;
  size: number;
  url_private?: string;
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SalesforceRecord {
  Id?: string;
  attributes?: SalesforceAttributes;
  [key: string]: any;
}

export interface SalesforceAttributes {
  type: string;
  url: string;
}

export interface SalesforceQuery {
  soql: string;
  includeDeleted?: boolean;
}

export interface SalesforceQueryResult {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: SalesforceRecord[];
}

export interface TeamsMessage {
  id: string;
  chatId?: string;
  channelId?: string;
  from: TeamsUser;
  body: TeamsMessageBody;
  attachments?: TeamsAttachment[];
  mentions?: TeamsMention[];
  createdDateTime: Date;
  importance: 'normal' | 'high' | 'urgent';
}

export interface TeamsUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
}

export interface TeamsMessageBody {
  contentType: 'text' | 'html';
  content: string;
}

export interface TeamsAttachment {
  id: string;
  name: string;
  contentType: string;
  contentUrl?: string;
}

export interface TeamsMention {
  id: string;
  mentionText: string;
  mentioned: TeamsUser;
}

// Integration Management Types
export interface IntegrationRequest {
  service: ExternalService;
  credentials: EncryptedCredentials;
  configuration: IntegrationConfig;
  webhookUrl?: string;
}

export interface IntegrationResponse {
  success: boolean;
  integrationId?: string;
  error?: IntegrationError;
  connectionTest?: ConnectionTestResult;
}

export interface IntegrationError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface DataSyncRequest {
  integrationId: string;
  options?: SyncOptions;
}

export interface DataSyncResponse {
  success: boolean;
  result?: SyncResult;
  error?: IntegrationError;
}

export interface WebhookRegistration {
  integrationId: string;
  events: string[];
  url: string;
  secret?: string;
}

export interface IntegrationMetrics {
  integrationId: string;
  service: ExternalService;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastSyncTime?: Date;
  uptime: number;
  errorRate: number;
}

// Retry and Circuit Breaker Types
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

// Credential Management Types
export interface CredentialStore {
  encrypt(data: any): Promise<EncryptedCredentials>;
  decrypt(credentials: EncryptedCredentials): Promise<any>;
  rotate(integrationId: string): Promise<boolean>;
}

export interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  expiresAt?: Date;
  error?: string;
}

// Event Types
export interface IntegrationEvent {
  type: IntegrationEventType;
  integrationId: string;
  service: ExternalService;
  data: any;
  timestamp: Date;
}

export enum IntegrationEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  WEBHOOK_RECEIVED = 'webhook_received',
  ERROR_OCCURRED = 'error_occurred',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  CREDENTIALS_EXPIRED = 'credentials_expired'
}