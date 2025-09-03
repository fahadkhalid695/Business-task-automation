import { logger } from '../shared/utils/logger';
import { RedisCache } from '../shared/cache/RedisCache';
import { AIModel, ModelType, ModelConfig, ModelMetrics } from './types/AITypes';

export class ModelManager {
  private loadedModels: Map<string, AIModel> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private cache: RedisCache;
  private metrics: Map<string, ModelMetrics> = new Map();

  constructor() {
    this.cache = new RedisCache();
    this.initializeModelConfigs();
  }

  /**
   * Initialize default model configurations
   */
  private initializeModelConfigs(): void {
    // OpenAI GPT models
    this.modelConfigs.set('openai-gpt-3.5', {
      id: 'openai-gpt-3.5',
      name: 'OpenAI GPT-3.5 Turbo',
      type: ModelType.TEXT_GENERATION,
      provider: 'openai',
      version: '1.0.0',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 4096,
      costPerToken: 0.002,
      isActive: true,
      capabilities: ['text-generation', 'conversation', 'summarization']
    });

    this.modelConfigs.set('openai-gpt-4', {
      id: 'openai-gpt-4',
      name: 'OpenAI GPT-4',
      type: ModelType.TEXT_GENERATION,
      provider: 'openai',
      version: '1.0.0',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 8192,
      costPerToken: 0.03,
      isActive: true,
      capabilities: ['text-generation', 'conversation', 'analysis', 'coding']
    });

    // Classification models
    this.modelConfigs.set('openai-classification', {
      id: 'openai-classification',
      name: 'OpenAI Text Classification',
      type: ModelType.CLASSIFICATION,
      provider: 'openai',
      version: '1.0.0',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 2048,
      costPerToken: 0.002,
      isActive: true,
      capabilities: ['classification', 'sentiment-analysis', 'categorization']
    });

    // Translation models
    this.modelConfigs.set('openai-translation', {
      id: 'openai-translation',
      name: 'OpenAI Translation',
      type: ModelType.TRANSLATION,
      provider: 'openai',
      version: '1.0.0',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 2048,
      costPerToken: 0.002,
      isActive: true,
      capabilities: ['translation', 'multilingual']
    });

    logger.info(`Initialized ${this.modelConfigs.size} model configurations`);
  }

  /**
   * Load a model into memory
   */
  async loadModel(modelId: string): Promise<AIModel> {
    try {
      if (this.loadedModels.has(modelId)) {
        logger.info(`Model ${modelId} already loaded`);
        return this.loadedModels.get(modelId)!;
      }

      const config = this.modelConfigs.get(modelId);
      if (!config) {
        throw new Error(`Model configuration not found for ${modelId}`);
      }

      if (!config.isActive) {
        throw new Error(`Model ${modelId} is not active`);
      }

      // Create model instance
      const model: AIModel = {
        id: modelId,
        config,
        loadedAt: new Date(),
        lastUsed: new Date(),
        isLoaded: true,
        memoryUsage: this.estimateMemoryUsage(config)
      };

      // Cache model metadata
      await this.cache.set(`model:${modelId}`, JSON.stringify(model), 3600);

      this.loadedModels.set(modelId, model);
      this.initializeMetrics(modelId);

      logger.info(`Model ${modelId} loaded successfully`);
      return model;
    } catch (error) {
      logger.error(`Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Unload a model from memory
   */
  async unloadModel(modelId: string): Promise<void> {
    try {
      if (!this.loadedModels.has(modelId)) {
        logger.warn(`Model ${modelId} is not loaded`);
        return;
      }

      this.loadedModels.delete(modelId);
      this.metrics.delete(modelId);
      await this.cache.delete(`model:${modelId}`);

      logger.info(`Model ${modelId} unloaded successfully`);
    } catch (error) {
      logger.error(`Failed to unload model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get a loaded model
   */
  getModel(modelId: string): AIModel | undefined {
    const model = this.loadedModels.get(modelId);
    if (model) {
      model.lastUsed = new Date();
    }
    return model;
  }

  /**
   * List all available models
   */
  async listModels(): Promise<ModelConfig[]> {
    return Array.from(this.modelConfigs.values());
  }

  /**
   * Get loaded models
   */
  getLoadedModels(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId: string): ModelConfig | undefined {
    return this.modelConfigs.get(modelId);
  }

  /**
   * Update model metrics
   */
  updateMetrics(modelId: string, responseTime: number, success: boolean, tokensUsed?: number): void {
    const metrics = this.metrics.get(modelId);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.totalResponseTime += responseTime;
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.totalRequests;

    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;

    if (tokensUsed) {
      metrics.totalTokensUsed += tokensUsed;
    }

    metrics.lastUpdated = new Date();
  }

  /**
   * Get model metrics
   */
  getMetrics(modelId: string): ModelMetrics | undefined {
    return this.metrics.get(modelId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, ModelMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Initialize default models
   */
  async initializeDefaultModels(): Promise<void> {
    const defaultModels = ['openai-gpt-3.5', 'openai-classification', 'openai-translation'];
    
    for (const modelId of defaultModels) {
      try {
        await this.loadModel(modelId);
      } catch (error) {
        logger.error(`Failed to initialize default model ${modelId}:`, error);
      }
    }
  }

  /**
   * Check model health and performance
   */
  async checkModelHealth(modelId: string): Promise<boolean> {
    try {
      const model = this.getModel(modelId);
      if (!model || !model.isLoaded) {
        return false;
      }

      const metrics = this.getMetrics(modelId);
      if (!metrics) {
        return true; // New model, assume healthy
      }

      // Check if success rate is acceptable (>90%)
      if (metrics.successRate < 90) {
        logger.warn(`Model ${modelId} has low success rate: ${metrics.successRate}%`);
        return false;
      }

      // Check if average response time is acceptable (<5 seconds)
      if (metrics.averageResponseTime > 5000) {
        logger.warn(`Model ${modelId} has high response time: ${metrics.averageResponseTime}ms`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Health check failed for model ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Clean up unused models
   */
  async cleanupUnusedModels(maxIdleTime: number = 3600000): Promise<void> {
    const now = new Date();
    const modelsToUnload: string[] = [];

    for (const [modelId, model] of this.loadedModels) {
      const idleTime = now.getTime() - model.lastUsed.getTime();
      if (idleTime > maxIdleTime) {
        modelsToUnload.push(modelId);
      }
    }

    for (const modelId of modelsToUnload) {
      await this.unloadModel(modelId);
      logger.info(`Cleaned up unused model: ${modelId}`);
    }
  }

  /**
   * Initialize metrics for a model
   */
  private initializeMetrics(modelId: string): void {
    this.metrics.set(modelId, {
      modelId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      successRate: 100,
      totalTokensUsed: 0,
      lastUpdated: new Date()
    });
  }

  /**
   * Estimate memory usage for a model
   */
  private estimateMemoryUsage(config: ModelConfig): number {
    // Rough estimation based on model type and capabilities
    let baseMemory = 100; // MB

    switch (config.type) {
      case ModelType.TEXT_GENERATION:
        baseMemory = 200;
        break;
      case ModelType.CLASSIFICATION:
        baseMemory = 150;
        break;
      case ModelType.TRANSLATION:
        baseMemory = 180;
        break;
    }

    // Add memory for capabilities
    baseMemory += config.capabilities.length * 20;

    return baseMemory;
  }
}