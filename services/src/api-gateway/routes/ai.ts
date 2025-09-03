import { Router } from 'express';
import { ModelManager } from '../../ai-ml-engine/ModelManager';
import { InferenceEngine } from '../../ai-ml-engine/InferenceEngine';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { Logger } from '../../shared/utils/logger';
import Joi from 'joi';

const router = Router();
const logger = new Logger('AIRoutes');

// Initialize AI/ML components
const modelManager = new ModelManager();
const inferenceEngine = new InferenceEngine(modelManager);

// Initialize default models on startup
modelManager.initializeDefaultModels().catch(error => {
  logger.error('Failed to initialize default AI models:', error);
});

// Validation schemas
const textGenerationSchema = Joi.object({
  prompt: Joi.string().required().min(1).max(10000),
  modelType: Joi.string().optional().default('openai-gpt-3.5'),
  options: Joi.object({
    maxTokens: Joi.number().optional().min(1).max(4000),
    temperature: Joi.number().optional().min(0).max(2),
    topP: Joi.number().optional().min(0).max(1),
    frequencyPenalty: Joi.number().optional().min(-2).max(2),
    presencePenalty: Joi.number().optional().min(-2).max(2),
    stop: Joi.array().items(Joi.string()).optional(),
    systemPrompt: Joi.string().optional().max(2000),
    conversationHistory: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant', 'system').required(),
        content: Joi.string().required()
      })
    ).optional()
  }).optional()
});

const classificationSchema = Joi.object({
  text: Joi.string().required().min(1).max(10000),
  modelType: Joi.string().optional().default('openai-classification'),
  categories: Joi.array().items(Joi.string()).optional(),
  options: Joi.object({
    returnConfidence: Joi.boolean().optional().default(true),
    multiLabel: Joi.boolean().optional().default(false)
  }).optional()
});

