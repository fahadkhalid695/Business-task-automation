import { EmailProcessor } from '../administrative-service/EmailProcessor';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';
import { EmailMessage, EmailCategory, Priority } from '../shared/types';
import { EmailProcessingRequest } from '../administrative-service/types/AdministrativeTypes';

// Mock dependencies
jest.mock('../ai-ml-engine/InferenceEngine');
jest.mock('../shared/utils/logger');

describe('EmailProcessor', () => {
  let emailProcessor: EmailProcessor;
  let mockInferenceEngine: jest.Mocked<InferenceEngine>;

  beforeEach(() => {
    jest.clearAllMocks();
    emailProcessor = new EmailProcessor();
    mockInferenceEngine = (emailProcessor as any).inferenceEngine;
  });

  describe('Email Processing', () => {
    it('should process emails with categorization and sentiment analysis', async () => {
      // Arrange
      const mockEmails: EmailMessage[] = [
        {
          id: 'email-1',
          from: 'urgent@example.com',
          to: ['recipient@example.com'],
          subject: 'URGENT: Server Down',
          body: 'The production server is down and needs immediate attention!',
          priority: Priority.MEDIUM,
          category: EmailCategory.WORK,
          actionItems: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const request: EmailProcessingRequest = {
        emails: mockEmails,
        options: {
          categorize: true,
          analyzeSentiment: true,
          extractActionItems: true
        }
      };

      // Mock AI responses
      mockInferenceEngine.generateText
        .mockResolvedValueOnce({ text: 'urgent', usage: { totalTokens: 10 } }) // Categorization
        .mockResolvedValueOnce({ text: 'negative -0.8', usage: { totalTokens: 15 } }) // Sentiment
        .mockResolvedValueOnce({ text: '- Fix server issue | high | immediately | IT team', usage: { totalTokens: 20 } }); // Action items

      // Act
      const result = await emailProcessor.processEmails(request);

      // Assert
      expect(result.processedEmails).toHaveLength(1);
      expect(result.processedEmails[0].category).toBe(EmailCategory.URGENT);
      expect(result.processedEmails[0].priority).toBe(Priority.URGENT);
      expect(result.processedEmails[0].confidence).toBeGreaterThan(0);
      expect(result.actionItems).toHaveLength(1);
      expect(result.actionItems[0].priority).toBe(Priority.HIGH);
      expect(result.summary.totalEmails).toBe(1);
      expect(result.summary.urgentCount).toBe(1);
    });

    it('should handle emails without AI processing when options are disabled', async () => {
      // Arrange
      const mockEmails: EmailMessage[] = [
        {
          id: 'email-1',
          from: 'test@example.com',
          to: ['recipient@example.com'],
          subject: 'Regular Email',
          body: 'This is a regular email',
          priority: Priority.MEDIUM,
          category: EmailCategory.WORK,
          actionItems: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const request: EmailProcessingRequest = {
        emails: mockEmails,
        options: {
          categorize: false,
          analyzeSentiment: false,
          extractActionItems: false
        }
      };

      // Act
      const result = await emailProcessor.processEmails(request);

      // Assert
      expect(result.processedEmails).toHaveLength(1);
      expect(result.processedEmails[0].category).toBe(EmailCategory.WORK); // Original category
      expect(result.actionItems).toHaveLength(0);
      expect(mockInferenceEngine.generateText).not.toHaveBeenCalled();
    });

    it('should handle AI processing failures gracefully', async () => {
      // Arrange
      const mockEmails: EmailMessage[] = [
        {
          id: 'email-1',
          from: 'test@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Email',
          body: 'Test content',
          priority: Priority.MEDIUM,
          category: EmailCategory.WORK,
          actionItems: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const request: EmailProcessingRequest = {
        emails: mockEmails,
        options: {
          categorize: true,
          analyzeSentiment: true
        }
      };

      // Mock AI failure
      mockInferenceEngine.generateText.mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await emailProcessor.processEmails(request);

      // Assert
      expect(result.processedEmails).toHaveLength(1);
      expect(result.processedEmails[0].confidence).toBeLessThan(0.5); // Reduced confidence due to failures
      expect(result.processedEmails[0].processingNotes).toContain('Categorization failed');
      expect(result.processedEmails[0].processingNotes).toContain('Sentiment analysis failed');
    });

    it('should generate suggested responses for appropriate emails', async () => {
      // Arrange
      const mockEmails: EmailMessage[] = [
        {
          id: 'email-1',
          from: 'client@example.com',
          to: ['support@example.com'],
          subject: 'Question about service',
          body: 'I have a question about your service pricing.',
          priority: Priority.MEDIUM,
          category: EmailCategory.WORK,
          actionItems: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const request: EmailProcessingRequest = {
        emails: mockEmails,
        options: {
          autoRespond: true
        }
      };

      // Mock AI responses
      mockInferenceEngine.generateText
        .mockResolvedValueOnce({ text: 'work', usage: { totalTokens: 5 } }) // Categorization
        .mockResolvedValueOnce({ text: 'neutral 0.1', usage: { totalTokens: 10 } }) // Sentiment
        .mockResolvedValueOnce({ text: 'Thank you for your inquiry about our service pricing...', usage: { totalTokens: 50 } }); // Response

      // Act
      const result = await emailProcessor.processEmails(request);

      // Assert
      expect(result.suggestedResponses).toBeDefined();
      expect(result.suggestedResponses).toHaveLength(1);
      expect(result.suggestedResponses![0].subject).toBe('Re: Question about service');
      expect(result.suggestedResponses![0].tone).toBe('professional');
    });

    it('should not generate responses for spam or newsletters', async () => {
      // Arrange
      const mockEmails: EmailMessage[] = [
        {
          id: 'email-1',
          from: 'spam@example.com',
          to: ['victim@example.com'],
          subject: 'You won a million dollars!',
          body: 'Click here to claim your prize!',
          priority: Priority.LOW,
          category: EmailCategory.SPAM,
          actionItems: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const request: EmailProcessingRequest = {
        emails: mockEmails,
        options: {
          autoRespond: true
        }
      };

      // Act
      const result = await emailProcessor.processEmails(request);

      // Assert
      expect(result.suggestedResponses).toBeUndefined();
    });
  });

  describe('Priority Detection', () => {
    it('should detect urgent priority from subject keywords', async () => {
      // Arrange
      const email: EmailMessage = {
        id: 'email-1',
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'URGENT: System failure',
        body: 'System is down',
        priority: Priority.MEDIUM,
        category: EmailCategory.WORK,
        actionItems: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Act
      const priority = (emailProcessor as any).determinePriority(email);

      // Assert
      expect(priority).toBe(Priority.URGENT);
    });

    it('should detect high priority from meeting keywords', async () => {
      // Arrange
      const email: EmailMessage = {
        id: 'email-1',
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Important meeting tomorrow',
        body: 'We have an important meeting scheduled',
        priority: Priority.MEDIUM,
        category: EmailCategory.WORK,
        actionItems: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Act
      const priority = (emailProcessor as any).determinePriority(email);

      // Assert
      expect(priority).toBe(Priority.HIGH);
    });

    it('should detect low priority for newsletters', async () => {
      // Arrange
      const email: EmailMessage = {
        id: 'email-1',
        from: 'newsletter@example.com',
        to: ['subscriber@example.com'],
        subject: 'Weekly Newsletter',
        body: 'Here are this week\'s updates',
        priority: Priority.MEDIUM,
        category: EmailCategory.NEWSLETTER,
        actionItems: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Act
      const priority = (emailProcessor as any).determinePriority(email);

      // Assert
      expect(priority).toBe(Priority.LOW);
    });
  });

  describe('Action Item Extraction', () => {
    it('should extract action items from email content', async () => {
      // Arrange
      const email: EmailMessage = {
        id: 'email-1',
        from: 'manager@example.com',
        to: ['employee@example.com'],
        subject: 'Project tasks',
        body: 'Please complete the following tasks: 1. Review document 2. Submit report by Friday',
        priority: Priority.MEDIUM,
        category: EmailCategory.WORK,
        actionItems: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock AI response
      mockInferenceEngine.generateText.mockResolvedValue({
        text: '- Review document | medium | | employee@example.com\n- Submit report | high | Friday | employee@example.com',
        usage: { totalTokens: 30 }
      });

      // Act
      const actionItems = await (emailProcessor as any).extractActionItems(email);

      // Assert
      expect(actionItems).toHaveLength(2);
      expect(actionItems[0].description).toBe('Review document');
      expect(actionItems[0].priority).toBe(Priority.MEDIUM);
      expect(actionItems[1].description).toBe('Submit report');
      expect(actionItems[1].priority).toBe(Priority.HIGH);
    });

    it('should handle action item extraction failures', async () => {
      // Arrange
      const email: EmailMessage = {
        id: 'email-1',
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Test content',
        priority: Priority.MEDIUM,
        category: EmailCategory.WORK,
        actionItems: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock AI failure
      mockInferenceEngine.generateText.mockRejectedValue(new Error('AI service down'));

      // Act
      const actionItems = await (emailProcessor as any).extractActionItems(email);

      // Assert
      expect(actionItems).toHaveLength(0);
    });
  });

  describe('Integration Configuration', () => {
    it('should configure email integrations', async () => {
      // Arrange
      const integration = {
        service: 'gmail' as const,
        credentials: { apiKey: 'test-key' },
        config: {
          syncInterval: 300,
          autoSync: true,
          filters: [],
          fieldMappings: {}
        }
      };

      // Act
      await emailProcessor.configureIntegration('gmail-1', integration);

      // Assert
      const integrations = (emailProcessor as any).integrations;
      expect(integrations.has('gmail-1')).toBe(true);
      expect(integrations.get('gmail-1')).toEqual(integration);
    });
  });

  describe('Health Status', () => {
    it('should return health status', async () => {
      // Act
      const status = await emailProcessor.getHealthStatus();

      // Assert
      expect(status.status).toBe('healthy');
      expect(status.integrations).toBeDefined();
      expect(status.lastProcessed).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should parse priority strings correctly', () => {
      // Act & Assert
      expect((emailProcessor as any).parsePriority('high')).toBe(Priority.HIGH);
      expect((emailProcessor as any).parsePriority('urgent')).toBe(Priority.HIGH);
      expect((emailProcessor as any).parsePriority('low')).toBe(Priority.LOW);
      expect((emailProcessor as any).parsePriority('medium')).toBe(Priority.MEDIUM);
      expect((emailProcessor as any).parsePriority('invalid')).toBeNull();
      expect((emailProcessor as any).parsePriority('')).toBeNull();
    });

    it('should parse dates correctly', () => {
      // Act & Assert
      expect((emailProcessor as any).parseDate('2024-01-15')).toBeInstanceOf(Date);
      expect((emailProcessor as any).parseDate('invalid-date')).toBeNull();
      expect((emailProcessor as any).parseDate('')).toBeNull();
    });

    it('should determine response generation appropriately', () => {
      // Arrange
      const highConfidenceEmail = {
        category: EmailCategory.WORK,
        priority: Priority.MEDIUM,
        confidence: 0.8
      };

      const lowConfidenceEmail = {
        category: EmailCategory.WORK,
        priority: Priority.MEDIUM,
        confidence: 0.4
      };

      const spamEmail = {
        category: EmailCategory.SPAM,
        priority: Priority.LOW,
        confidence: 0.9
      };

      // Act & Assert
      expect((emailProcessor as any).shouldGenerateResponse(highConfidenceEmail)).toBe(true);
      expect((emailProcessor as any).shouldGenerateResponse(lowConfidenceEmail)).toBe(false);
      expect((emailProcessor as any).shouldGenerateResponse(spamEmail)).toBe(false);
    });
  });
});