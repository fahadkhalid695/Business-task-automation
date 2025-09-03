import { ModelManager } from './ModelManager';
import { OpenAIService } from './services/OpenAIService';
import { logger } from '../shared/utils/logger';
import { 
  InferenceRequest, 
  InferenceResult, 
  TextGenerationOptions, 
  ClassificationOptions,
  TranslationOptions,
  ModelType 
} from './types/AITypes';

export class InferenceEngine {
  private modelManager: ModelManager;
  private openAIService: OpenAIService;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
    this.openAIService = new OpenAIService();
  }

  /**
   * Generate text using specified model
   */
  async generateText(
    prompt: string, 
    modelType: string = 'openai-gpt-3.5', 
    options: TextGenerationOptions = {}
  ): Promise<InferenceResult> {
    const startTime = Date.now();
    let success = false;
    let tokensUsed = 0;

    try {
      // Validate and load model
      const model = await this.ensureModelLoaded(modelType);
      
      if (model.config.type !== ModelType.TEXT_GENERATION) {
        throw new Error(`Model ${modelType} is not suitable for text generation`);
      }

      // Prepare inference request
      const request: InferenceRequest = {
        modelId: modelType,
        input: prompt,
        options: {
          maxTokens: options.maxTokens || model.config.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          topP: options.topP || 1.0,
          frequencyPenalty: options.frequencyPenalty || 0,
          presencePenalty: options.presencePenalty || 0,
          stop: options.stop
        },
        timestamp: new Date()
      };

      // Execute inference based on provider
      let result: InferenceResult;
      
      if (model.config.provider === 'openai') {
        result = await this.openAIService.generateText(request);
        tokensUsed = result.metadata?.tokensUsed || 0;
      } else {
        throw new Error(`Unsupported provider: ${model.config.provider}`);
      }

      success = true;
      return result;

    } catch (error) {
      logger.error(`Text generation failed for model ${modelType}:`, error);
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.modelManager.updateMetrics(modelType, responseTime, success, tokensUsed);
    }
  }

  /**
   * Classify text using specified model
   */
  async classify(
    text: string, 
    modelType: string = 'openai-classification', 
    categories?: string[]
  ): Promise<InferenceResult> {
    const startTime = Date.now();
    let success = false;
    let tokensUsed = 0;

    try {
      // Validate and load model
      const model = await this.ensureModelLoaded(modelType);
      
      if (model.config.type !== ModelType.CLASSIFICATION) {
        throw new Error(`Model ${modelType} is not suitable for classification`);
      }

      // Prepare classification prompt
      let prompt = `Classify the following text:\n\n"${text}"\n\n`;
      
      if (categories && categories.length > 0) {
        prompt += `Categories: ${categories.join(', ')}\n\n`;
        prompt += 'Return only the most appropriate category name.';
      } else {
        prompt += 'Provide a classification category and confidence score.';
      }

      const request: InferenceRequest = {
        modelId: modelType,
        input: prompt,
        options: {
          maxTokens: 100,
          temperature: 0.3,
          topP: 1.0
        },
        timestamp: new Date()
      };

      // Execute inference
      let result: InferenceResult;
      
      if (model.config.provider === 'openai') {
        result = await this.openAIService.classify(request, categories);
        tokensUsed = result.metadata?.tokensUsed || 0;
      } else {
        throw new Error(`Unsupported provider: ${model.config.provider}`);
      }

      success = true;
      return result;

    } catch (error) {
      logger.error(`Classification failed for model ${modelType}:`, error);
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.modelManager.updateMetrics(modelType, responseTime, success, tokensUsed);
    }
  }

  /**
   * Translate text using specified model
   */
  async translate(
    text: string, 
    sourceLang: string, 
    targetLang: string, 
    modelType: string = 'openai-translation'
  ): Promise<InferenceResult> {
    const startTime = Date.now();
    let success = false;
    let tokensUsed = 0;

    try {
      // Validate and load model
      const model = await this.ensureModelLoaded(modelType);
      
      if (model.config.type !== ModelType.TRANSLATION) {
        throw new Error(`Model ${modelType} is not suitable for translation`);
      }

      // Prepare translation prompt
      const prompt = `Translate the following text from ${sourceLang} to ${targetLang}:\n\n"${text}"\n\nProvide only the translation without any additional text.`;

      const request: InferenceRequest = {
        modelId: modelType,
        input: prompt,
        options: {
          maxTokens: Math.max(text.length * 2, 500),
          temperature: 0.3,
          topP: 1.0
        },
        timestamp: new Date()
      };

      // Execute inference
      let result: InferenceResult;
      
      if (model.config.provider === 'openai') {
        result = await this.openAIService.translate(request, sourceLang, targetLang);
        tokensUsed = result.metadata?.tokensUsed || 0;
      } else {
        throw new Error(`Unsupported provider: ${model.config.provider}`);
      }

      success = true;
      return result;

    } catch (error) {
      logger.error(`Translation failed for model ${modelType}:`, error);
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.modelManager.updateMetrics(modelType, responseTime, success, tokensUsed);
    }
  }

  /**
   * Perform sentiment analysis
   */
  async analyzeSentiment(text: string, modelType: string = 'openai-classification'): Promise<InferenceResult> {
    const categories = ['positive', 'negative', 'neutral'];
    const result = await this.classify(text, modelType, categories);
    
    // Enhance result with sentiment-specific metadata
    if (result.output) {
      result.metadata = {
        ...result.metadata,
        sentimentAnalysis: true,
        categories
      };
    }
    
    return result;
  }

  /**
   * Extract key information from text
   */
  async extractInformation(
    text: string, 
    extractionType: 'entities' | 'keywords' | 'summary' | 'action_items',
    modelType: string = 'openai-gpt-3.5'
  ): Promise<InferenceResult> {
    let prompt = '';
    
    switch (extractionType) {
      case 'entities':
        prompt = `Extract named entities (people, organizations, locations, dates) from the following text:\n\n"${text}"\n\nReturn as a JSON list.`;
        break;
      case 'keywords':
        prompt = `Extract the most important keywords and phrases from the following text:\n\n"${text}"\n\nReturn as a comma-separated list.`;
        break;
      case 'summary':
        prompt = `Provide a concise summary of the following text:\n\n"${text}"`;
        break;
      case 'action_items':
        prompt = `Extract action items and tasks from the following text:\n\n"${text}"\n\nReturn as a numbered list.`;
        break;
    }

    return this.generateText(prompt, modelType, { 
      maxTokens: 500, 
      temperature: 0.3 
    });
  }

  /**
   * Batch inference for multiple inputs
   */
  async batchInference(
    requests: Array<{
      input: string;
      type: 'generation' | 'classification' | 'translation';
      modelType?: string;
      options?: any;
    }>
  ): Promise<InferenceResult[]> {
    const results: InferenceResult[] = [];
    
    // Process requests in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(requests, concurrencyLimit);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request) => {
        try {
          switch (request.type) {
            case 'generation':
              return await this.generateText(request.input, request.modelType, request.options);
            case 'classification':
              return await this.classify(request.input, request.modelType, request.options?.categories);
            case 'translation':
              return await this.translate(
                request.input, 
                request.options?.sourceLang, 
                request.options?.targetLang, 
                request.modelType
              );
            default:
              throw new Error(`Unsupported inference type: ${request.type}`);
          }
        } catch (error) {
          logger.error(`Batch inference failed for request:`, error);
          return {
            success: false,
            output: null,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            metadata: { batchProcessing: true }
          };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }
    
    return results;
  }

  /**
   * Ensure model is loaded and ready
   */
  private async ensureModelLoaded(modelType: string) {
    let model = this.modelManager.getModel(modelType);
    
    if (!model) {
      model = await this.modelManager.loadModel(modelType);
    }
    
    // Check model health
    const isHealthy = await this.modelManager.checkModelHealth(modelType);
    if (!isHealthy) {
      logger.warn(`Model ${modelType} health check failed, attempting reload`);
      await this.modelManager.unloadModel(modelType);
      model = await this.modelManager.loadModel(modelType);
    }
    
    return model;
  }

  /**
   * Utility function to chunk array
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}