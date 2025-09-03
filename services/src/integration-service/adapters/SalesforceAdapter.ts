import { 
  IntegrationAdapter, 
  ConnectionTestResult, 
  SyncOptions, 
  SyncResult, 
  WebhookPayload, 
  WebhookResult, 
  HealthStatus,
  SalesforceRecord,
  SalesforceQuery,
  SalesforceQueryResult
} from '../types/IntegrationTypes';
import { EncryptedCredentials, IntegrationConfig } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

/**
 * SalesforceAdapter - Integration adapter for Salesforce API
 */
export class SalesforceAdapter implements IntegrationAdapter {
  private credentials: any;
  private config: IntegrationConfig;
  private isConnected: boolean = false;
  private instanceUrl: string = '';
  private lastSyncToken?: string;

  /**
   * Connect to Salesforce API
   */
  async connect(credentials: EncryptedCredentials, config: IntegrationConfig): Promise<boolean> {
    try {
      logger.info('Connecting to Salesforce API');
      
      this.credentials = credentials;
      this.config = config;
      this.instanceUrl = credentials.instanceUrl || 'https://login.salesforce.com';
      
      const testResult = await this.testConnection();
      this.isConnected = testResult.success;
      
      if (this.isConnected) {
        logger.info('Successfully connected to Salesforce API');
      } else {
        logger.error('Failed to connect to Salesforce API', { error: testResult.error });
      }
      
      return this.isConnected;
    } catch (error) {
      logger.error('Salesforce connection failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Salesforce API
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Salesforce API');
      this.isConnected = false;
      this.credentials = null;
      this.config = {};
      this.instanceUrl = '';
      this.lastSyncToken = undefined;
      logger.info('Disconnected from Salesforce API');
    } catch (error) {
      logger.error('Error during Salesforce disconnection', { error: error.message });
    }
  }

  /**
   * Test Salesforce API connection
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      if (!this.credentials?.accessToken) {
        return {
          success: false,
          error: 'No access token provided',
          timestamp: new Date()
        };
      }

      const response = await fetch(`${this.instanceUrl}/services/oauth2/userinfo`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Salesforce API error: ${response.status} - ${errorText}`,
          timestamp: new Date()
        };
      }

      const userInfo = await response.json();
      const latency = Date.now() - startTime;

      logger.info('Salesforce connection test successful', {
        userId: userInfo.user_id,
        organizationId: userInfo.organization_id,
        latency
      });

      return {
        success: true,
        latency,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync data from Salesforce
   */
  async syncData(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Salesforce API');
      }

      logger.info('Starting Salesforce data sync', { options });

      let recordsProcessed = 0;
      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: any[] = [];

      // Define objects to sync
      const objectsToSync = this.config.objectsToSync || ['Lead', 'Contact', 'Account', 'Opportunity', 'Case'];

      for (const objectType of objectsToSync) {
        try {
          const objectResult = await this.syncObject(objectType, options);
          recordsProcessed += objectResult.recordsProcessed;
          recordsCreated += objectResult.recordsCreated;
          recordsUpdated += objectResult.recordsUpdated;
          errors.push(...objectResult.errors);
        } catch (error) {
          errors.push({
            recordId: objectType,
            error: error.message,
            retryable: true
          });
          logger.error('Failed to sync Salesforce object', {
            objectType,
            error: error.message
          });
        }
      }

      const result: SyncResult = {
        success: true,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsDeleted: 0,
        errors,
        nextSyncToken: this.lastSyncToken,
        timestamp: new Date()
      };

      logger.info('Salesforce sync completed', {
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        errors: errors.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Salesforce sync failed', { error: error.message });
      
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsDeleted: 0,
        errors: [{
          error: error.message,
          retryable: true
        }],
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync specific Salesforce object
   */
  private async syncObject(objectType: string, options?: SyncOptions): Promise<{
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    errors: any[];
  }> {
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: any[] = [];

    // Build SOQL query
    let soql = `SELECT Id, CreatedDate, LastModifiedDate FROM ${objectType}`;
    
    if (this.lastSyncToken && !options?.fullSync) {
      soql += ` WHERE LastModifiedDate > ${this.lastSyncToken}`;
    }
    
    soql += ` ORDER BY LastModifiedDate DESC LIMIT ${options?.batchSize || 200}`;

    const queryResult = await this.executeQuery({ soql });

    for (const record of queryResult.records) {
      try {
        const processedRecord = this.processRecord(record, objectType);
        
        recordsProcessed++;
        
        // Determine if record is new or updated based on creation vs modification date
        const createdDate = new Date(record.CreatedDate);
        const modifiedDate = new Date(record.LastModifiedDate);
        
        if (createdDate.getTime() === modifiedDate.getTime()) {
          recordsCreated++;
        } else {
          recordsUpdated++;
        }
        
        logger.debug('Processed Salesforce record', {
          objectType,
          recordId: record.Id,
          lastModified: record.LastModifiedDate
        });

      } catch (error) {
        errors.push({
          recordId: record.Id,
          error: error.message,
          retryable: true
        });
      }
    }

    // Update sync token with latest modification date
    if (queryResult.records.length > 0) {
      this.lastSyncToken = queryResult.records[0].LastModifiedDate;
    }

    return { recordsProcessed, recordsCreated, recordsUpdated, errors };
  }

  /**
   * Handle Salesforce webhook
   */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    try {
      logger.info('Processing Salesforce webhook', { event: payload.event });

      const actions: any[] = [];

      switch (payload.event) {
        case 'lead.created':
          actions.push({
            type: 'create_task',
            data: {
              type: 'lead_processing',
              priority: 'high',
              data: {
                leadId: payload.data.Id,
                name: payload.data.Name,
                email: payload.data.Email,
                company: payload.data.Company,
                source: payload.data.LeadSource
              }
            }
          });
          break;

        case 'opportunity.updated':
          actions.push({
            type: 'send_notification',
            data: {
              type: 'opportunity_update',
              opportunityId: payload.data.Id,
              name: payload.data.Name,
              stage: payload.data.StageName,
              amount: payload.data.Amount,
              probability: payload.data.Probability
            }
          });
          break;

        case 'case.created':
          actions.push({
            type: 'create_task',
            data: {
              type: 'case_processing',
              priority: this.determineCasePriority(payload.data.Priority),
              data: {
                caseId: payload.data.Id,
                caseNumber: payload.data.CaseNumber,
                subject: payload.data.Subject,
                priority: payload.data.Priority,
                status: payload.data.Status,
                accountId: payload.data.AccountId,
                contactId: payload.data.ContactId
              }
            }
          });
          break;

        case 'contact.updated':
          actions.push({
            type: 'update_record',
            data: {
              type: 'contact_update',
              contactId: payload.data.Id,
              email: payload.data.Email,
              phone: payload.data.Phone,
              accountId: payload.data.AccountId
            }
          });
          break;

        default:
          logger.warn(`Unhandled Salesforce webhook event: ${payload.event}`);
      }

      return {
        processed: true,
        actions
      };

    } catch (error) {
      logger.error('Failed to process Salesforce webhook', { error: error.message });
      
      return {
        processed: false,
        actions: [],
        error: error.message
      };
    }
  }

  /**
   * Get Salesforce adapter health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const testResult = await this.testConnection();
      
      // Check API limits
      const limitsInfo = await this.getApiLimits();
      
      return {
        status: testResult.success ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        responseTime: testResult.latency,
        errorRate: testResult.success ? 0 : 100,
        uptime: testResult.success ? 100 : 0,
        details: {
          consecutiveFailures: testResult.success ? 0 : 1,
          lastSuccessfulSync: this.lastSyncToken ? new Date() : undefined,
          apiQuotaUsed: limitsInfo?.DailyApiRequests?.Used || 0,
          apiQuotaLimit: limitsInfo?.DailyApiRequests?.Max || 0
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        errorRate: 100,
        uptime: 0,
        details: {
          consecutiveFailures: 1
        }
      };
    }
  }

  /**
   * Execute SOQL query
   */
  async executeQuery(query: SalesforceQuery): Promise<SalesforceQueryResult> {
    try {
      const encodedQuery = encodeURIComponent(query.soql);
      const endpoint = query.includeDeleted ? 'queryAll' : 'query';
      
      const response = await fetch(
        `${this.instanceUrl}/services/data/v57.0/${endpoint}/?q=${encodedQuery}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Salesforce query failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        totalSize: data.totalSize,
        done: data.done,
        nextRecordsUrl: data.nextRecordsUrl,
        records: data.records || []
      };

    } catch (error) {
      logger.error('Failed to execute Salesforce query', {
        query: query.soql,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create or update Salesforce record
   */
  async upsertRecord(objectType: string, record: SalesforceRecord): Promise<SalesforceRecord> {
    try {
      const method = record.Id ? 'PATCH' : 'POST';
      const endpoint = record.Id ? 
        `${this.instanceUrl}/services/data/v57.0/sobjects/${objectType}/${record.Id}` :
        `${this.instanceUrl}/services/data/v57.0/sobjects/${objectType}`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Salesforce upsert failed: ${JSON.stringify(errorData)}`);
      }

      if (method === 'POST') {
        const result = await response.json();
        return { ...record, Id: result.id };
      }

      return record;

    } catch (error) {
      logger.error('Failed to upsert Salesforce record', {
        objectType,
        recordId: record.Id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get API limits information
   */
  private async getApiLimits(): Promise<any> {
    try {
      const response = await fetch(
        `${this.instanceUrl}/services/data/v57.0/limits`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();

    } catch (error) {
      logger.error('Failed to get Salesforce API limits', { error: error.message });
      return null;
    }
  }

  /**
   * Process Salesforce record into standardized format
   */
  private processRecord(record: SalesforceRecord, objectType: string): SalesforceRecord {
    // Remove Salesforce-specific attributes for cleaner processing
    const { attributes, ...cleanRecord } = record;
    
    return {
      ...cleanRecord,
      attributes: {
        type: objectType,
        url: attributes?.url || ''
      }
    };
  }

  /**
   * Determine case priority for task creation
   */
  private determineCasePriority(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'urgent';
      case 'medium':
        return 'high';
      case 'low':
      default:
        return 'medium';
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(objectType: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.instanceUrl}/services/data/v57.0/sobjects/${objectType}/describe`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get metadata for ${objectType}: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      logger.error('Failed to get Salesforce object metadata', {
        objectType,
        error: error.message
      });
      return null;
    }
  }
}