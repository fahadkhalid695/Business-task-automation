import { InferenceEngine } from '../InferenceEngine';
import { ModelManager } from '../ModelManager';
import { OpenAIService } from '../services/OpenAIService';
import { ModelType, InferenceResult } from '../types/AITypes';

// Mock dependencies
jest.mock('../ModelManager');
jest.mock('../services/OpenAIService');
jest.mock('../../shared/utils/logger');

describe('InferenceEngine', () => {
  let inferenceEngine: InferenceEngine;
  let mockModelManager: jest.Mocked<ModelManager>;
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockModelManager = new ModelManager() as jest.Mocked<ModelManager>;
    mockOpenAIService = new OpenAIService() as jest.Mocked<OpenAIService>;
    
    inferenceEngine = new InferenceEngine(mockModelManager);
    (inferenceEngine as any).openAIService = mockOpenAIService;
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      const modelId = 'openai-gpt-3.5';
      const prompt = 'Hello, world!';
      const expectedResult: InferenceResult = {
        success: true,
        output: 'Hello! How can I help you today?',
        timestamp: new Date(),
        metadata: {
          modelId,
          tokensUsed: 20,
          responseTime: 1000,
          cost: 0.04
        }
      };

      // Mock model loading
      mockModelManager.getModel.mockReturnValue({
        id: modelId,
        config: {
          id: modelId,
          name: 'OpenAI GPT-3.5',
          type: ModelType.TEXT_GENERATION,
          provider: 'openai',
          version: '1.0.0',
          maxTokens: 4096,
          isActive: true,
          capabilities: ['text-generation']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 200
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel(modelId)!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.generateText.mockResolvedValue(expectedResult);
      mockModelManager.updateMetrics.mockImplementation(() => {});

      const result = await inferenceEngine.generateText(prompt, modelId);

      expect(result).toEqual(expectedResult);
      expect(mockOpenAIService.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId,
          input: prompt,
          options: expect.objectContaining({
            maxTokens: 1000,
            temperature: 0.7
          })
        })
      );
      expect(mockModelManager.updateMetrics).toHaveBeenCalledWith(
        modelId,
        expect.any(Number),
        true,
        20
      );
    });

    it('should throw error for wrong model type', async () => {
      const modelId = 'openai-classification';
      const prompt = 'Hello, world!';

      mockModelManager.getModel.mockReturnValue({
        id: modelId,
        config: {
          id: modelId,
          name: 'OpenAI Classification',
          type: ModelType.CLASSIFICATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['classification']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 150
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel(modelId)!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);

      await expect(inferenceEngine.generateText(prompt, modelId)).rejects.toThrow(
        'Model openai-classification is not suitable for text generation'
      );
    });

    it('should handle OpenAI service errors', async () => {
      const modelId = 'openai-gpt-3.5';
      const prompt = 'Hello, world!';

      mockModelManager.getModel.mockReturnValue({
        id: modelId,
        config: {
          id: modelId,
          name: 'OpenAI GPT-3.5',
          type: ModelType.TEXT_GENERATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['text-generation']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 200
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel(modelId)!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.generateText.mockRejectedValue(new Error('API Error'));

      await expect(inferenceEngine.generateText(prompt, modelId)).rejects.toThrow('API Error');
      expect(mockModelManager.updateMetrics).toHaveBeenCalledWith(
        modelId,
        expect.any(Number),
        false,
        0
      );
    });
  });

  describe('classify', () => {
    it('should classify text successfully', async () => {
      const modelId = 'openai-classification';
      const text = 'This is a great product!';
      const categories = ['positive', 'negative', 'neutral'];
      const expectedResult: InferenceResult = {
        success: true,
        output: 'positive',
        confidence: 0.8,
        timestamp: new Date(),
        metadata: {
          modelId,
          tokensUsed: 15,
          responseTime: 800,
          categories
        }
      };

      mockModelManager.getModel.mockReturnValue({
        id: modelId,
        config: {
          id: modelId,
          name: 'OpenAI Classification',
          type: ModelType.CLASSIFICATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['classification']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 150
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel(modelId)!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.classify.mockResolvedValue(expectedResult);

      const result = await inferenceEngine.classify(text, modelId, categories);

      expect(result).toEqual(expectedResult);
      expect(mockOpenAIService.classify).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId,
          input: expect.stringContaining(text)
        }),
        categories
      );
    });

    it('should throw error for wrong model type', async () => {
      const modelId = 'openai-gpt-3.5';
      const text = 'This is a great product!';

      mockModelManager.getModel.mockReturnValue({
        id: modelId,
        config: {
          id: modelId,
          name: 'OpenAI GPT-3.5',
          type: ModelType.TEXT_GENERATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['text-generation']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 200
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel(modelId)!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);

      await expect(inferenceEngine.classify(text, modelId)).rejects.toThrow(
        'Model openai-gpt-3.5 is not suitable for classification'
      );
    });
  });

  describe('translate', () => {
    it('should translate text successfully', async () => {
      const modelId = 'openai-translation';
      const text = 'Hello, world!';
      const sourceLang = 'en';
      const targetLang = 'es';
      const expectedResult: InferenceResult = {
        success: true,
        output: '¡Hola, mundo!',
        timestamp: new Date(),
        metadata: {
          modelId,
          tokensUsed: 12,
          responseTime: 900,
          sourceLang,
          targetLang
        }
      };

      mockModelManager.getModel.mockReturnValue({
        id: modelId,
        config: {
          id: modelId,
          name: 'OpenAI Translation',
          type: ModelType.TRANSLATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['translation']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 180
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel(modelId)!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.translate.mockResolvedValue(expectedResult);

      const result = await inferenceEngine.translate(text, sourceLang, targetLang, modelId);

      expect(result).toEqual(expectedResult);
      expect(mockOpenAIService.translate).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId,
          input: expect.stringContaining(text)
        }),
        sourceLang,
        targetLang
      );
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment successfully', async () => {
      const text = 'This is a great product!';
      const expectedResult: InferenceResult = {
        success: true,
        output: 'positive',
        confidence: 0.8,
        timestamp: new Date(),
        metadata: {
          modelId: 'openai-classification',
          tokensUsed: 15,
          responseTime: 800,
          categories: ['positive', 'negative', 'neutral'],
          sentimentAnalysis: true
        }
      };

      mockModelManager.getModel.mockReturnValue({
        id: 'openai-classification',
        config: {
          id: 'openai-classification',
          name: 'OpenAI Classification',
          type: ModelType.CLASSIFICATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['classification']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 150
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel('openai-classification')!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.classify.mockResolvedValue({
        ...expectedResult,
        metadata: {
          ...expectedResult.metadata,
          sentimentAnalysis: undefined
        }
      });

      const result = await inferenceEngine.analyzeSentiment(text);

      expect(result.metadata?.sentimentAnalysis).toBe(true);
      expect(result.metadata?.categories).toEqual(['positive', 'negative', 'neutral']);
    });
  });

  describe('extractInformation', () => {
    it('should extract entities successfully', async () => {
      const text = 'John Smith works at Microsoft in Seattle.';
      const expectedResult: InferenceResult = {
        success: true,
        output: '["John Smith", "Microsoft", "Seattle"]',
        timestamp: new Date(),
        metadata: {
          modelId: 'openai-gpt-3.5',
          tokensUsed: 25
        }
      };

      mockModelManager.getModel.mockReturnValue({
        id: 'openai-gpt-3.5',
        config: {
          id: 'openai-gpt-3.5',
          name: 'OpenAI GPT-3.5',
          type: ModelType.TEXT_GENERATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['text-generation']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 200
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel('openai-gpt-3.5')!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.generateText.mockResolvedValue(expectedResult);

      const result = await inferenceEngine.extractInformation(text, 'entities');

      expect(result).toEqual(expectedResult);
      expect(mockOpenAIService.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.stringContaining('Extract named entities')
        })
      );
    });
  });

  describe('batchInference', () => {
    it('should process batch requests successfully', async () => {
      const requests = [
        { input: 'Hello', type: 'generation' as const },
        { input: 'Great product', type: 'classification' as const, options: { categories: ['positive', 'negative'] } }
      ];

      const expectedResults: InferenceResult[] = [
        {
          success: true,
          output: 'Hello! How can I help?',
          timestamp: new Date(),
          metadata: { modelId: 'openai-gpt-3.5' }
        },
        {
          success: true,
          output: 'positive',
          timestamp: new Date(),
          metadata: { modelId: 'openai-classification' }
        }
      ];

      // Mock for text generation
      mockModelManager.getModel.mockImplementation((modelId) => {
        if (modelId === 'openai-gpt-3.5') {
          return {
            id: modelId,
            config: {
              id: modelId,
              name: 'OpenAI GPT-3.5',
              type: ModelType.TEXT_GENERATION,
              provider: 'openai',
              version: '1.0.0',
              isActive: true,
              capabilities: ['text-generation']
            },
            loadedAt: new Date(),
            lastUsed: new Date(),
            isLoaded: true,
            memoryUsage: 200
          };
        } else if (modelId === 'openai-classification') {
          return {
            id: modelId,
            config: {
              id: modelId,
              name: 'OpenAI Classification',
              type: ModelType.CLASSIFICATION,
              provider: 'openai',
              version: '1.0.0',
              isActive: true,
              capabilities: ['classification']
            },
            loadedAt: new Date(),
            lastUsed: new Date(),
            isLoaded: true,
            memoryUsage: 150
          };
        }
        return undefined;
      });

      mockModelManager.loadModel.mockImplementation((modelId) => 
        Promise.resolve(mockModelManager.getModel(modelId)!)
      );
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      
      mockOpenAIService.generateText.mockResolvedValue(expectedResults[0]);
      mockOpenAIService.classify.mockResolvedValue(expectedResults[1]);

      const results = await inferenceEngine.batchInference(requests);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle errors in batch processing', async () => {
      const requests = [
        { input: 'Hello', type: 'generation' as const }
      ];

      mockModelManager.getModel.mockReturnValue({
        id: 'openai-gpt-3.5',
        config: {
          id: 'openai-gpt-3.5',
          name: 'OpenAI GPT-3.5',
          type: ModelType.TEXT_GENERATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['text-generation']
        },
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: 200
      });

      mockModelManager.loadModel.mockResolvedValue(mockModelManager.getModel('openai-gpt-3.5')!);
      mockModelManager.checkModelHealth.mockResolvedValue(true);
      mockOpenAIService.generateText.mockRejectedValue(new Error('API Error'));

      const results = await inferenceEngine.batchInference(requests);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('API Error');
    });
  });
});