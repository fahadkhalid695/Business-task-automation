import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ModelManager } from './ModelManager';
import { InferenceEngine } from './InferenceEngine';
import { TrainingPipeline } from './TrainingPipeline';
import { FeedbackCollector } from './FeedbackCollector';
import { ABTestManager } from './ABTestManager';
import { ModelDriftDetector } from './ModelDriftDetector';
import { FederatedLearningManager } from './FederatedLearningManager';
import { logger } from '../shared/utils/logger';
import { errorHandler } from '../shared/middleware/errorHandler';

const app = express();
const PORT = process.env.AI_ML_ENGINE_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Initialize AI/ML components
const modelManager = new ModelManager();
const inferenceEngine = new InferenceEngine(modelManager);
const trainingPipeline = new TrainingPipeline(modelManager);
const feedbackCollector = new FeedbackCollector();
const abTestManager = new ABTestManager(modelManager, inferenceEngine);
const driftDetector = new ModelDriftDetector(modelManager);
const federatedLearningManager = new FederatedLearningManager(modelManager);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ai-ml-engine',
    timestamp: new Date().toISOString(),
    models: modelManager.getLoadedModels()
  });
});

// Inference endpoints
app.post('/inference/text-generation', async (req, res, next) => {
  try {
    const { prompt, modelType = 'openai-gpt', options = {} } = req.body;
    const result = await inferenceEngine.generateText(prompt, modelType, options);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

app.post('/inference/classification', async (req, res, next) => {
  try {
    const { text, modelType, categories } = req.body;
    const result = await inferenceEngine.classify(text, modelType, categories);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

app.post('/inference/translation', async (req, res, next) => {
  try {
    const { text, sourceLang, targetLang, modelType = 'openai-translation' } = req.body;
    const result = await inferenceEngine.translate(text, sourceLang, targetLang, modelType);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

// Model management endpoints
app.get('/models', async (req, res, next) => {
  try {
    const models = await modelManager.listModels();
    res.json({ success: true, models });
  } catch (error) {
    next(error);
  }
});

app.post('/models/:modelId/load', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    await modelManager.loadModel(modelId);
    res.json({ success: true, message: `Model ${modelId} loaded successfully` });
  } catch (error) {
    next(error);
  }
});

app.delete('/models/:modelId/unload', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    await modelManager.unloadModel(modelId);
    res.json({ success: true, message: `Model ${modelId} unloaded successfully` });
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`AI/ML Engine service running on port ${PORT}`);
  
  // Initialize default models
  modelManager.initializeDefaultModels().catch(error => {
    logger.error('Failed to initialize default models:', error);
  });
});

// Training and continuous improvement endpoints
app.post('/training/start', async (req, res, next) => {
  try {
    const { config, createdBy } = req.body;
    const jobId = await trainingPipeline.startTraining(config, createdBy);
    res.json({ success: true, jobId });
  } catch (error) {
    next(error);
  }
});

app.get('/training/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await trainingPipeline.getTrainingJob(jobId);
    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
});

app.delete('/training/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    await trainingPipeline.cancelTrainingJob(jobId);
    res.json({ success: true, message: `Training job ${jobId} cancelled` });
  } catch (error) {
    next(error);
  }
});

app.post('/feedback', async (req, res, next) => {
  try {
    const feedback = req.body;
    const feedbackId = await feedbackCollector.submitFeedback(feedback);
    res.json({ success: true, feedbackId });
  } catch (error) {
    next(error);
  }
});

app.get('/feedback/:modelId/analytics', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { days = 30 } = req.query;
    const analytics = await feedbackCollector.getFeedbackAnalytics(modelId, Number(days));
    res.json({ success: true, analytics });
  } catch (error) {
    next(error);
  }
});

app.post('/abtest/create', async (req, res, next) => {
  try {
    const config = req.body;
    const testId = await abTestManager.createABTest(config);
    res.json({ success: true, testId });
  } catch (error) {
    next(error);
  }
});

app.post('/abtest/:testId/start', async (req, res, next) => {
  try {
    const { testId } = req.params;
    await abTestManager.startABTest(testId);
    res.json({ success: true, message: `A/B test ${testId} started` });
  } catch (error) {
    next(error);
  }
});

app.get('/abtest/:testId/result', async (req, res, next) => {
  try {
    const { testId } = req.params;
    const result = await abTestManager.getABTestResult(testId);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

app.post('/drift/monitor/start', async (req, res, next) => {
  try {
    const config = req.body;
    await driftDetector.startMonitoring(config);
    res.json({ success: true, message: `Drift monitoring started for model ${config.modelId}` });
  } catch (error) {
    next(error);
  }
});

app.get('/drift/:modelId/detect', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const driftMetrics = await driftDetector.detectDrift(modelId);
    res.json({ success: true, driftMetrics });
  } catch (error) {
    next(error);
  }
});

app.post('/federated/create', async (req, res, next) => {
  try {
    const { config, createdBy } = req.body;
    const sessionId = await federatedLearningManager.createFederatedSession(config, createdBy);
    res.json({ success: true, sessionId });
  } catch (error) {
    next(error);
  }
});

app.post('/federated/:sessionId/start', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await federatedLearningManager.startFederatedSession(sessionId);
    res.json({ success: true, message: `Federated learning session ${sessionId} started` });
  } catch (error) {
    next(error);
  }
});

export { 
  modelManager, 
  inferenceEngine, 
  trainingPipeline, 
  feedbackCollector, 
  abTestManager, 
  driftDetector, 
  federatedLearningManager 
};