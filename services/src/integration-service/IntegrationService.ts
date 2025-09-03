import { EventEmitter } from 'events';
import { 
  IntegrationAdapter, 
  IntegrationRequest, 
  IntegrationResponse, 
  DataSyncRequest, 
  DataSyncResponse,
  WebhookRegistration,
  IntegrationMetrics,
  IntegrationEvent,
  IntegrationEventType,
  HealthStatus,
  RetryConfig,
  CircuitBreakerConfig,
  CircuitBreakerState
} from './types/IntegrationTypes';
import { ExternalService, Integration, SyncStatus } from '../shared/types';
import { GmailAdapter } from './adapters/GmailAdapter';
import { OutlookAdapter } from './adapters/OutlookAdapter';
import { SlackAdapter } from './adapters/SlackAdapter';
import { SalesforceAdapter } from './adapters/SalesforceAdapter';
import { MicrosoftTeamsAdapter } from './adapters/MicrosoftTeamsAdapter';
import { WebhookHandler } from './WebhookHandler';
import { IntegrationHealthMonitor } from './IntegrationHealthMonitor';
import { CredentialManager } from './CredentialManager';
import { logger } from '../shared/utils/logger';

/**
 * IntegrationService - Main service for managing external system integrations
 * Handles connection management, data synchronization, webhook processing, and health monitoring
 */
export class IntegrationService extends EventEmitter {
  private adapters: Map<string, IntegrationAdapter>;
  private integrations: Map<string, Integration>;
  private webhookHandler: WebhookHandler;
  private healthMonitor: IntegrationHealthMonitor;
  private credentialManager: CredentialManager;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private metrics: Map<string, IntegrationMetrics>;
  private retryConfig: RetryConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;

