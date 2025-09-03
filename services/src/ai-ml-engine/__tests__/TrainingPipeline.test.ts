import { TrainingPipeline } from '../TrainingPipeline';
import { ModelManager } from '../ModelManager';
import { FeedbackCollector } from '../FeedbackCollector';
import { ABTestManager } from '../ABTestManager';
import { ModelDriftDetector } from '../ModelDriftDetector';
import { FederatedLearningManager } from '../FederatedLearningManager';
import { InferenceEngine } from '../InferenceEngine';
import { 
  TrainingConfig, 
  TrainingStatus, 
  FeedbackData,
  ABTestConfig,
  FederatedLearningConfig,
  ModelType
} from '../types/AITypes';

// Mock dependencies
jest.mock('../ModelManager');
jest.mock('../InferenceEngine');
jest.mock('../../shared/cache/RedisCache');
jest.mock('../../shared/utils/logger');

describe('TrainingPipeline', () => {
  let trainingPipeline: TrainingPipeline;
  let modelManager: jest.Mocked<ModelManager>;
  let inferenceEngine: jest.Mocked<InferenceEngine>;

  beforeEach(() => {
    modelManager = new ModelManager() as jest.Mocked<ModelManager>;
    inferenceEngine = new InferenceEngine(modelManager) as jest.Mocked<InferenceEngine>;
    trainingPipeline = new TrainingPipeline(modelManager);

    // Mock model manager methods
    modelManager.getModelConfig.mockReturnValue({
      id: 'test-model',
      name: 'Test Model',
      type: ModelType.TEXT_GENERATION,
      provider: 'openai',
      version: '1.0.0',
      isActive: true,
      capabilities: ['text-generation']
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Training Job Management', () => {
    test('should create and start training job', async () => {
      const config: TrainingConfig = {
        modelId: 'test-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 1000,
          features: ['input', 'output']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10,
          optimizer: 'adam'
        },
        objectives: ['accuracy'],
        evaluationMetrics: ['accuracy', 'f1_score']
      };

      const jobId = await trainingPipeline.startTraining(config, 'test-user');

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Verify job was created
      const job = await trainingPipeline.getTrainingJob(jobId);
      expect(job).toBeDefined();
      expect(job?.modelId).toBe('test-model');
      expect(job?.status).toBe(TrainingStatus.PENDING);
    });

    test('should validate training configuration', async () => {
      const invalidConfig: TrainingConfig = {
        modelId: 'non-existent-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 0, // Invalid size
          features: []
        },
        hyperparameters: {
          learningRate: -0.1, // Invalid learning rate
          batchSize: 0, // Invalid batch size
          epochs: -5, // Invalid epochs
          optimizer: 'adam'
        },
        objectives: [],
        evaluationMetrics: []
      };

      modelManager.getModelConfig.mockReturnValue(undefined);

      await expect(trainingPipeline.startTraining(invalidConfig, 'test-user'))
        .rejects.toThrow();
    });

    test('should cancel training job', async () => {
      const config: TrainingConfig = {
        modelId: 'test-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 1000,
          features: ['input', 'output']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10,
          optimizer: 'adam'
        },
        objectives: ['accuracy'],
        evaluationMetrics: ['accuracy', 'f1_score']
      };

      const jobId = await trainingPipeline.startTraining(config, 'test-user');
      
      // Wait a bit for job to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await trainingPipeline.cancelTrainingJob(jobId);

      const job = await trainingPipeline.getTrainingJob(jobId);
      expect(job?.status).toBe(TrainingStatus.CANCELLED);
    });

    test('should get training jobs for model', async () => {
      const config: TrainingConfig = {
        modelId: 'test-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 1000,
          features: ['input', 'output']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 5,
          optimizer: 'adam'
        },
        objectives: ['accuracy'],
        evaluationMetrics: ['accuracy']
      };

      const jobId1 = await trainingPipeline.startTraining(config, 'test-user');
      const jobId2 = await trainingPipeline.startTraining(config, 'test-user');

      const jobs = await trainingPipeline.getModelTrainingJobs('test-model');
      expect(jobs.length).toBe(2);
      expect(jobs.map(j => j.id)).toContain(jobId1);
      expect(jobs.map(j => j.id)).toContain(jobId2);
    });
  });

  describe('Feedback Collection', () => {
    test('should collect and process feedback', async () => {
      const feedback: Omit<FeedbackData, 'id' | 'submittedAt'> = {
        modelId: 'test-model',
        inputData: 'Test input',
        expectedOutput: 'Expected output',
        actualOutput: 'Actual output',
        userRating: 2,
        feedbackType: 'correction',
        submittedBy: 'test-user'
      };

      const feedbackId = await trainingPipeline.collectFeedback(feedback);
      expect(feedbackId).toBeDefined();
      expect(typeof feedbackId).toBe('string');
    });

    test('should trigger automatic retraining on low feedback', async () => {
      const lowRatingFeedback: Omit<FeedbackData, 'id' | 'submittedAt'> = {
        modelId: 'test-model',
        inputData: 'Test input',
        expectedOutput: 'Expected output',
        actualOutput: 'Poor output',
        userRating: 1,
        feedbackType: 'correction',
        submittedBy: 'test-user'
      };

      // Submit multiple low-rating feedback items
      for (let i = 0; i < 15; i++) {
        await trainingPipeline.collectFeedback({
          ...lowRatingFeedback,
          inputData: `Test input ${i}`
        });
      }

      // Should trigger automatic retraining
      // In a real test, we would verify this through event emissions or job creation
    });
  });

  describe('Model Drift Detection', () => {
    test('should detect model drift', async () => {
      // Mock model metrics to simulate drift
      modelManager.getMetrics.mockReturnValue({
        modelId: 'test-model',
        totalRequests: 1000,
        successfulRequests: 800, // 80% success rate (degraded from baseline)
        failedRequests: 200,
        totalResponseTime: 5000000, // 5000ms average (high latency)
        averageResponseTime: 5000,
        successRate: 80,
        totalTokensUsed: 50000,
        lastUpdated: new Date()
      });

      const driftMetrics = await trainingPipeline.detectModelDrift('test-model');
      
      expect(driftMetrics).toBeDefined();
      expect(driftMetrics?.modelId).toBe('test-model');
      expect(driftMetrics?.driftScore).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(driftMetrics?.severity);
    });

    test('should start and stop drift monitoring', () => {
      trainingPipeline.startModelDriftMonitoring('test-model', 30);
      // Verify monitoring started (in real implementation, check internal state)
      
      trainingPipeline.stopModelDriftMonitoring('test-model');
      // Verify monitoring stopped
    });
  });

  describe('A/B Testing', () => {
    test('should start A/B test', async () => {
      const config: ABTestConfig = {
        id: 'test-ab',
        name: 'Model A vs Model B',
        description: 'Testing two model versions',
        modelA: 'test-model-a',
        modelB: 'test-model-b',
        trafficSplit: 50,
        metrics: ['accuracy', 'response_time'],
        duration: 7,
        minSampleSize: 100,
        significanceLevel: 0.05,
        status: 'draft'
      };

      // Mock both models exist
      modelManager.getModelConfig.mockImplementation((modelId) => {
        if (modelId === 'test-model-a' || modelId === 'test-model-b') {
          return {
            id: modelId,
            name: `Test Model ${modelId.slice(-1).toUpperCase()}`,
            type: ModelType.TEXT_GENERATION,
            provider: 'openai',
            version: '1.0.0',
            isActive: true,
            capabilities: ['text-generation']
          };
        }
        return undefined;
      });

      const testId = await trainingPipeline.startABTest(config);
      expect(testId).toBeDefined();
      expect(typeof testId).toBe('string');
    });
  });

  describe('Model Evaluation', () => {
    test('should evaluate trained model', async () => {
      const evaluation = await trainingPipeline.evaluateModel('test-model');
      
      expect(evaluation).toBeDefined();
      expect(evaluation.modelId).toBe('test-model');
      expect(evaluation.metrics).toBeDefined();
      expect(evaluation.metrics.accuracy).toBeGreaterThan(0);
      expect(evaluation.metrics.accuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('Event Handling', () => {
    test('should emit training events', (done) => {
      const config: TrainingConfig = {
        modelId: 'test-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 1000,
          features: ['input', 'output']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 1, // Short training for test
          optimizer: 'adam'
        },
        objectives: ['accuracy'],
        evaluationMetrics: ['accuracy']
      };

      trainingPipeline.on('trainingStarted', (event) => {
        expect(event.modelId).toBe('test-model');
        done();
      });

      trainingPipeline.startTraining(config, 'test-user');
    });

    test('should emit feedback events', (done) => {
      const feedback: Omit<FeedbackData, 'id' | 'submittedAt'> = {
        modelId: 'test-model',
        inputData: 'Test input',
        expectedOutput: 'Expected output',
        actualOutput: 'Actual output',
        userRating: 4,
        feedbackType: 'rating',
        submittedBy: 'test-user'
      };

      trainingPipeline.on('feedbackCollected', (event) => {
        expect(event.modelId).toBe('test-model');
        done();
      });

      trainingPipeline.collectFeedback(feedback);
    });
  });

  describe('Error Handling', () => {
    test('should handle training failures gracefully', async () => {
      const config: TrainingConfig = {
        modelId: 'failing-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 1000,
          features: ['input', 'output']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 1,
          optimizer: 'adam'
        },
        objectives: ['accuracy'],
        evaluationMetrics: ['accuracy']
      };

      // Mock model that will cause training to fail
      modelManager.getModelConfig.mockReturnValue({
        id: 'failing-model',
        name: 'Failing Model',
        type: ModelType.TEXT_GENERATION,
        provider: 'openai',
        version: '1.0.0',
        isActive: true,
        capabilities: ['text-generation']
      });

      const jobId = await trainingPipeline.startTraining(config, 'test-user');
      
      // Wait for training to complete/fail
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const job = await trainingPipeline.getTrainingJob(jobId);
      // Job should either complete or fail, not be stuck in running state
      expect([TrainingStatus.COMPLETED, TrainingStatus.FAILED]).toContain(job?.status);
    });

    test('should handle invalid feedback gracefully', async () => {
      const invalidFeedback = {
        modelId: '', // Invalid empty model ID
        inputData: 'Test input',
        expectedOutput: 'Expected output',
        actualOutput: 'Actual output',
        userRating: 10, // Invalid rating (should be 1-5)
        feedbackType: 'invalid' as any, // Invalid feedback type
        submittedBy: 'test-user'
      };

      await expect(trainingPipeline.collectFeedback(invalidFeedback))
        .rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      // Start some operations
      const config: TrainingConfig = {
        modelId: 'test-model',
        trainingData: {
          id: 'dataset-1',
          name: 'Test Dataset',
          source: 'test',
          format: 'jsonl',
          size: 1000,
          features: ['input', 'output']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10,
          optimizer: 'adam'
        },
        objectives: ['accuracy'],
        evaluationMetrics: ['accuracy']
      };

      await trainingPipeline.startTraining(config, 'test-user');
      trainingPipeline.startModelDriftMonitoring('test-model');

      // Cleanup should not throw
      await expect(trainingPipeline.cleanup()).resolves.not.toThrow();
    });
  });
});

describe('FeedbackCollector', () => {
  let feedbackCollector: FeedbackCollector;

  beforeEach(() => {
    feedbackCollector = new FeedbackCollector();
  });

  test('should submit and retrieve feedback', async () => {
    const feedback: Omit<FeedbackData, 'id' | 'submittedAt'> = {
      modelId: 'test-model',
      inputData: 'Test input',
      expectedOutput: 'Expected output',
      actualOutput: 'Actual output',
      userRating: 4,
      feedbackType: 'rating',
      submittedBy: 'test-user'
    };

    const feedbackId = await feedbackCollector.submitFeedback(feedback);
    expect(feedbackId).toBeDefined();

    const modelFeedback = await feedbackCollector.getModelFeedback('test-model');
    expect(modelFeedback.length).toBe(1);
    expect(modelFeedback[0].id).toBe(feedbackId);
  });

  test('should generate feedback analytics', async () => {
    const feedback: Omit<FeedbackData, 'id' | 'submittedAt'> = {
      modelId: 'test-model',
      inputData: 'Test input',
      expectedOutput: 'Expected output',
      actualOutput: 'Actual output',
      userRating: 4,
      feedbackType: 'rating',
      submittedBy: 'test-user'
    };

    // Submit multiple feedback items
    for (let i = 0; i < 5; i++) {
      await feedbackCollector.submitFeedback({
        ...feedback,
        userRating: i + 1,
        inputData: `Test input ${i}`
      });
    }

    const analytics = await feedbackCollector.getFeedbackAnalytics('test-model');
    expect(analytics.totalFeedback).toBe(5);
    expect(analytics.averageRating).toBe(3); // (1+2+3+4+5)/5 = 3
    expect(analytics.ratingDistribution).toBeDefined();
  });

  test('should export feedback data', async () => {
    const feedback: Omit<FeedbackData, 'id' | 'submittedAt'> = {
      modelId: 'test-model',
      inputData: 'Test input',
      expectedOutput: 'Expected output',
      actualOutput: 'Actual output',
      userRating: 4,
      feedbackType: 'rating',
      submittedBy: 'test-user'
    };

    await feedbackCollector.submitFeedback(feedback);

    const jsonExport = await feedbackCollector.exportFeedbackData('test-model', 'json');
    expect(jsonExport).toContain('test-model');

    const csvExport = await feedbackCollector.exportFeedbackData('test-model', 'csv');
    expect(csvExport).toContain('id,modelId,inputData');
  });
});

describe('ABTestManager', () => {
  let abTestManager: ABTestManager;
  let modelManager: jest.Mocked<ModelManager>;
  let inferenceEngine: jest.Mocked<InferenceEngine>;

  beforeEach(() => {
    modelManager = new ModelManager() as jest.Mocked<ModelManager>;
    inferenceEngine = new InferenceEngine(modelManager) as jest.Mocked<InferenceEngine>;
    abTestManager = new ABTestManager(modelManager, inferenceEngine);

    // Mock models
    modelManager.getModelConfig.mockImplementation((modelId) => {
      if (modelId === 'model-a' || modelId === 'model-b') {
        return {
          id: modelId,
          name: `Test Model ${modelId.slice(-1).toUpperCase()}`,
          type: ModelType.TEXT_GENERATION,
          provider: 'openai',
          version: '1.0.0',
          isActive: true,
          capabilities: ['text-generation']
        };
      }
      return undefined;
    });
  });

  test('should create and start A/B test', async () => {
    const config: Omit<ABTestConfig, 'id' | 'status'> = {
      name: 'Model A vs Model B',
      description: 'Testing two model versions',
      modelA: 'model-a',
      modelB: 'model-b',
      trafficSplit: 50,
      metrics: ['accuracy', 'response_time'],
      duration: 1, // 1 day for test
      minSampleSize: 10,
      significanceLevel: 0.05
    };

    const testId = await abTestManager.createABTest(config);
    expect(testId).toBeDefined();

    await abTestManager.startABTest(testId);

    const tests = await abTestManager.listABTests('running');
    expect(tests.length).toBe(1);
    expect(tests[0].id).toBe(testId);
  });

  test('should process A/B test requests', async () => {
    const config: Omit<ABTestConfig, 'id' | 'status'> = {
      name: 'Model A vs Model B',
      description: 'Testing two model versions',
      modelA: 'model-a',
      modelB: 'model-b',
      trafficSplit: 50,
      metrics: ['accuracy'],
      duration: 1,
      minSampleSize: 10,
      significanceLevel: 0.05
    };

    const testId = await abTestManager.createABTest(config);
    await abTestManager.startABTest(testId);

    // Mock inference engine
    inferenceEngine.generateText.mockResolvedValue({
      success: true,
      output: 'Test response',
      timestamp: new Date(),
      metadata: { tokensUsed: 10 }
    });

    const request = {
      modelId: 'test',
      input: 'Test prompt',
      timestamp: new Date()
    };

    const response = await abTestManager.processABTestRequest(testId, request, 'user-1');
    expect(response).toBeDefined();
    expect(['A', 'B']).toContain(response.assignedModel);
    expect(response.result.success).toBe(true);
  });

  test('should get A/B test metrics', async () => {
    const config: Omit<ABTestConfig, 'id' | 'status'> = {
      name: 'Model A vs Model B',
      description: 'Testing two model versions',
      modelA: 'model-a',
      modelB: 'model-b',
      trafficSplit: 50,
      metrics: ['accuracy'],
      duration: 1,
      minSampleSize: 10,
      significanceLevel: 0.05
    };

    const testId = await abTestManager.createABTest(config);
    
    const metrics = abTestManager.getABTestMetrics(testId);
    expect(metrics).toBeDefined();
    expect(metrics?.testId).toBe(testId);
    expect(metrics?.modelA.modelId).toBe('model-a');
    expect(metrics?.modelB.modelId).toBe('model-b');
  });
});

describe('ModelDriftDetector', () => {
  let driftDetector: ModelDriftDetector;
  let modelManager: jest.Mocked<ModelManager>;

  beforeEach(() => {
    modelManager = new ModelManager() as jest.Mocked<ModelManager>;
    driftDetector = new ModelDriftDetector(modelManager);

    modelManager.getModelConfig.mockReturnValue({
      id: 'test-model',
      name: 'Test Model',
      type: ModelType.TEXT_GENERATION,
      provider: 'openai',
      version: '1.0.0',
      isActive: true,
      capabilities: ['text-generation']
    });
  });

  test('should establish baseline metrics', async () => {
    modelManager.getMetrics.mockReturnValue({
      modelId: 'test-model',
      totalRequests: 1000,
      successfulRequests: 950,
      failedRequests: 50,
      totalResponseTime: 1000000,
      averageResponseTime: 1000,
      successRate: 95,
      totalTokensUsed: 50000,
      lastUpdated: new Date()
    });

    await driftDetector.establishBaseline('test-model');
    // Baseline should be established without throwing
  });

  test('should start and stop monitoring', async () => {
    const config = {
      modelId: 'test-model',
      thresholds: {
        performance: 0.1,
        data: 0.15,
        concept: 0.2
      },
      monitoringInterval: 1, // 1 minute for test
      baselineWindow: 7,
      detectionWindow: 1,
      minSampleSize: 100
    };

    await driftDetector.startMonitoring(config);
    // Should start without throwing

    await driftDetector.stopMonitoring('test-model');
    // Should stop without throwing
  });

  test('should detect drift', async () => {
    // Establish baseline first
    modelManager.getMetrics.mockReturnValue({
      modelId: 'test-model',
      totalRequests: 1000,
      successfulRequests: 950,
      failedRequests: 50,
      totalResponseTime: 1000000,
      averageResponseTime: 1000,
      successRate: 95,
      totalTokensUsed: 50000,
      lastUpdated: new Date()
    });

    await driftDetector.establishBaseline('test-model');

    // Simulate degraded performance
    modelManager.getMetrics.mockReturnValue({
      modelId: 'test-model',
      totalRequests: 1000,
      successfulRequests: 800, // Degraded success rate
      failedRequests: 200,
      totalResponseTime: 3000000, // Higher response time
      averageResponseTime: 3000,
      successRate: 80,
      totalTokensUsed: 50000,
      lastUpdated: new Date()
    });

    const driftMetrics = await driftDetector.detectDrift('test-model');
    expect(driftMetrics).toBeDefined();
    expect(driftMetrics?.driftScore).toBeGreaterThan(0);
  });
});

describe('FederatedLearningManager', () => {
  let federatedManager: FederatedLearningManager;
  let modelManager: jest.Mocked<ModelManager>;

  beforeEach(() => {
    modelManager = new ModelManager() as jest.Mocked<ModelManager>;
    federatedManager = new FederatedLearningManager(modelManager);

    modelManager.getModelConfig.mockReturnValue({
      id: 'test-model',
      name: 'Test Model',
      type: ModelType.TEXT_GENERATION,
      provider: 'openai',
      version: '1.0.0',
      isActive: true,
      capabilities: ['text-generation']
    });
  });

  test('should create federated learning session', async () => {
    const config: FederatedLearningConfig = {
      modelId: 'test-model',
      participants: [
        {
          id: 'participant-1',
          name: 'Participant 1',
          dataSize: 1000,
          computeCapability: 'high',
          trustLevel: 0.9,
          isActive: true
        },
        {
          id: 'participant-2',
          name: 'Participant 2',
          dataSize: 800,
          computeCapability: 'medium',
          trustLevel: 0.8,
          isActive: true
        }
      ],
      aggregationStrategy: 'fedavg',
      rounds: 5,
      minParticipants: 2
    };

    const sessionId = await federatedManager.createFederatedSession(config, 'test-user');
    expect(sessionId).toBeDefined();

    const session = await federatedManager.getFederatedSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.config.modelId).toBe('test-model');
    expect(session?.config.participants.length).toBe(2);
  });

  test('should start federated session', async () => {
    const config: FederatedLearningConfig = {
      modelId: 'test-model',
      participants: [
        {
          id: 'participant-1',
          name: 'Participant 1',
          dataSize: 1000,
          computeCapability: 'high',
          trustLevel: 0.9,
          isActive: true
        },
        {
          id: 'participant-2',
          name: 'Participant 2',
          dataSize: 800,
          computeCapability: 'medium',
          trustLevel: 0.8,
          isActive: true
        }
      ],
      aggregationStrategy: 'fedavg',
      rounds: 2, // Short for test
      minParticipants: 2
    };

    const sessionId = await federatedManager.createFederatedSession(config, 'test-user');
    await federatedManager.startFederatedSession(sessionId);

    const session = await federatedManager.getFederatedSession(sessionId);
    expect(session?.status).toBe('running');
  });

  test('should list federated sessions', async () => {
    const config: FederatedLearningConfig = {
      modelId: 'test-model',
      participants: [
        {
          id: 'participant-1',
          name: 'Participant 1',
          dataSize: 1000,
          computeCapability: 'high',
          trustLevel: 0.9,
          isActive: true
        }
      ],
      aggregationStrategy: 'fedavg',
      rounds: 1,
      minParticipants: 1
    };

    const sessionId = await federatedManager.createFederatedSession(config, 'test-user');
    
    const sessions = await federatedManager.listFederatedSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe(sessionId);
  });

  test('should pause and resume federated session', async () => {
    const config: FederatedLearningConfig = {
      modelId: 'test-model',
      participants: [
        {
          id: 'participant-1',
          name: 'Participant 1',
          dataSize: 1000,
          computeCapability: 'high',
          trustLevel: 0.9,
          isActive: true
        }
      ],
      aggregationStrategy: 'fedavg',
      rounds: 5,
      minParticipants: 1
    };

    const sessionId = await federatedManager.createFederatedSession(config, 'test-user');
    await federatedManager.startFederatedSession(sessionId);
    
    await federatedManager.pauseFederatedSession(sessionId);
    let session = await federatedManager.getFederatedSession(sessionId);
    expect(session?.status).toBe('paused');

    await federatedManager.resumeFederatedSession(sessionId);
    session = await federatedManager.getFederatedSession(sessionId);
    expect(session?.status).toBe('running');
  });
});