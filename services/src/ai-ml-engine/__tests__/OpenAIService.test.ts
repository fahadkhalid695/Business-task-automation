import axios from 'axios';
import { OpenAIService } from '../services/OpenAIService';
import { InferenceRequest } from '../types/AITypes';

// Mock axios
jest.mock('axios');
jest.mock('../../shared/utils/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenAIService', () => {
  let openAIService: OpenAIService;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedAxios.isAxiosError.mockImplementation((error) => error.isAxiosError === true);
    
    // Set environment variable for testing
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    openAIService = new OpenAIService();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello, world!',
        options: {
          maxTokens: 100,
          temperature: 0.7
        },
        timestamp: new Date()
      };

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Hello! How can I help you today?'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            total_tokens: 25
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await openAIService.generateText(request);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello! How can I help you today?');
      expect(result.metadata?.tokensUsed).toBe(25);
      expect(result.metadata?.modelId).toBe('openai-gpt-3.5');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, world!'
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
        top_p: 1.0,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: undefined
      });
    });

    it('should handle system prompt', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello, world!',
        options: {
          systemPrompt: 'You are a helpful assistant.'
        },
        timestamp: new Date()
      };

      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Hello!' } }],
          usage: { total_tokens: 20 }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await openAIService.generateText(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', 
        expect.objectContaining({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant.'
            },
            {
              role: 'user',
              content: 'Hello, world!'
            }
          ]
        })
      );
    });

    it('should handle conversation history', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'What did I ask before?',
        options: {
          conversationHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ]
        },
        timestamp: new Date()
      };

      const mockResponse = {
        data: {
          choices: [{ message: { content: 'You said hello.' } }],
          usage: { total_tokens: 30 }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await openAIService.generateText(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions',
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'What did I ask before?' }
          ]
        })
      );
    });

    it('should handle API errors', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello, world!',
        timestamp: new Date()
      };

      const mockError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid API key'
            }
          }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await openAIService.generateText(request);

      expect(result.success).toBe(false);
      expect(result.output).toBeNull();
      expect(result.error).toBe('Invalid API key or authentication failed');
    });

    it('should handle missing API key', async () => {
      delete process.env.OPENAI_API_KEY;
      const openAIServiceNoKey = new OpenAIService();

      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello, world!',
        timestamp: new Date()
      };

      const result = await openAIServiceNoKey.generateText(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenAI API key not configured');
    });
  });

  describe('classify', () => {
    it('should classify text successfully', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-classification',
        input: 'This is a great product!',
        timestamp: new Date()
      };

      const categories = ['positive', 'negative', 'neutral'];

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'positive'
              }
            }
          ],
          usage: {
            total_tokens: 15
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await openAIService.classify(request, categories);

      expect(result.success).toBe(true);
      expect(result.output).toBe('positive');
      expect(result.confidence).toBe(0.8);
      expect(result.metadata?.categories).toEqual(categories);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions',
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('positive, negative, neutral')
            }
          ]
        })
      );
    });

    it('should handle classification without categories', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-classification',
        input: 'This is a great product!',
        timestamp: new Date()
      };

      const mockResponse = {
        data: {
          choices: [{ message: { content: 'positive sentiment' } }],
          usage: { total_tokens: 15 }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await openAIService.classify(request);

      expect(result.success).toBe(true);
      expect(result.output).toBe('positive sentiment');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions',
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('Provide a classification category')
            }
          ]
        })
      );
    });
  });

  describe('translate', () => {
    it('should translate text successfully', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-translation',
        input: 'Hello, world!',
        timestamp: new Date()
      };

      const sourceLang = 'en';
      const targetLang = 'es';

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: '¡Hola, mundo!'
              }
            }
          ],
          usage: {
            total_tokens: 12
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await openAIService.translate(request, sourceLang, targetLang);

      expect(result.success).toBe(true);
      expect(result.output).toBe('¡Hola, mundo!');
      expect(result.metadata?.sourceLang).toBe(sourceLang);
      expect(result.metadata?.targetLang).toBe(targetLang);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions',
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('from en to es')
            }
          ]
        })
      );
    });
  });

  describe('checkHealth', () => {
    it('should return true when API is healthy', async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const isHealthy = await openAIService.checkHealth();

      expect(isHealthy).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/models', { timeout: 5000 });
    });

    it('should return false when API is unhealthy', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const isHealthy = await openAIService.checkHealth();

      expect(isHealthy).toBe(false);
    });

    it('should return false when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      const openAIServiceNoKey = new OpenAIService();

      const isHealthy = await openAIServiceNoKey.checkHealth();

      expect(isHealthy).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return available GPT models', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 'gpt-3.5-turbo' },
            { id: 'gpt-4' },
            { id: 'text-davinci-003' },
            { id: 'whisper-1' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const models = await openAIService.getAvailableModels();

      expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4']);
    });

    it('should return empty array on error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      const models = await openAIService.getAvailableModels();

      expect(models).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should format rate limit errors correctly', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello',
        timestamp: new Date()
      };

      const mockError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await openAIService.generateText(request);

      expect(result.error).toBe('Rate limit exceeded. Please try again later');
    });

    it('should format server errors correctly', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello',
        timestamp: new Date()
      };

      const mockError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: { message: 'Internal server error' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await openAIService.generateText(request);

      expect(result.error).toBe('OpenAI service temporarily unavailable');
    });

    it('should format network errors correctly', async () => {
      const request: InferenceRequest = {
        modelId: 'openai-gpt-3.5',
        input: 'Hello',
        timestamp: new Date()
      };

      const mockError = {
        isAxiosError: true,
        request: {},
        message: 'Network Error'
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await openAIService.generateText(request);

      expect(result.error).toBe('Network error: Unable to reach OpenAI API');
    });
  });
});