const translationSchema = Joi.object({
  text: Joi.string().required().min(1).max(10000),
  sourceLang: Joi.string().required().length(2),
  targetLang: Joi.string().required().length(2),
  modelType: Joi.string().optional().default('openai-translation'),
  options: Joi.object({
    preserveFormatting: Joi.boolean().optional().default(true),
    contextualHints: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const extractionSchema = Joi.object({
  text: Joi.string().required().min(1).max(10000),
  extractionType: Joi.string().valid('entities', 'keywords', 'summary', 'action_items').required(),
  modelType: Joi.string().optional().default('openai-gpt-3.5')
});

const batchInferenceSchema = Joi.object({
  requests: Joi.array().items(
    Joi.object({
      input: Joi.string().required(),
      type: Joi.string().valid('generation', 'classification', 'translation').required(),
      modelType: Joi.string().optional(),
      options: Joi.object().optional()
    })
  ).required().min(1).max(50)
});

// Routes

/**
 * @route POST /api/v1/ai/generate
 * @desc Generate text using AI models
 * @access Private
 */
router.post('/generate', 
  authenticate,
  validateRequest(textGenerationSchema),
  asyncHandler(async (req, res) => {
    const { prompt, modelType, options } = req.body;
    
    logger.info('Text generation request', { 
      userId: req.user?.id, 
      modelType,
      promptLength: prompt.length 
    });

    const result = await inferenceEngine.generateText(prompt, modelType, options);

    res.json({
      success: true,
      data: {
        output: result.output,
        metadata: {
          modelId: result.metadata?.modelId,
          tokensUsed: result.metadata?.tokensUsed,
          responseTime: result.metadata?.responseTime,
          cost: result.metadata?.cost
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /api/v1/ai/classify
 * @desc Classify text into categories
 * @access Private
 */
router.post('/classify',
  authenticate,
  validateRequest(classificationSchema),
  asyncHandler(async (req, res) => {
    const { text, modelType, categories, options } = req.body;
    
    logger.info('Text classification request', { 
      userId: req.user?.id, 
      modelType,
      textLength: text.length,
      categories: categories?.length || 0
    });

    const result = await inferenceEngine.classify(text, modelType, categories);

    res.json({
      success: true,
      data: {
        classification: result.output,
        confidence: result.confidence,
        categories: result.metadata?.categories,
        metadata: {
          modelId: result.metadata?.modelId,
          tokensUsed: result.metadata?.tokensUsed,
          responseTime: result.metadata?.responseTime
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /api/v1/ai/translate
 * @desc Translate text between languages
 * @access Private
 */
router.post('/translate',
  authenticate,
  validateRequest(translationSchema),
  asyncHandler(async (req, res) => {
    const { text, sourceLang, targetLang, modelType, options } = req.body;
    
    logger.info('Translation request', { 
      userId: req.user?.id, 
      modelType,
      sourceLang,
      targetLang,
      textLength: text.length
    });

    const result = await inferenceEngine.translate(text, sourceLang, targetLang, modelType);

    res.json({
      success: true,
      data: {
        translation: result.output,
        sourceLang,
        targetLang,
        metadata: {
          modelId: result.metadata?.modelId,
          tokensUsed: result.metadata?.tokensUsed,
          responseTime: result.metadata?.responseTime
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /api/v1/ai/sentiment
 * @desc Analyze sentiment of text
 * @access Private
 */
router.post('/sentiment',
  authenticate,
  validateRequest(Joi.object({
    text: Joi.string().required().min(1).max(10000),
    modelType: Joi.string().optional().default('openai-classification')
  })),
  asyncHandler(async (req, res) => {
    const { text, modelType } = req.body;
    
    logger.info('Sentiment analysis request', { 
      userId: req.user?.id, 
      modelType,
      textLength: text.length
    });

    const result = await inferenceEngine.analyzeSentiment(text, modelType);

    res.json({
      success: true,
      data: {
        sentiment: result.output,
        confidence: result.confidence,
        metadata: {
          modelId: result.metadata?.modelId,
          tokensUsed: result.metadata?.tokensUsed,
          responseTime: result.metadata?.responseTime
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /api/v1/ai/extract
 * @desc Extract information from text
 * @access Private
 */
router.post('/extract',
  authenticate,
  validateRequest(extractionSchema),
  asyncHandler(async (req, res) => {
    const { text, extractionType, modelType } = req.body;
    
    logger.info('Information extraction request', { 
      userId: req.user?.id, 
      modelType,
      extractionType,
      textLength: text.length
    });

    const result = await inferenceEngine.extractInformation(text, extractionType, modelType);

    res.json({
      success: true,
      data: {
        extractionType,
        result: result.output,
        metadata: {
          modelId: result.metadata?.modelId,
          tokensUsed: result.metadata?.tokensUsed,
          responseTime: result.metadata?.responseTime
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /api/v1/ai/batch
 * @desc Process multiple AI requests in batch
 * @access Private
 */
router.post('/batch',
  authenticate,
  validateRequest(batchInferenceSchema),
  asyncHandler(async (req, res) => {
    const { requests } = req.body;
    
    logger.info('Batch inference request', { 
      userId: req.user?.id, 
      requestCount: requests.length
    });

    const results = await inferenceEngine.batchInference(requests);

    // Calculate summary statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const totalTokens = results.reduce((sum, r) => sum + (r.metadata?.tokensUsed || 0), 0);
    const totalCost = results.reduce((sum, r) => sum + (r.metadata?.cost || 0), 0);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful,
          failed,
          totalTokens,
          totalCost,
          averageResponseTime: results.reduce((sum, r) => sum + (r.metadata?.responseTime || 0), 0) / results.length
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /api/v1/ai/models
 * @desc Get available AI models
 * @access Private
 */
router.get('/models',
  authenticate,
  asyncHandler(async (req, res) => {
    const models = await modelManager.listModels();
    const loadedModels = modelManager.getLoadedModels();

    const modelsWithStatus = models.map(model => ({
      ...model,
      isLoaded: loadedModels.includes(model.id),
      metrics: modelManager.getMetrics(model.id)
    }));

    res.json({
      success: true,
      data: {
        models: modelsWithStatus,
        loadedCount: loadedModels.length,
        totalCount: models.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /api/v1/ai/models/:modelId/load
 * @desc Load a specific AI model
 * @access Private (Admin only)
 */
router.post('/models/:modelId/load',
  authenticate,
  // TODO: Add admin role check
  asyncHandler(async (req, res) => {
    const { modelId } = req.params;
    
    logger.info('Model load request', { 
      userId: req.user?.id, 
      modelId
    });

    const model = await modelManager.loadModel(modelId);

    res.json({
      success: true,
      data: {
        modelId: model.id,
        loadedAt: model.loadedAt,
        memoryUsage: model.memoryUsage
      },
      message: `Model ${modelId} loaded successfully`,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route DELETE /api/v1/ai/models/:modelId/unload
 * @desc Unload a specific AI model
 * @access Private (Admin only)
 */
router.delete('/models/:modelId/unload',
  authenticate,
  // TODO: Add admin role check
  asyncHandler(async (req, res) => {
    const { modelId } = req.params;
    
    logger.info('Model unload request', { 
      userId: req.user?.id, 
      modelId
    });

    await modelManager.unloadModel(modelId);

    res.json({
      success: true,
      message: `Model ${modelId} unloaded successfully`,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /api/v1/ai/metrics
 * @desc Get AI/ML Engine performance metrics
 * @access Private
 */
router.get('/metrics',
  authenticate,
  asyncHandler(async (req, res) => {
    const allMetrics = modelManager.getAllMetrics();
    const loadedModels = modelManager.getLoadedModels();

    const metricsArray = Array.from(allMetrics.entries()).map(([modelId, metrics]) => ({
      modelId,
      ...metrics,
      isLoaded: loadedModels.includes(modelId)
    }));

    // Calculate aggregate metrics
    const totalRequests = metricsArray.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalSuccessful = metricsArray.reduce((sum, m) => sum + m.successfulRequests, 0);
    const totalTokens = metricsArray.reduce((sum, m) => sum + m.totalTokensUsed, 0);
    const overallSuccessRate = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0;

    res.json({
      success: true,
      data: {
        modelMetrics: metricsArray,
        aggregate: {
          totalRequests,
          totalSuccessful,
          totalTokens,
          overallSuccessRate,
          loadedModels: loadedModels.length
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /api/v1/ai/health
 * @desc Check AI/ML Engine health status
 * @access Private
 */
router.get('/health',
  authenticate,
  asyncHandler(async (req, res) => {
    const loadedModels = modelManager.getLoadedModels();
    
    const modelHealth = await Promise.all(
      loadedModels.map(async (modelId) => ({
        modelId,
        isHealthy: await modelManager.checkModelHealth(modelId),
        metrics: modelManager.getMetrics(modelId)
      }))
    );

    const healthyModels = modelHealth.filter(m => m.isHealthy).length;
    const overallHealth = loadedModels.length > 0 ? (healthyModels / loadedModels.length) * 100 : 100;

    res.json({
      success: true,
      data: {
        status: overallHealth >= 80 ? 'healthy' : overallHealth >= 50 ? 'degraded' : 'unhealthy',
        overallHealth,
        loadedModels: loadedModels.length,
        healthyModels,
        modelHealth
      },
      timestamp: new Date().toISOString()
    });
  })
);

export { router as aiRoutes };