  constructor() {
    super();
    this.adapters = new Map();
    this.integrations = new Map();
    this.circuitBreakers = new Map();
    this.metrics = new Map();
    
    this.webhookHandler = new WebhookHandler();
    this.healthMonitor = new IntegrationHealthMonitor();
    this.credentialManager = new CredentialManager();
    
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'TEMPORARY_FAILURE']
    };
    
    this.circuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 300000
    };
    
    this.initializeAdapters();
    this.setupEventHandlers();
    
    logger.info('IntegrationService initialized');
  }

  /**
   * Initialize service adapters for different external systems
   */
  private initializeAdapters(): void {
    this.registerAdapter(ExternalService.GMAIL, new GmailAdapter());
    this.registerAdapter(ExternalService.OUTLOOK, new OutlookAdapter());
    this.registerAdapter(ExternalService.SLACK, new SlackAdapter());
    this.registerAdapter(ExternalService.SALESFORCE, new SalesforceAdapter());
    // Note: Microsoft Teams uses same service enum as Teams
    this.registerAdapter('microsoft_teams' as ExternalService, new MicrosoftTeamsAdapter());
  }

  /**
   * Register an integration adapter for a specific service
   */
  private registerAdapter(service: ExternalService, adapter: IntegrationAdapter): void {
    this.adapters.set(service, adapter);
    logger.info(`Registered adapter for ${service}`);
  }

  /**
   * Setup event handlers for integration events
   */
  private setupEventHandlers(): void {
    this.on('integration:connected', this.handleIntegrationConnected.bind(this));
    this.on('integration:disconnected', this.handleIntegrationDisconnected.bind(this));
    this.on('integration:error', this.handleIntegrationError.bind(this));
    this.on('sync:completed', this.handleSyncCompleted.bind(this));
    this.on('webhook:received', this.handleWebhookReceived.bind(this));
  }

  /**
   * Create a new integration with external system
   */
  async createIntegration(integrationId: string, request: IntegrationRequest): Promise<IntegrationResponse> {
    const startTime = Date.now();
    
    try {
      logger.info(`Creating integration ${integrationId} for service ${request.service}`);
      
      // Get appropriate adapter
      const adapter = this.adapters.get(request.service);
      if (!adapter) {
        throw new Error(`No adapter found for service: ${request.service}`);
      }

      // Encrypt credentials
      const encryptedCredentials = await this.credentialManager.encrypt(request.credentials);
      
      // Test connection
      const connectionTest = await this.executeWithRetry(
        () => adapter.testConnection(),
        `connection-test-${integrationId}`
      );
      
      if (!connectionTest.success) {
        return {
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: connectionTest.error || 'Failed to connect to external service',
            retryable: true
          },
          connectionTest
        };
      }

      // Connect to the service
      const connected = await this.executeWithRetry(
        () => adapter.connect(encryptedCredentials, request.configuration),
        `connect-${integrationId}`
      );
      
      if (!connected) {
        throw new Error('Failed to establish connection');
      }

      // Create integration record
      const integration: Integration = {
        id: integrationId,
        service: request.service,
        credentials: encryptedCredentials,
        configuration: request.configuration,
        isActive: true,
        lastSync: new Date(),
        syncStatus: SyncStatus.NEVER_SYNCED,
        errorCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.integrations.set(integrationId, integration);
      
      // Initialize metrics
      this.initializeMetrics(integrationId, request.service);
      
      // Initialize circuit breaker
      this.circuitBreakers.set(integrationId, {
        state: 'closed',
        failureCount: 0
      });

      // Register webhook if URL provided
      if (request.webhookUrl) {
        await this.registerWebhook({
          integrationId,
          events: ['*'], // Register for all events by default
          url: request.webhookUrl
        });
      }

      // Start health monitoring
      this.healthMonitor.startMonitoring(integrationId, adapter);

      // Emit event
      this.emitIntegrationEvent(IntegrationEventType.CONNECTED, integrationId, request.service, {
        connectionTest,
        responseTime: Date.now() - startTime
      });

      logger.info(`Integration ${integrationId} created successfully`, {
        service: request.service,
        responseTime: Date.now() - startTime
      });

      return {
        success: true,
        integrationId,
        connectionTest
      };

    } catch (error) {
      logger.error(`Failed to create integration ${integrationId}`, { error: error.message });
      
      this.emitIntegrationEvent(IntegrationEventType.ERROR_OCCURRED, integrationId, request.service, {
        error: error.message,
        operation: 'create_integration'
      });

      return {
        success: false,
        error: {
          code: 'INTEGRATION_CREATION_FAILED',
          message: error.message,
          retryable: this.isRetryableError(error.message)
        }
      };
    }
  }

  /**
   * Remove an existing integration
   */
  async removeIntegration(integrationId: string): Promise<IntegrationResponse> {
    try {
      logger.info(`Removing integration ${integrationId}`);
      
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        return {
          success: false,
          error: {
            code: 'INTEGRATION_NOT_FOUND',
            message: `Integration ${integrationId} not found`,
            retryable: false
          }
        };
      }

      const adapter = this.adapters.get(integration.service);
      if (adapter) {
        await adapter.disconnect();
      }

      // Stop health monitoring
      this.healthMonitor.stopMonitoring(integrationId);

      // Clean up resources
      this.integrations.delete(integrationId);
      this.circuitBreakers.delete(integrationId);
      this.metrics.delete(integrationId);

      // Emit event
      this.emitIntegrationEvent(IntegrationEventType.DISCONNECTED, integrationId, integration.service, {});

      logger.info(`Integration ${integrationId} removed successfully`);

      return { success: true };

    } catch (error) {
      logger.error(`Failed to remove integration ${integrationId}`, { error: error.message });
      
      return {
        success: false,
        error: {
          code: 'INTEGRATION_REMOVAL_FAILED',
          message: error.message,
          retryable: false
        }
      };
    }
  }

  /**
   * Synchronize data with external system
   */
  async syncData(request: DataSyncRequest): Promise<DataSyncResponse> {
    const { integrationId, options } = request;
    const startTime = Date.now();
    
    try {
      logger.info(`Starting data sync for integration ${integrationId}`);
      
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      if (!integration.isActive) {
        throw new Error(`Integration ${integrationId} is not active`);
      }

      // Check circuit breaker
      if (!this.isCircuitBreakerClosed(integrationId)) {
        throw new Error(`Circuit breaker is open for integration ${integrationId}`);
      }

      const adapter = this.adapters.get(integration.service);
      if (!adapter) {
        throw new Error(`No adapter found for service: ${integration.service}`);
      }

      // Update sync status
      integration.syncStatus = SyncStatus.IN_PROGRESS;
      this.integrations.set(integrationId, integration);

      // Emit sync started event
      this.emitIntegrationEvent(IntegrationEventType.SYNC_STARTED, integrationId, integration.service, {
        options
      });

      // Perform sync with retry logic
      const result = await this.executeWithRetry(
        () => adapter.syncData(options),
        `sync-${integrationId}`
      );

      // Update integration record
      integration.lastSync = new Date();
      integration.syncStatus = SyncStatus.SUCCESS;
      integration.errorCount = 0;
      integration.updatedAt = new Date();
      this.integrations.set(integrationId, integration);

      // Update metrics
      this.updateSyncMetrics(integrationId, result, Date.now() - startTime);

      // Reset circuit breaker on success
      this.resetCircuitBreaker(integrationId);

      // Emit sync completed event
      this.emitIntegrationEvent(IntegrationEventType.SYNC_COMPLETED, integrationId, integration.service, {
        result,
        duration: Date.now() - startTime
      });

      logger.info(`Data sync completed for integration ${integrationId}`, {
        recordsProcessed: result.recordsProcessed,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        result
      };

    } catch (error) {
      logger.error(`Data sync failed for integration ${integrationId}`, { error: error.message });
      
      // Update integration error count
      const integration = this.integrations.get(integrationId);
      if (integration) {
        integration.syncStatus = SyncStatus.FAILED;
        integration.errorCount += 1;
        integration.updatedAt = new Date();
        this.integrations.set(integrationId, integration);
      }

      // Update circuit breaker
      this.recordFailure(integrationId);

      // Emit sync failed event
      this.emitIntegrationEvent(IntegrationEventType.SYNC_FAILED, integrationId, integration?.service || 'unknown', {
        error: error.message,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: error.message,
          retryable: this.isRetryableError(error.message)
        }
      };
    }
  }

  /**
   * Register webhook for integration events
   */
  async registerWebhook(registration: WebhookRegistration): Promise<boolean> {
    try {
      return await this.webhookHandler.register(registration);
    } catch (error) {
      logger.error(`Failed to register webhook for integration ${registration.integrationId}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(integrationId: string, payload: any): Promise<boolean> {
    try {
      const result = await this.webhookHandler.process(integrationId, payload);
      
      this.emitIntegrationEvent(IntegrationEventType.WEBHOOK_RECEIVED, integrationId, 'unknown', {
        payload,
        result
      });

      return result.processed;
    } catch (error) {
      logger.error(`Failed to process webhook for integration ${integrationId}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get health status for integration
   */
  async getHealthStatus(integrationId: string): Promise<HealthStatus | null> {
    try {
      return await this.healthMonitor.getStatus(integrationId);
    } catch (error) {
      logger.error(`Failed to get health status for integration ${integrationId}`, {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get metrics for integration
   */
  getMetrics(integrationId: string): IntegrationMetrics | null {
    return this.metrics.get(integrationId) || null;
  }

  /**
   * Get all active integrations
   */
  getActiveIntegrations(): Integration[] {
    return Array.from(this.integrations.values()).filter(integration => integration.isActive);
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationId: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.retryConfig.maxAttempts || !this.isRetryableError(error.message)) {
          throw error;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );

        logger.warn(`Operation ${operationId} failed, retrying in ${delay}ms`, {
          attempt,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(errorMessage: string): boolean {
    return this.retryConfig.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Initialize metrics for integration
   */
  private initializeMetrics(integrationId: string, service: ExternalService): void {
    this.metrics.set(integrationId, {
      integrationId,
      service,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 100,
      errorRate: 0
    });
  }

  /**
   * Update sync metrics
   */
  private updateSyncMetrics(integrationId: string, result: any, responseTime: number): void {
    const metrics = this.metrics.get(integrationId);
    if (metrics) {
      metrics.totalRequests += 1;
      metrics.successfulRequests += 1;
      metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
      metrics.lastSyncTime = new Date();
      metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;
      this.metrics.set(integrationId, metrics);
    }
  }

  /**
   * Circuit breaker methods
   */
  private isCircuitBreakerClosed(integrationId: string): boolean {
    const state = this.circuitBreakers.get(integrationId);
    if (!state) return true;

    if (state.state === 'open') {
      if (state.nextAttemptTime && Date.now() >= state.nextAttemptTime.getTime()) {
        state.state = 'half-open';
        this.circuitBreakers.set(integrationId, state);
        return true;
      }
      return false;
    }

    return true;
  }

  private recordFailure(integrationId: string): void {
    const state = this.circuitBreakers.get(integrationId);
    if (state) {
      state.failureCount += 1;
      state.lastFailureTime = new Date();

      if (state.failureCount >= this.circuitBreakerConfig.failureThreshold) {
        state.state = 'open';
        state.nextAttemptTime = new Date(Date.now() + this.circuitBreakerConfig.recoveryTimeout);
      }

      this.circuitBreakers.set(integrationId, state);
    }
  }

  private resetCircuitBreaker(integrationId: string): void {
    const state = this.circuitBreakers.get(integrationId);
    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureTime = undefined;
      state.nextAttemptTime = undefined;
      this.circuitBreakers.set(integrationId, state);
    }
  }

  /**
   * Emit integration event
   */
  private emitIntegrationEvent(
    type: IntegrationEventType,
    integrationId: string,
    service: ExternalService,
    data: any
  ): void {
    const event: IntegrationEvent = {
      type,
      integrationId,
      service,
      data,
      timestamp: new Date()
    };

    this.emit(type, event);
    this.emit('integration:event', event);
  }

  /**
   * Event handlers
   */
  private handleIntegrationConnected(event: IntegrationEvent): void {
    logger.info(`Integration connected: ${event.integrationId}`);
  }

  private handleIntegrationDisconnected(event: IntegrationEvent): void {
    logger.info(`Integration disconnected: ${event.integrationId}`);
  }

  private handleIntegrationError(event: IntegrationEvent): void {
    logger.error(`Integration error: ${event.integrationId}`, { data: event.data });
  }

  private handleSyncCompleted(event: IntegrationEvent): void {
    logger.info(`Sync completed: ${event.integrationId}`, { data: event.data });
  }

  private handleWebhookReceived(event: IntegrationEvent): void {
    logger.info(`Webhook received: ${event.integrationId}`, { data: event.data });
  }
}