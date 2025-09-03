import { ChatbotEngine } from '../communication-service/ChatbotEngine';
import OpenAI from 'openai';
import { ConversationContext, NLPAnalysisResult } from '../communication-service/types';
import { Priority } from '../shared/types';

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('ChatbotEngine', () => {
  let chatbotEngine: ChatbotEngine;
  let mockOpenAI: jest.Mocked<OpenAI>;

  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'gpt-3.5-turbo',
    maxTokens: 500
  };

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as any;

    MockedOpenAI.mockImplementation(() => mockOpenAI);

    chatbotEngine = new ChatbotEngine(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    const mockContext: ConversationContext = {
      department: 'technical',
      priority: Priority.MEDIUM,
      tags: [],
      customerInfo: {
        id: 'customer-123',
        name: 'John Doe',
        email: 'john@example.com',
        tier: 'premium'
      },
      previousInteractions: []
    };

    const mockNLPAnalysis: NLPAnalysisResult = {
      sentiment: { score: 0.1, confidence: 0.8, label: 'neutral', emotions: [] },
      entities: [],
      keywords: [{ text: 'help', relevance: 0.8, count: 1 }],
      topics: [{ name: 'Customer Support', confidence: 0.9, keywords: ['help', 'support'] }],
      language: 'en',
      readabilityScore: 75
    };

    it('should generate contextual response for customer inquiry', async () => {
      const message = 'I need help with my account';
      const expectedResponse = 'I can help you with your account. What specific issue are you experiencing?';

      // Mock FAQ check (low confidence)
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                answer: 'Generic FAQ answer',
                confidence: 0.5,
                relatedQuestions: []
              })
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: expectedResponse
            }
          }]
        } as any);

      const result = await chatbotEngine.generateResponse(message, mockContext, mockNLPAnalysis);

      expect(result).toBe(expectedResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should return FAQ answer for high confidence matches', async () => {
      const message = 'How do I reset my password?';
      const faqAnswer = 'To reset your password, go to the login page and click "Forgot Password".';

      // Mock high confidence FAQ response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              answer: faqAnswer,
              confidence: 0.9,
              relatedQuestions: ['How do I change my password?']
            })
          }
        }]
      } as any);

      const result = await chatbotEngine.generateResponse(message, mockContext, mockNLPAnalysis);

      expect(result).toBe(faqAnswer);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const message = 'Test message';

      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await chatbotEngine.generateResponse(message, mockContext, mockNLPAnalysis);

      expect(result).toContain('experiencing technical difficulties');
    });

    it('should build appropriate system prompt based on context', async () => {
      const message = 'I need help';
      
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify({ answer: 'test', confidence: 0.5, relatedQuestions: [] }) } }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Test response' } }]
        } as any);

      await chatbotEngine.generateResponse(message, mockContext, mockNLPAnalysis);

      const systemPromptCall = mockOpenAI.chat.completions.create.mock.calls[1][0];
      const systemMessage = systemPromptCall.messages[0];

      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('Customer tier: premium');
      expect(systemMessage.content).toContain('Department: technical');
      expect(systemMessage.content).toContain('Priority: medium');
    });

    it('should maintain conversation memory', async () => {
      const message1 = 'Hello, I need help';
      const message2 = 'Can you help me with billing?';

      mockOpenAI.chat.completions.create
        .mockResolvedValue({
          choices: [{ message: { content: 'I can help you with that.' } }]
        } as any);

      // First interaction
      await chatbotEngine.generateResponse(message1, mockContext, mockNLPAnalysis);
      
      // Second interaction - should include conversation history
      await chatbotEngine.generateResponse(message2, mockContext, mockNLPAnalysis);

      const secondCall = mockOpenAI.chat.completions.create.mock.calls[3][0];
      const userPrompt = secondCall.messages[1].content;

      expect(userPrompt).toContain('Recent conversation history');
      expect(userPrompt).toContain(message1);
    });
  });

  describe('handleFAQ', () => {
    it('should find high confidence FAQ matches', async () => {
      const query = 'How do I reset my password?';

      const result = await chatbotEngine.handleFAQ(query);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.answer).toContain('reset your password');
      expect(result.answer).toContain('step-by-step');
      expect(result.relatedQuestions).toBeInstanceOf(Array);
    });

    it('should handle queries with no good matches', async () => {
      const query = 'What is the meaning of life?';

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I can help you with business automation questions. For philosophical questions, you might want to consult other resources.'
          }
        }]
      } as any);

      const result = await chatbotEngine.handleFAQ(query);

      expect(result.confidence).toBeLessThan(0.8);
      expect(result.answer).toContain('business automation');
      expect(result.relatedQuestions).toHaveLength(3); // Popular questions
    });

    it('should return popular questions when FAQ generation fails', async () => {
      const query = 'Test query';

      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await chatbotEngine.handleFAQ(query);

      expect(result.confidence).toBe(0.1);
      expect(result.answer).toContain('support team');
      expect(result.relatedQuestions).toHaveLength(3);
    });

    it('should update FAQ usage counts for matched items', async () => {
      const query = 'reset password';

      const initialResult = await chatbotEngine.handleFAQ(query);
      const secondResult = await chatbotEngine.handleFAQ(query);

      // Both should return the same FAQ item, but usage count should increase
      expect(initialResult.answer).toBe(secondResult.answer);
      expect(initialResult.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('extractIntent', () => {
    it('should extract intent from user message', async () => {
      const message = 'I want to cancel my subscription';
      const expectedIntent = {
        name: 'cancel_subscription',
        confidence: 0.95,
        parameters: { subscription_type: 'premium' }
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(expectedIntent)
          }
        }]
      } as any);

      const result = await chatbotEngine.extractIntent(message);

      expect(result).toEqual(expectedIntent);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('intent classifier')
            }),
            expect.objectContaining({
              role: 'user',
              content: message
            })
          ])
        })
      );
    });

    it('should handle invalid JSON responses', async () => {
      const message = 'Test message';

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      } as any);

      const result = await chatbotEngine.extractIntent(message);

      expect(result.name).toBe('general_inquiry');
      expect(result.confidence).toBe(0.5);
    });

    it('should handle API errors', async () => {
      const message = 'Test message';

      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await chatbotEngine.extractIntent(message);

      expect(result.name).toBe('error');
      expect(result.confidence).toBe(0.1);
    });
  });

  describe('extractEntities', () => {
    it('should extract named entities from message', async () => {
      const message = 'My name is John Smith and I work at Microsoft';
      const expectedEntities = [
        { type: 'PERSON', value: 'John Smith', confidence: 0.95, start: 11, end: 21 },
        { type: 'ORGANIZATION', value: 'Microsoft', confidence: 0.9, start: 37, end: 46 }
      ];

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(expectedEntities)
          }
        }]
      } as any);

      const result = await chatbotEngine.extractEntities(message);

      expect(result).toEqual(expectedEntities);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('PERSON');
      expect(result[1].type).toBe('ORGANIZATION');
    });

    it('should handle invalid JSON responses', async () => {
      const message = 'Test message';

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Invalid JSON'
          }
        }]
      } as any);

      const result = await chatbotEngine.extractEntities(message);

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const message = 'Test message';

      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await chatbotEngine.extractEntities(message);

      expect(result).toEqual([]);
    });
  });

  describe('FAQ Database', () => {
    it('should initialize with common business FAQ items', async () => {
      const passwordQuery = 'forgot password';
      const workflowQuery = 'create workflow';
      const integrationQuery = 'supported integrations';

      const passwordResult = await chatbotEngine.handleFAQ(passwordQuery);
      const workflowResult = await chatbotEngine.handleFAQ(workflowQuery);
      const integrationResult = await chatbotEngine.handleFAQ(integrationQuery);

      expect(passwordResult.confidence).toBeGreaterThan(0.6);
      expect(workflowResult.confidence).toBeGreaterThan(0.6);
      expect(integrationResult.confidence).toBeGreaterThan(0.6);

      expect(passwordResult.answer).toContain('password');
      expect(workflowResult.answer).toContain('workflow');
      expect(integrationResult.answer).toContain('integration');
    });

    it('should provide step-by-step guidance in FAQ answers', async () => {
      const query = 'how to reset password';

      const result = await chatbotEngine.handleFAQ(query);

      expect(result.answer).toContain('step-by-step');
      expect(result.answer).toMatch(/\d+\./); // Should contain numbered steps
    });
  });

  describe('Conversation Memory', () => {
    it('should limit conversation history to prevent memory overflow', async () => {
      const context: ConversationContext = {
        department: 'general',
        priority: Priority.MEDIUM,
        tags: [],
        customerInfo: {
          id: 'customer-123',
          name: 'John Doe',
          email: 'john@example.com',
          tier: 'basic'
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }]
      } as any);

      // Simulate many interactions to test memory limit
      for (let i = 0; i < 15; i++) {
        await chatbotEngine.generateResponse(`Message ${i}`, context);
      }

      // Check that conversation history is limited
      const lastCall = mockOpenAI.chat.completions.create.mock.calls.slice(-1)[0][0];
      const userPrompt = lastCall.messages[1].content;

      // Should not contain all 15 messages due to memory limit
      expect(userPrompt.split('Message').length).toBeLessThan(15);
    });
  });
});