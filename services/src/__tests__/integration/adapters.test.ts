import { GmailAdapter } from '../../integration-service/adapters/GmailAdapter';
import { OutlookAdapter } from '../../integration-service/adapters/OutlookAdapter';
import { SlackAdapter } from '../../integration-service/adapters/SlackAdapter';
import { SalesforceAdapter } from '../../integration-service/adapters/SalesforceAdapter';
import { MicrosoftTeamsAdapter } from '../../integration-service/adapters/MicrosoftTeamsAdapter';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Integration Adapters Unit Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GmailAdapter', () => {
    let adapter: GmailAdapter;

    beforeEach(() => {
      adapter = new GmailAdapter();
    });

    it('should connect successfully with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          emailAddress: 'test@gmail.com',
          messagesTotal: 1000
        })
      } as Response);

      const result = await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        { syncInterval: 300000 }
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer undefined'
          })
        })
      );
    });

    it('should fail connection with invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response);

      const result = await adapter.connect(
        { encrypted: 'invalid', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      expect(result).toBe(false);
    });

    it('should test connection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          emailAddress: 'test@gmail.com'
        })
      } as Response);

      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should sync messages successfully', async () => {
      // First connect
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: 'test@gmail.com' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      // Mock messages list
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [
              { id: 'msg1', threadId: 'thread1' },
              { id: 'msg2', threadId: 'thread2' }
            ],
            nextPageToken: 'token123'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'msg1',
            threadId: 'thread1',
            payload: {
              headers: [
                { name: 'From', value: 'sender@example.com' },
                { name: 'Subject', value: 'Test Subject' },
                { name: 'To', value: 'recipient@example.com' }
              ],
              body: {
                data: Buffer.from('Test message content').toString('base64')
              }
            },
            labelIds: ['INBOX', 'UNREAD'],
            internalDate: Date.now().toString()
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'msg2',
            threadId: 'thread2',
            payload: {
              headers: [
                { name: 'From', value: 'sender2@example.com' },
                { name: 'Subject', value: 'Test Subject 2' },
                { name: 'To', value: 'recipient@example.com' }
              ],
              body: {
                data: Buffer.from('Test message content 2').toString('base64')
              }
            },
            labelIds: ['INBOX'],
            internalDate: Date.now().toString()
          })
        } as Response);

      const result = await adapter.syncData({ batchSize: 10 });

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);
      expect(result.recordsCreated).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle webhook processing', async () => {
      const webhookPayload = {
        source: 'gmail' as any,
        event: 'message_received',
        data: {
          messageId: 'msg123',
          from: 'sender@example.com',
          subject: 'Test Subject'
        },
        timestamp: new Date()
      };

      // Mock message fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg123',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'Subject', value: 'Test Subject' }
            ],
            body: { data: Buffer.from('Test content').toString('base64') }
          },
          internalDate: Date.now().toString()
        })
      } as Response);

      const result = await adapter.handleWebhook(webhookPayload);

      expect(result.processed).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('create_task');
    });
  });

  describe('OutlookAdapter', () => {
    let adapter: OutlookAdapter;

    beforeEach(() => {
      adapter = new OutlookAdapter();
    });

    it('should connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userPrincipalName: 'test@outlook.com',
          displayName: 'Test User'
        })
      } as Response);

      const result = await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      expect(result).toBe(true);
    });

    it('should sync Outlook messages', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userPrincipalName: 'test@outlook.com' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      // Mock messages response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'msg1',
              conversationId: 'conv1',
              subject: 'Test Subject',
              from: {
                emailAddress: {
                  name: 'Sender Name',
                  address: 'sender@example.com'
                }
              },
              toRecipients: [
                {
                  emailAddress: {
                    name: 'Recipient Name',
                    address: 'recipient@example.com'
                  }
                }
              ],
              body: {
                contentType: 'text',
                content: 'Test message content'
              },
              receivedDateTime: new Date().toISOString(),
              isRead: false,
              importance: 'normal',
              attachments: []
            }
          ]
        })
      } as Response);

      const result = await adapter.syncData();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
    });
  });

  describe('SlackAdapter', () => {
    let adapter: SlackAdapter;

    beforeEach(() => {
      adapter = new SlackAdapter();
    });

    it('should connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          team: 'Test Team',
          user: 'test-bot'
        })
      } as Response);

      const result = await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      expect(result).toBe(true);
    });

    it('should sync Slack messages', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, team: 'Test Team' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      // Mock channels and messages
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            channels: [
              { id: 'C123', name: 'general' }
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
                text: 'Hello world',
                type: 'message'
              }
            ]
          })
        } as Response);

      const result = await adapter.syncData();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
    });

    it('should send message successfully', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, team: 'Test Team' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      // Mock send message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123',
          channel: 'C123'
        })
      } as Response);

      const result = await adapter.sendMessage('C123', 'Hello from bot');

      expect(result).toBe(true);
    });
  });

  describe('SalesforceAdapter', () => {
    let adapter: SalesforceAdapter;

    beforeEach(() => {
      adapter = new SalesforceAdapter();
    });

    it('should connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user_id: '005xx000001X8Uz',
          organization_id: '00Dxx0000000001'
        })
      } as Response);

      const result = await adapter.connect(
        { 
          encrypted: 'test', 
          algorithm: 'aes-256-gcm', 
          iv: 'test',
          instanceUrl: 'https://test.salesforce.com'
        },
        { objectsToSync: ['Lead', 'Contact'] }
      );

      expect(result).toBe(true);
    });

    it('should execute SOQL query', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: '005xx000001X8Uz' })
      } as Response);

      await adapter.connect(
        { 
          encrypted: 'test', 
          algorithm: 'aes-256-gcm', 
          iv: 'test',
          instanceUrl: 'https://test.salesforce.com'
        },
        {}
      );

      // Mock SOQL query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalSize: 1,
          done: true,
          records: [
            {
              Id: '00Qxx0000004C92',
              Name: 'Test Lead',
              Email: 'test@example.com',
              attributes: {
                type: 'Lead',
                url: '/services/data/v57.0/sobjects/Lead/00Qxx0000004C92'
              }
            }
          ]
        })
      } as Response);

      const result = await adapter.executeQuery({
        soql: 'SELECT Id, Name, Email FROM Lead LIMIT 1'
      });

      expect(result.totalSize).toBe(1);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].Id).toBe('00Qxx0000004C92');
    });

    it('should upsert record successfully', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: '005xx000001X8Uz' })
      } as Response);

      await adapter.connect(
        { 
          encrypted: 'test', 
          algorithm: 'aes-256-gcm', 
          iv: 'test',
          instanceUrl: 'https://test.salesforce.com'
        },
        {}
      );

      // Mock create record
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '00Qxx0000004C92',
          success: true
        })
      } as Response);

      const result = await adapter.upsertRecord('Lead', {
        Name: 'Test Lead',
        Email: 'test@example.com',
        Company: 'Test Company'
      });

      expect(result.Id).toBe('00Qxx0000004C92');
    });
  });

  describe('MicrosoftTeamsAdapter', () => {
    let adapter: MicrosoftTeamsAdapter;

    beforeEach(() => {
      adapter = new MicrosoftTeamsAdapter();
    });

    it('should connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userPrincipalName: 'test@teams.com',
          displayName: 'Test User'
        })
      } as Response);

      const result = await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      expect(result).toBe(true);
    });

    it('should sync Teams messages', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userPrincipalName: 'test@teams.com' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

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
                    displayName: 'Test User',
                    userPrincipalName: 'test@teams.com'
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

      const result = await adapter.syncData();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
    });

    it('should send message successfully', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userPrincipalName: 'test@teams.com' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      // Mock send message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg123',
          createdDateTime: new Date().toISOString()
        })
      } as Response);

      const result = await adapter.sendMessage(
        'chat123',
        'Hello from bot'
      );

      expect(result).toBe(true);
    });

    it('should get team info successfully', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userPrincipalName: 'test@teams.com' })
      } as Response);

      await adapter.connect(
        { encrypted: 'test', algorithm: 'aes-256-gcm', iv: 'test' },
        {}
      );

      // Mock team info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'team1',
          displayName: 'Test Team',
          description: 'A test team'
        })
      } as Response);

      const result = await adapter.getTeamInfo('team1');

      expect(result).toBeDefined();
      expect(result.id).toBe('team1');
      expect(result.displayName).toBe('Test Team');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const adapter = new GmailAdapter();
      
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle API rate limits', async () => {
      const adapter = new SlackAdapter();
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          ok: false,
          error: 'rate_limited'
        })
      } as Response);

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate_limited');
    });

    it('should handle authentication failures', async () => {
      const adapter = new SalesforceAdapter();
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid session ID'
      } as Response);

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid session ID');
    });
  });
});