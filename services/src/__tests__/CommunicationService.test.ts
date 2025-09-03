import { CommunicationService } from '../communication-service/CommunicationService';
import { ChatbotEngine } from '../communication-service/ChatbotEngine';
import { TranscriptionService } from '../communication-service/TranscriptionService';
import { TranslationService } from '../communication-service/TranslationService';
import { NotificationService } from '../communication-service/NotificationService';
import { NLPUtils } from '../communication-service/NLPUtils';
import { Task, TaskStatus, Priority } from '../shared/types';
import { ConversationStatus, NotificationChannelType } from '../communication-service/types';

// Mock all dependencies
jest.mock('../communication-service/ChatbotEngine');
jest.mock('../communication-service/TranscriptionService');
jest.mock('../communication-service/TranslationService');
jest.mock('../communication-service/NotificationService');
jest.mock('../communication-service/NLPUtils');

describe('CommunicationService', () => {
  let communicationService: CommunicationService;
  let mockChatbotEngine: jest.Mocked<ChatbotEngine>;
  let mockTranscriptionService: jest.Mocked<TranscriptionService>;
  let mockTranslationService: jest.Mocked<TranslationService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockNLPUtils: jest.Mocked<NLPUtils>;

  const mockConfig = {
    openai: {
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 500
    },
    googleCloud: {
      projectId: 'test-project',
      keyFilename: 'test-key.json'
    },
    notifications: {
      email: {
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: { user: 'test@test.com', pass: 'password' }
        }
      },
      slack: {
        botToken: 'test-bot-token',
        signingSecret: 'test-signing-secret'
      },
      sms: {
        provider: 'twilio',
        apiKey: 'test-api-key',
        from: '+1234567890'
      }
    }
  };

  beforeEach(() => {
    // Create mocked instances
    mockChatbotEngine = {
      generateResponse: jest.fn(),
      handleFAQ: jest.fn(),
      extractIntent: jest.fn(),
      extractEntities: jest.fn()
    } as any;

    mockTranscriptionService = {
      transcribe: jest.fn(),
      transcribeStream: jest.fn()
    } as any;

    mockTranslationService = {
      translate: jest.fn(),
      translateBatch: jest.fn(),
      getSupportedLanguages: jest.fn(),
      detectLanguage: jest.fn()
    } as any;

    mockNotificationService = {
      send: jest.fn(),
      sendEmail: jest.fn(),
      sendSlack: jest.fn(),
      sendSMS: jest.fn(),
      sendWebhook: jest.fn(),
      scheduleNotification: jest.fn()
    } as any;

    mockNLPUtils = {
      analyzeText: jest.fn(),
      analyzeSentiment: jest.fn(),
      extractEntities: jest.fn(),
      extractKeywords: jest.fn(),
      extractTopics: jest.fn(),
      detectLanguage: jest.fn(),
      calculateReadabilityScore: jest.fn(),
      generateSummary: jest.fn(),
      extractActionItems: jest.fn()
    } as any;

    // Mock constructors
    (ChatbotEngine as jest.MockedClass<typeof ChatbotEngine>).mockImplementation(() => mockChatbotEngine);
    (TranscriptionService as jest.MockedClass<typeof TranscriptionService>).mockImplementation(() => mockTranscriptionService);
    (TranslationService as jest.MockedClass<typeof TranslationService>).mockImplementation(() => mockTranslationService);
    (NotificationService as jest.MockedClass<typeof NotificationService>).mockImplementation(() => mockNotificationService);
    (NLPUtils as jest.MockedClass<typeof NLPUtils>).mockImplementation(() => mockNLPUtils);

    communicationService = new CommunicationService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processCustomerInquiry', () => {
    const mockCustomerInfo = {
      id: 'customer-123',
      name: 'John Doe',
      email: 'john@example.com',
      tier: 'premium' as const
    };

    it('should process customer inquiry and route appropriately', async () => {
      const message = 'I need help with my account';
      
      mockNLPUtils.analyzeText.mockResolvedValue({
        sentiment: { score: 0.1, confidence: 0.8, label: 'neutral', emotions: [] },
        entities: [{ type: 'intent', value: 'account_help', confidence: 0.9, start: 0, end: 10 }],
        keywords: [{ text: 'account', relevance: 0.9, count: 1 }],
        topics: [{ name: 'Account Management', confidence: 0.8, keywords: ['account'] }],
        language: 'en',
        readabilityScore: 75
      });

      mockChatbotEngine.generateResponse.mockResolvedValue('I can help you with your account. What specific issue are you experiencing?');

      const result = await communicationService.processCustomerInquiry(message, mockCustomerInfo);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('conversation');
      expect(result).toHaveProperty('routingDecision');
      
      expect(result.response).toBe('I can help you with your account. What specific issue are you experiencing?');
      expect(result.conversation.userId).toBe(mockCustomerInfo.id);
      expect(result.conversation.status).toBe(ConversationStatus.ACTIVE);
      expect(result.conversation.messages).toHaveLength(2); // User message + bot response
      
      expect(result.routingDecision.department).toBe('general');
      expect(result.routingDecision.priority).toBe(Priority.HIGH); // Premium customer
      expect(result.routingDecision.requiresHuman).toBe(false);

      expect(mockNLPUtils.analyzeText).toHaveBeenCalledWith(message);
      expect(mockChatbotEngine.generateResponse).toHaveBeenCalled();
    });

    it('should escalate urgent inquiries to human agents', async () => {
      const urgentMessage = 'URGENT: My system is down and I need immediate help!';
      
      mockNLPUtils.analyzeText.mockResolvedValue({
        sentiment: { score: -0.6, confidence: 0.9, label: 'negative', emotions: [] },
        entities: [],
        keywords: [{ text: 'urgent', relevance: 0.95, count: 1 }],
        topics: [{ name: 'Technical Issues', confidence: 0.9, keywords: ['system', 'down'] }],
        language: 'en',
        readabilityScore: 60
      });

      mockChatbotEngine.generateResponse.mockResolvedValue('I understand this is urgent. Let me connect you with a human agent immediately.');
      
      mockNotificationService.send.mockResolvedValue({
        success: true,
        results: { email: true, slack: true },
        errors: []
      });

      const result = await communicationService.processCustomerInquiry(urgentMessage, mockCustomerInfo);

      expect(result.routingDecision.priority).toBe(Priority.URGENT);
      expect(result.routingDecision.requiresHuman).toBe(true);
      expect(result.conversation.status).toBe(ConversationStatus.ESCALATED);
      expect(mockNotificationService.send).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const message = 'Test message';
      
      mockNLPUtils.analyzeText.mockRejectedValue(new Error('NLP service error'));

      await expect(communicationService.processCustomerInquiry(message, mockCustomerInfo))
        .rejects.toThrow('NLP service error');
    });
  });

  describe('handleFAQQuery', () => {
    it('should handle FAQ queries successfully', async () => {
      const query = 'How do I reset my password?';
      const expectedResponse = {
        answer: 'To reset your password, go to the login page and click "Forgot Password".',
        confidence: 0.95,
        relatedQuestions: ['How do I change my password?', 'What if I forgot my username?']
      };

      mockChatbotEngine.handleFAQ.mockResolvedValue(expectedResponse);

      const result = await communicationService.handleFAQQuery(query);

      expect(result).toEqual(expectedResponse);
      expect(mockChatbotEngine.handleFAQ).toHaveBeenCalledWith(query);
    });

    it('should handle FAQ service errors', async () => {
      const query = 'Test query';
      
      mockChatbotEngine.handleFAQ.mockRejectedValue(new Error('FAQ service error'));

      await expect(communicationService.handleFAQQuery(query))
        .rejects.toThrow('FAQ service error');
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio with action item extraction', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const options = {
        language: 'en-US',
        enableSpeakerDiarization: true,
        enableWordTimestamps: true
      };

      const mockTranscriptionResult = {
        id: 'transcription-123',
        text: 'John will prepare the report by Friday. We need to schedule a follow-up meeting.',
        confidence: 0.95,
        language: 'en-US',
        speakers: [
          {
            speaker: 'Speaker 1',
            startTime: 0,
            endTime: 5,
            text: 'John will prepare the report by Friday.',
            confidence: 0.9
          }
        ],
        duration: 10,
        timestamps: [],
        metadata: {
          audioFormat: 'wav',
          sampleRate: 16000,
          channels: 1,
          processingTime: 1500,
          model: 'google-speech-latest_long'
        }
      };

      mockTranscriptionService.transcribe.mockResolvedValue(mockTranscriptionResult);
      
      mockNLPUtils.analyzeText.mockResolvedValue({
        sentiment: { score: 0.1, confidence: 0.8, label: 'neutral', emotions: [] },
        entities: [],
        keywords: [],
        topics: [{ name: 'Meeting Planning', confidence: 0.8, keywords: ['meeting', 'schedule'] }],
        language: 'en',
        readabilityScore: 70
      });

      mockNLPUtils.extractActionItems.mockResolvedValue([
        'John will prepare the report by Friday',
        'Schedule follow-up meeting'
      ]);

      const result = await communicationService.transcribeAudio(audioBuffer, options);

      expect(result.text).toBe(mockTranscriptionResult.text);
      expect(result.metadata.actionItems).toHaveLength(2);
      expect(result.metadata.actionItems[0]).toBe('John will prepare the report by Friday');
      
      expect(mockTranscriptionService.transcribe).toHaveBeenCalledWith(audioBuffer, options);
      expect(mockNLPUtils.analyzeText).toHaveBeenCalledWith(mockTranscriptionResult.text);
      expect(mockNLPUtils.extractActionItems).toHaveBeenCalledWith(mockTranscriptionResult.text);
    });

    it('should handle transcription errors', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      
      mockTranscriptionService.transcribe.mockRejectedValue(new Error('Transcription failed'));

      await expect(communicationService.transcribeAudio(audioBuffer))
        .rejects.toThrow('Transcription failed');
    });
  });

  describe('translateText', () => {
    it('should translate text successfully', async () => {
      const text = 'Hello, how are you?';
      const targetLanguage = 'es';
      const options = {
        sourceLanguage: 'en',
        context: 'casual conversation',
        formality: 'informal' as const
      };

      const mockTranslationResult = {
        id: 'translation-123',
        originalText: text,
        translatedText: 'Hola, ¿cómo estás?',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.95,
        context: {
          formality: 'informal',
          audience: 'casual conversation'
        },
        alternatives: ['Hola, ¿qué tal?'],
        metadata: {
          model: 'google-translate-v2',
          processingTime: 500,
          characterCount: text.length
        }
      };

      mockTranslationService.translate.mockResolvedValue(mockTranslationResult);

      const result = await communicationService.translateText(text, targetLanguage, options);

      expect(result).toEqual(mockTranslationResult);
      expect(mockTranslationService.translate).toHaveBeenCalledWith(text, targetLanguage, options);
    });

    it('should handle translation errors', async () => {
      const text = 'Test text';
      const targetLanguage = 'es';
      
      mockTranslationService.translate.mockRejectedValue(new Error('Translation failed'));

      await expect(communicationService.translateText(text, targetLanguage))
        .rejects.toThrow('Translation failed');
    });
  });

  describe('sendNotification', () => {
    it('should send notifications through multiple channels', async () => {
      const notification = {
        id: 'notification-123',
        title: 'Test Notification',
        content: 'This is a test notification',
        priority: 'medium' as const,
        channels: [NotificationChannelType.EMAIL, NotificationChannelType.SLACK],
        recipients: [
          { type: 'user' as const, identifier: 'user@example.com' }
        ],
        status: 'pending' as const
      };

      const mockResult = {
        success: true,
        results: { email: true, slack: true },
        errors: []
      };

      mockNotificationService.send.mockResolvedValue(mockResult);

      const result = await communicationService.sendNotification(notification);

      expect(result).toEqual(mockResult);
      expect(mockNotificationService.send).toHaveBeenCalledWith(notification);
    });

    it('should handle notification errors', async () => {
      const notification = {
        id: 'notification-123',
        title: 'Test Notification',
        content: 'This is a test notification',
        priority: 'medium' as const,
        channels: [NotificationChannelType.EMAIL],
        recipients: [
          { type: 'user' as const, identifier: 'user@example.com' }
        ],
        status: 'pending' as const
      };

      mockNotificationService.send.mockRejectedValue(new Error('Notification failed'));

      await expect(communicationService.sendNotification(notification))
        .rejects.toThrow('Notification failed');
    });
  });

  describe('analyzeContent', () => {
    it('should analyze content using NLP utils', async () => {
      const text = 'This is a sample text for analysis';
      const mockAnalysisResult = {
        sentiment: { score: 0.2, confidence: 0.8, label: 'positive' as const, emotions: [] },
        entities: [],
        keywords: [{ text: 'analysis', relevance: 0.8, count: 1 }],
        topics: [{ name: 'Content Analysis', confidence: 0.7, keywords: ['analysis'] }],
        language: 'en',
        readabilityScore: 75
      };

      mockNLPUtils.analyzeText.mockResolvedValue(mockAnalysisResult);

      const result = await communicationService.analyzeContent(text);

      expect(result).toEqual(mockAnalysisResult);
      expect(mockNLPUtils.analyzeText).toHaveBeenCalledWith(text);
    });
  });

  describe('processTask', () => {
    it('should process customer inquiry task', async () => {
      const task: Task = {
        id: 'task-123',
        type: 'customer_inquiry',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        assignedTo: 'communication-service',
        createdBy: 'system',
        data: {
          input: {
            message: 'I need help',
            customerInfo: {
              id: 'customer-123',
              name: 'John Doe',
              email: 'john@example.com',
              tier: 'basic' as const
            }
          }
        },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock the processCustomerInquiry method
      const mockInquiryResult = {
        response: 'How can I help you?',
        conversation: {
          id: 'conv-123',
          userId: 'customer-123',
          title: 'Customer Inquiry',
          status: ConversationStatus.ACTIVE,
          messages: [],
          context: {
            department: 'general',
            priority: Priority.MEDIUM,
            tags: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        routingDecision: {
          department: 'general',
          priority: Priority.MEDIUM,
          requiresHuman: false
        }
      };

      // Mock dependencies
      mockNLPUtils.analyzeText.mockResolvedValue({
        sentiment: { score: 0, confidence: 0.8, label: 'neutral', emotions: [] },
        entities: [],
        keywords: [],
        topics: [],
        language: 'en',
        readabilityScore: 70
      });

      mockChatbotEngine.generateResponse.mockResolvedValue('How can I help you?');

      const result = await communicationService.processTask(task);

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data.output).toHaveProperty('response');
      expect(result.data.output).toHaveProperty('conversation');
      expect(result.data.output).toHaveProperty('routingDecision');
      expect(result.completedAt).toBeDefined();
    });

    it('should process transcription task', async () => {
      const task: Task = {
        id: 'task-123',
        type: 'transcription',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        assignedTo: 'communication-service',
        createdBy: 'system',
        data: {
          input: {
            audioBuffer: Buffer.from('mock audio'),
            options: { language: 'en-US' }
          }
        },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTranscriptionResult = {
        id: 'transcription-123',
        text: 'Transcribed text',
        confidence: 0.95,
        language: 'en-US',
        duration: 10,
        timestamps: [],
        metadata: {
          audioFormat: 'wav',
          sampleRate: 16000,
          channels: 1,
          processingTime: 1000,
          model: 'google-speech'
        }
      };

      mockTranscriptionService.transcribe.mockResolvedValue(mockTranscriptionResult);
      mockNLPUtils.analyzeText.mockResolvedValue({
        sentiment: { score: 0, confidence: 0.8, label: 'neutral', emotions: [] },
        entities: [],
        keywords: [],
        topics: [],
        language: 'en',
        readabilityScore: 70
      });
      mockNLPUtils.extractActionItems.mockResolvedValue([]);

      const result = await communicationService.processTask(task);

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data.output.text).toBe('Transcribed text');
    });

    it('should handle unsupported task types', async () => {
      const task: Task = {
        id: 'task-123',
        type: 'unsupported_type',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        assignedTo: 'communication-service',
        createdBy: 'system',
        data: { input: {} },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(communicationService.processTask(task))
        .rejects.toThrow('Unsupported task type: unsupported_type');
    });

    it('should handle task processing errors', async () => {
      const task: Task = {
        id: 'task-123',
        type: 'customer_inquiry',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        assignedTo: 'communication-service',
        createdBy: 'system',
        data: {
          input: {
            message: 'Test message',
            customerInfo: {
              id: 'customer-123',
              name: 'John Doe',
              email: 'john@example.com',
              tier: 'basic' as const
            }
          }
        },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockNLPUtils.analyzeText.mockRejectedValue(new Error('Processing failed'));

      await expect(communicationService.processTask(task))
        .rejects.toThrow('Processing failed');

      expect(task.status).toBe(TaskStatus.FAILED);
      expect(task.data.output.error).toBe('Processing failed');
    });
  });
});