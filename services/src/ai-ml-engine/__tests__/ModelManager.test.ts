import { ModelManager } from '../ModelManager';
import { ModelType } from '../types/AITypes';
import { RedisCache } from '../../shared/cache/RedisCache';

// Mock dependencies
jest.mock('../../shared/cache/RedisCache');
jest.mock('../../shared/utils/logger');

describe('ModelManager', () => {
  let modelManager: ModelManager;
  let mockCache: jest.Mocked<RedisCache>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = new RedisCache() as jest.Mocked<RedisCache>;
    mockCache.set = jest.fn().mockResolvedValue(undefined);
    mockCache.get = jest.fn().mockResolvedValue(null);
    mockCache.delete = jest.fn().mockResolvedValue(undefined);
    
    modelManager = new ModelManager();
    // Replace the cache instance with our mock
    (modelManager as any).cache = mockCache;
  });

  describe('loadModel', () => {
    it('should load a model successfully', async () => {
      const modelId = 'openai-gpt-3.5';
      
      const model = await modelManager.loadModel(modelId);
      
      expect(model).toBeDefined();
      expect(model.id).toBe(modelId);
      expect(model.isLoaded).toBe(true);
      expect(model.loadedAt).toBeInstanceOf(Date);
      expect(mockCache.set).toHaveBeenCalledWith(
        `model:${modelId}`,
        expect.any(String),
        3600
      );
    });

    it('should return existing model if already loaded', async () => {
      const modelId = 'openai-gpt-3.5';
      
      // Load model first time
      const model1 = await modelManager.loadModel(modelId);
      
      // Load model second time
      const model2 = await modelManager.loadModel(modelId);
      
      expect(model1).toBe(model2);
      expect(mockCache.set).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent model', async () => {
      const modelId = 'non-existent-model';
      
      await expect(modelManager.loadModel(modelId)).rejects.toThrow(
        'Model configuration not found for non-existent-model'
      );
    });

    it('should throw error for inactive model', async () => {
      const modelId = 'openai-gpt-3.5';
      const config = modelManager.getModelConfig(modelId);
      if (config) {
        config.isActive = false;
      }
      
      await expect(modelManager.loadModel(modelId)).rejects.toThrow(
        'Model openai-gpt-3.5 is not active'
      );
    });
  });

  describe('unloadModel', () => {
    it('should unload a loaded model', async () => {
      const modelId = 'openai-gpt-3.5';
      
      // Load model first
      await modelManager.loadModel(modelId);
      expect(modelManager.getLoadedModels()).toContain(modelId);
      
      // Unload model
      await modelManager.unloadModel(modelId);
      
      expect(modelManager.getLoadedModels()).not.toContain(modelId);
      expect(mockCache.delete).toHaveBeenCalledWith(`model:${modelId}`);
    });

    it('should handle unloading non-loaded model gracefully', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await expect(modelManager.unloadModel(modelId)).resolves.not.toThrow();
    });
  });

  describe('getModel', () => {
    it('should return loaded model and update lastUsed', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      const initialTime = new Date();
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const model = modelManager.getModel(modelId);
      
      expect(model).toBeDefined();
      expect(model!.lastUsed.getTime()).toBeGreaterThan(initialTime.getTime());
    });

    it('should return undefined for non-loaded model', () => {
      const modelId = 'openai-gpt-3.5';
      
      const model = modelManager.getModel(modelId);
      
      expect(model).toBeUndefined();
    });
  });

  describe('listModels', () => {
    it('should return all available model configurations', async () => {
      const models = await modelManager.listModels();
      
      expect(models).toHaveLength(4); // Based on initialized configs
      expect(models.some(m => m.id === 'openai-gpt-3.5')).toBe(true);
      expect(models.some(m => m.id === 'openai-gpt-4')).toBe(true);
      expect(models.some(m => m.id === 'openai-classification')).toBe(true);
      expect(models.some(m => m.id === 'openai-translation')).toBe(true);
    });
  });

  describe('updateMetrics', () => {
    it('should update model metrics correctly', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      // Update metrics
      modelManager.updateMetrics(modelId, 1000, true, 100);
      
      const metrics = modelManager.getMetrics(modelId);
      
      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBe(1);
      expect(metrics!.successfulRequests).toBe(1);
      expect(metrics!.failedRequests).toBe(0);
      expect(metrics!.totalResponseTime).toBe(1000);
      expect(metrics!.averageResponseTime).toBe(1000);
      expect(metrics!.successRate).toBe(100);
      expect(metrics!.totalTokensUsed).toBe(100);
    });

    it('should handle failed requests in metrics', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      // Update with failed request
      modelManager.updateMetrics(modelId, 2000, false);
      
      const metrics = modelManager.getMetrics(modelId);
      
      expect(metrics!.totalRequests).toBe(1);
      expect(metrics!.successfulRequests).toBe(0);
      expect(metrics!.failedRequests).toBe(1);
      expect(metrics!.successRate).toBe(0);
    });
  });

  describe('checkModelHealth', () => {
    it('should return true for healthy model', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      const isHealthy = await modelManager.checkModelHealth(modelId);
      
      expect(isHealthy).toBe(true);
    });

    it('should return false for non-loaded model', async () => {
      const modelId = 'openai-gpt-3.5';
      
      const isHealthy = await modelManager.checkModelHealth(modelId);
      
      expect(isHealthy).toBe(false);
    });

    it('should return false for model with low success rate', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      // Simulate low success rate
      for (let i = 0; i < 10; i++) {
        modelManager.updateMetrics(modelId, 1000, i < 8); // 80% success rate
      }
      
      const isHealthy = await modelManager.checkModelHealth(modelId);
      
      expect(isHealthy).toBe(false);
    });

    it('should return false for model with high response time', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      // Simulate high response time
      modelManager.updateMetrics(modelId, 6000, true); // 6 seconds
      
      const isHealthy = await modelManager.checkModelHealth(modelId);
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('cleanupUnusedModels', () => {
    it('should unload models that exceed idle time', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      // Manually set lastUsed to old time
      const model = modelManager.getModel(modelId);
      if (model) {
        model.lastUsed = new Date(Date.now() - 7200000); // 2 hours ago
      }
      
      await modelManager.cleanupUnusedModels(3600000); // 1 hour max idle
      
      expect(modelManager.getLoadedModels()).not.toContain(modelId);
    });

    it('should keep models within idle time', async () => {
      const modelId = 'openai-gpt-3.5';
      
      await modelManager.loadModel(modelId);
      
      await modelManager.cleanupUnusedModels(3600000); // 1 hour max idle
      
      expect(modelManager.getLoadedModels()).toContain(modelId);
    });
  });

  describe('initializeDefaultModels', () => {
    it('should load default models', async () => {
      await modelManager.initializeDefaultModels();
      
      const loadedModels = modelManager.getLoadedModels();
      
      expect(loadedModels).toContain('openai-gpt-3.5');
      expect(loadedModels).toContain('openai-classification');
      expect(loadedModels).toContain('openai-translation');
    });
  });
});