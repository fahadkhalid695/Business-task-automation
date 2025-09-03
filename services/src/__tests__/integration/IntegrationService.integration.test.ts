import { IntegrationService } from '../../integration-service/IntegrationService';
import { GmailAdapter } from '../../integration-service/adapters/GmailAdapter';
import { OutlookAdapter } from '../../integration-service/adapters/OutlookAdapter';
import { SlackAdapter } from '../../integration-service/adapters/SlackAdapter';
import { SalesforceAdapter } from '../../integration-service/adapters/SalesforceAdapter';
import { MicrosoftTeamsAdapter } from '../../integration-service/adapters/MicrosoftTeamsAdapter';
import { ExternalService } from '../../shared/types';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('IntegrationService Integration Tests', () => {
  let integrationService: IntegrationService;

  beforeEach(() => {
    integrationService = new IntegrationService();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Gmail Integration', () => {
    const mockCredentials = {
      encrypted: 'mock-encrypted-data',
      algorithm: 'aes-256-gcm',
      iv: 'mock-iv'
    };

    const mockConfig = {
      syncInterval: 300000,
      batchSize: 100
    };

    it('should successfully create Gmail integration', async () => {
      // Mock successful Gmail API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            emailAddress: 'test@gmail.com',
            messagesTotal: 1000
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [
              {
                id: 'msg1',
                threadId: 'thread1'
              }
            ],
            nextPageToken: 'token123'
          })
        } as Response);

      const result = await integrationService.createIntegration('gmail-test', {
        service: ExternalService.GMAIL,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      expect(result.success).toBe(true);
      expect(result.integrationId).toBe('gmail-test');
      expect(result.connectionTest?.success).toBe(true);
    });

    it('should handle Gmail connection failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response);

      const result = await integrationService.createIntegration('gmail-fail', {
        service: ExternalService.GMAIL,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_FAILED');
    });

    it('should sync Gmail data successfully', async () => {
      // First create the integration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      await integrationService.createIntegration('gmail-sync', {
        service: ExternalService.GMAIL,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      // Mock sync response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [
              { id: 'msg1', threadId: 'thread1' },
              { id: 'msg2', threadId: 'thread2' }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'msg1',
            payload: {
              headers: [
                { name: 'From', value: 'sender@example.com' },
                { name: 'Subject', value: 'Test Email' }
              ],
              body: { data: Buffer.from('Test message').toString('base64') }
            },
            internalDate: Date.now().toString()
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'msg2',
            payload: {
              headers: [
                { name: 'From', value: 'sender2@example.com' },
                { name: 'Subject', value: 'Test Email 2' }
              ],
              body: { data: Buffer.from('Test message 2').toString('base64') }
            },
            internalDate: Date.now().toString()
          })
        } as Response);

      const syncResult = await integrationService.syncData({
        integrationId: 'gmail-sync',
        options: { batchSize: 10 }
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.result?.recordsProcessed).toBe(2);
    });
  });

  describe('Outlook Integration', () => {
    const mockCredentials = {
      encrypted: 'mock-encrypted-data',
      algorithm: 'aes-256-gcm',
      iv: 'mock-iv'
    };

    const mockConfig = {
      syncInterval: 300000,
      batchSize: 100
    };

    it('should successfully create Outlook integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userPrincipalName: 'test@outlook.com',
          displayName: 'Test User'
        })
      } as Response);

      const result = await integrationService.createIntegration('outlook-test', {
        service: ExternalService.OUTLOOK,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      expect(result.success).toBe(true);
      expect(result.integrationId).toBe('outlook-test');
    });

    it('should sync Outlook messages', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userPrincipalName: 'test@outlook.com' })
      } as Response);

      await integrationService.createIntegration('outlook-sync', {
        service: ExternalService.OUTLOOK,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      // Mock sync response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'msg1',
              subject: 'Test Subject',
              from: { emailAddress: { address: 'sender@example.com' } },
              receivedDateTime: new Date().toISOString(),
              body: { content: 'Test content', contentType: 'text' }
            }
          ]
        })
      } as Response);

      const syncResult = await integrationService.syncData({
        integrationId: 'outlook-sync'
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.result?.recordsProcessed).toBe(1);
    });
  });

  describe('Slack Integration', () => {
    const mockCredentials = {
      encrypted: 'mock-encrypted-data',
      algorithm: 'aes-256-gcm',
      iv: 'mock-iv'
    };

    const mockConfig = {
      syncInterval: 300000,
      batchSize: 100
    };

    it('should successfully create Slack integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          team: 'Test Team',
          user: 'test-bot'
        })
      } as Response);

      const result = await integrationService.createIntegration('slack-test', {
        service: ExternalService.SLACK,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      expect(result.success).toBe(true);
      expect(result.integrationId).toBe('slack-test');
    });

    it('should sync Slack messages', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, team: 'Test Team' })
      } as Response);

      await integrationService.createIntegration('slack-sync', {
        service: ExternalService.SLACK,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      // Mock channels list and messages
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            channels: [
              { id: 'C123', name: 'general' },
              { id: 'C456', name: 'random' }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            messages: [
              {
                ts: '1234567890.123',
                user: 'U123',
                text: 'Hello world'
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            messages: []
          })
        } as Response);

      const syncResult = await integrationService.syncData({
        integrationId: 'slack-sync'
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.result?.recordsProcessed).toBe(1);
    });
  });

  describe('Salesforce Integration', () => {
    const mockCredentials = {
      encrypted: 'mock-encrypted-data',
      algorithm: 'aes-256-gcm',
      iv: 'mock-iv'
    };

    const mockConfig = {
      syncInterval: 300000,
      batchSize: 100,
      objectsToSync: ['Lead', 'Contact']
    };

    it('should successfully create Salesforce integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user_id: '005xx000001X8Uz',
          organization_id: '00Dxx0000000001'
        })
      } as Response);

      const result = await integrationService.createIntegration('salesforce-test', {
        service: ExternalService.SALESFORCE,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      expect(result.success).toBe(true);
      expect(result.integrationId).toBe('salesforce-test');
    });

    it('should sync Salesforce records', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: '005xx000001X8Uz' })
      } as Response);

      await integrationService.createIntegration('salesforce-sync', {
        service: ExternalService.SALESFORCE,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      // Mock SOQL query responses for Lead and Contact
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            totalSize: 1,
            done: true,
            records: [
              {
                Id: '00Qxx0000004C92',
                CreatedDate: '2023-01-01T00:00:00.000+0000',
                LastModifiedDate: '2023-01-01T00:00:00.000+0000',
                attributes: { type: 'Lead', url: '/services/data/v57.0/sobjects/Lead/00Qxx0000004C92' }
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            totalSize: 1,
            done: true,
            records: [
              {
                Id: '003xx000004TmiQ',
                CreatedDate: '2023-01-02T00:00:00.000+0000',
                LastModifiedDate: '2023-01-03T00:00:00.000+0000',
                attributes: { type: 'Contact', url: '/services/data/v57.0/sobjects/Contact/003xx000004TmiQ' }
              }
            ]
          })
        } as Response);

      const syncResult = await integrationService.syncData({
        integrationId: 'salesforce-sync'
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.result?.recordsProcessed).toBe(2);
      expect(syncResult.result?.recordsCreated).toBe(1);
      expect(syncResult.result?.recordsUpdated).toBe(1);
    });
  });

  describe('Microsoft Teams Integration', () => {
    const mockCredentials = {
      encrypted: 'mock-encrypted-data',
      algorithm: 'aes-256-gcm',
      iv: 'mock-iv'
    };

    const mockConfig = {
      syncInterval: 300000,
      batchSize: 100
    };

    it('should successfully create Microsoft Teams integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userPrincipalName: 'test@teams.com',
          displayName: 'Test User'
        })
      } as Response);

      const result = await integrationService.createIntegration('teams-test', {
        service: 'microsoft_teams' as ExternalService,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      expect(result.success).toBe(true);
      expect(result.integrationId).toBe('teams-test');
    });

    it('should sync Microsoft Teams messages', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userPrincipalName: 'test@teams.com' })
      } as Response);

      await integrationService.createIntegration('teams-sync', {
        service: 'microsoft_teams' as ExternalService,
        credentials: mockCredentials,
        configuration: mockConfig
      });

      // Mock teams, channels, and messages
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { id: 'team1', displayName: 'Test Team' }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { id: 'channel1', displayName: 'General' }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              {
                id: 'msg1',
                createdDateTime: new Date().toISOString(),
                from: {
                  user: {
                    id: 'user1',
                    displayName: 'Test User'
                  }
                },
                body: {
                  content: 'Hello Teams',
                  contentType: 'text'
                }
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: []
          })
        } as Response);

      const syncResult = await integrationService.syncData({
        integrationId: 'teams-sync'
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.result?.recordsProcessed).toBe(1);
    });
  });

  describe('Webhook Processing', () => {
    it('should process Gmail webhook successfully', async () => {
      const webhookPayload = {
        source: ExternalService.GMAIL,
        event: 'message_received',
        data: {
          messageId: 'msg123',
          from: 'sender@example.com',
          subject: 'Test Subject'
        },
        timestamp: new Date()
      };

      const result = await integrationService.processWebhook('gmail-test', webhookPayload);
      expect(result).toBe(true);
    });

    it('should process Slack webhook successfully', async () => {
      const webhookPayload = {
        source: ExternalService.SLACK,
        event: 'message',
        data: {
          ts: '1234567890.123',
          channel: 'C123',
          user: 'U123',
          text: 'Hello @bot'
        },
        timestamp: new Date()
      };

      const result = await integrationService.processWebhook('slack-test', webhookPayload);
      expect(result).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should monitor integration health', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      await integrationService.createIntegration('health-test', {
        service: ExternalService.GMAIL,
        credentials: {
          encrypted: 'mock-encrypted-data',
          algorithm: 'aes-256-gcm',
          iv: 'mock-iv'
        },
        configuration: {}
      });

      // Mock health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      const healthStatus = await integrationService.getHealthStatus('health-test');
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus?.status).toBe('healthy');
    });

    it('should detect unhealthy integration', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      await integrationService.createIntegration('unhealthy-test', {
        service: ExternalService.GMAIL,
        credentials: {
          encrypted: 'mock-encrypted-data',
          algorithm: 'aes-256-gcm',
          iv: 'mock-iv'
        },
        configuration: {}
      });

      // Mock failed health check
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response);

      const healthStatus = await integrationService.getHealthStatus('unhealthy-test');
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus?.status).toBe('unhealthy');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors with retry', async () => {
      const mockCredentials = {
        encrypted: 'mock-encrypted-data',
        algorithm: 'aes-256-gcm',
        iv: 'mock-iv'
      };

      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ emailAddress: 'test@gmail.com' })
        } as Response);

      const result = await integrationService.createIntegration('retry-test', {
        service: ExternalService.GMAIL,
        credentials: mockCredentials,
        configuration: {}
      });

      expect(result.success).toBe(true);
    });

    it('should handle rate limiting', async () => {
      const mockCredentials = {
        encrypted: 'mock-encrypted-data',
        algorithm: 'aes-256-gcm',
        iv: 'mock-iv'
      };

      // First call rate limited, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ emailAddress: 'test@gmail.com' })
        } as Response);

      const result = await integrationService.createIntegration('rate-limit-test', {
        service: ExternalService.GMAIL,
        credentials: mockCredentials,
        configuration: {}
      });

      expect(result.success).toBe(true);
    });

    it('should handle circuit breaker', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      await integrationService.createIntegration('circuit-test', {
        service: ExternalService.GMAIL,
        credentials: {
          encrypted: 'mock-encrypted-data',
          algorithm: 'aes-256-gcm',
          iv: 'mock-iv'
        },
        configuration: {}
      });

      // Simulate multiple failures to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error'
        } as Response);

        await integrationService.syncData({
          integrationId: 'circuit-test'
        });
      }

      // Next call should fail due to circuit breaker
      const result = await integrationService.syncData({
        integrationId: 'circuit-test'
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Circuit breaker is open');
    });
  });

  describe('Integration Metrics', () => {
    it('should track integration metrics', async () => {
      // Create integration first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      await integrationService.createIntegration('metrics-test', {
        service: ExternalService.GMAIL,
        credentials: {
          encrypted: 'mock-encrypted-data',
          algorithm: 'aes-256-gcm',
          iv: 'mock-iv'
        },
        configuration: {}
      });

      // Perform successful sync
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'msg1', threadId: 'thread1' }]
        })
      } as Response);

      await integrationService.syncData({
        integrationId: 'metrics-test'
      });

      const metrics = integrationService.getMetrics('metrics-test');
      
      expect(metrics).toBeDefined();
      expect(metrics?.totalRequests).toBeGreaterThan(0);
      expect(metrics?.successfulRequests).toBeGreaterThan(0);
      expect(metrics?.errorRate).toBeLessThan(100);
    });
  });
});