import { logger } from '../shared/utils/logger';
import { RedisCache } from '../shared/cache/RedisCache';
import { ModelManager } from './ModelManager';
import { 
  TrainingConfig, 
  TrainingJob, 
  TrainingStatus, 
  ModelEvaluation,
  TrainingMetrics,
  TrainingLog,
  ModelCheckpoint,
  FeedbackData,
  ModelDriftMetrics,
  ABTestConfig,
  ABTestResult,
  FederatedLearningConfig,
  TrainingDataset,
  ModelPerformanceMetrics
} from './types/AITypes';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class TrainingPipeline extends EventEmitter {
  private modelManager: ModelManager;
  private cache: RedisCache;
  private activeJobs: Map<string, TrainingJob> = new Map();
  private feedbackBuffer: Map<string, FeedbackData[]> = new Map();
  private driftMonitors: Map<string, NodeJS.Timeout> = new Map();
  private abTests: Map<string, ABTestConfig> = new Map();

  constructor(modelManager: ModelManager) {
    super();
    this.modelManager = modelManager;
    this.cache = new RedisCache();
    this.initializePipeline();
  }

  /**
   * Initialize the training pipeline
   */
  private async initializePipeline(): Promise<void> {
    try {
      // Load existing training jobs from cache
      await this.loadActiveJobs();
      
      // Start drift monitoring for active models
      await this.startDriftMonitoring();
      
      logger.info('Training pipeline initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize training pipeline:', error);
      throw error;
    }
  }

  /**
   * Create and start a new training job
   */
  async startTraining(config: TrainingConfig, createdBy: string): Promise<string> {
    try {
      const jobId = uuidv4();
      
      // Validate training configuration
      await this.validateTrainingConfig(config);
      
      // Create training job
      const job: TrainingJob = {
        id: jobId,
        modelId: config.modelId,
        config,
        status: TrainingStatus.PENDING,
        progress: 0,
        logs: [],
        checkpoints: [],
        createdBy,
        createdAt: new Date()
      };

      // Store job
      this.activeJobs.set(jobId, job);
      await this.cache.set(`training:job:${jobId}`, JSON.stringify(job), 86400);

      // Start training process
      this.executeTraining(job);

      logger.info(`Training job ${jobId} started for model ${config.modelId}`);
      this.emit('trainingStarted', { jobId, modelId: config.modelId });

      return jobId;
    } catch (error) {
      logger.error('Failed to start training:', error);
      throw error;
    }
  }

  /**
   * Execute the training process
   */
  private async executeTraining(job: TrainingJob): Promise<void> {
    try {
      // Update job status
      job.status = TrainingStatus.RUNNING;
      job.startTime = new Date();
      await this.updateJob(job);

      this.addLog(job, 'info', 'Training started');

      // Simulate training process (in real implementation, this would call actual ML training)
      await this.simulateTraining(job);

      // Complete training
      job.status = TrainingStatus.COMPLETED;
      job.endTime = new Date();
      job.progress = 100;
      await this.updateJob(job);

      this.addLog(job, 'info', 'Training completed successfully');
      this.emit('trainingCompleted', { jobId: job.id, modelId: job.modelId });

      // Evaluate the trained model
      await this.evaluateModel(job.modelId, job.id);

    } catch (error) {
      job.status = TrainingStatus.FAILED;
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();
      await this.updateJob(job);

      this.addLog(job, 'error', `Training failed: ${job.error}`);
      this.emit('trainingFailed', { jobId: job.id, modelId: job.modelId, error: job.error });

      logger.error(`Training job ${job.id} failed:`, error);
    }
  }

  /**
   * Simulate training process (replace with actual ML training logic)
   */
  private async simulateTraining(job: TrainingJob): Promise<void> {
    const epochs = job.config.hyperparameters.epochs;
    
    for (let epoch = 1; epoch <= epochs; epoch++) {
      // Simulate epoch training
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate training time
      
      // Generate mock metrics
      const metrics: TrainingMetrics = {
        epoch,
        trainingLoss: Math.max(0.1, 2.0 - (epoch * 0.1) + (Math.random() * 0.2 - 0.1)),
        validationLoss: Math.max(0.15, 2.2 - (epoch * 0.1) + (Math.random() * 0.3 - 0.15)),
        accuracy: Math.min(0.95, 0.5 + (epoch * 0.05) + (Math.random() * 0.1 - 0.05)),
        f1Score: Math.min(0.92, 0.45 + (epoch * 0.05) + (Math.random() * 0.1 - 0.05)),
        timestamp: new Date()
      };

      job.metrics = metrics;
      job.progress = (epoch / epochs) * 100;

      // Create checkpoint every 5 epochs
      if (epoch % 5 === 0) {
        const checkpoint: ModelCheckpoint = {
          id: uuidv4(),
          modelId: job.modelId,
          trainingJobId: job.id,
          epoch,
          metrics,
          filePath: `/checkpoints/${job.modelId}/epoch_${epoch}.ckpt`,
          size: Math.floor(Math.random() * 1000000) + 500000, // Random size
          createdAt: new Date()
        };
        
        job.checkpoints.push(checkpoint);
        this.addLog(job, 'info', `Checkpoint saved at epoch ${epoch}`);
      }

      await this.updateJob(job);
      this.addLog(job, 'info', `Epoch ${epoch}/${epochs} completed - Loss: ${metrics.trainingLoss.toFixed(4)}, Accuracy: ${metrics.accuracy?.toFixed(4)}`);

      // Check for early stopping
      if (job.config.earlyStoppingConfig && this.shouldEarlyStop(job)) {
        this.addLog(job, 'info', `Early stopping triggered at epoch ${epoch}`);
        break;
      }
    }
  }

  /**
   * Check if early stopping should be triggered
   */
  private shouldEarlyStop(job: TrainingJob): boolean {
    const config = job.config.earlyStoppingConfig;
    if (!config || job.checkpoints.length < config.patience) {
      return false;
    }

    const recentCheckpoints = job.checkpoints.slice(-config.patience);
    const metricValues = recentCheckpoints.map(cp => {
      const metrics = cp.metrics as any;
      return metrics[config.metric] || 0;
    });

    // Check if improvement is less than minDelta for patience epochs
    let noImprovement = 0;
    for (let i = 1; i < metricValues.length; i++) {
      if (Math.abs(metricValues[i] - metricValues[i-1]) < config.minDelta) {
        noImprovement++;
      }
    }

    return noImprovement >= config.patience - 1;
  }

  /**
   * Collect feedback for model improvement
   */
  async collectFeedback(feedback: Omit<FeedbackData, 'id' | 'submittedAt'>): Promise<string> {
    try {
      const feedbackData: FeedbackData = {
        ...feedback,
        id: uuidv4(),
        submittedAt: new Date()
      };

      // Store feedback
      await this.cache.set(`feedback:${feedbackData.id}`, JSON.stringify(feedbackData), 86400 * 30);

      // Add to buffer for batch processing
      if (!this.feedbackBuffer.has(feedback.modelId)) {
        this.feedbackBuffer.set(feedback.modelId, []);
      }
      this.feedbackBuffer.get(feedback.modelId)!.push(feedbackData);

      // Check if we have enough feedback to trigger retraining
      await this.checkRetrainingTrigger(feedback.modelId);

      logger.info(`Feedback collected for model ${feedback.modelId}: ${feedbackData.id}`);
      this.emit('feedbackCollected', { modelId: feedback.modelId, feedbackId: feedbackData.id });

      return feedbackData.id;
    } catch (error) {
      logger.error('Failed to collect feedback:', error);
      throw error;
    }
  }

  /**
   * Check if model should be retrained based on feedback
   */
  private async checkRetrainingTrigger(modelId: string): Promise<void> {
    const feedback = this.feedbackBuffer.get(modelId) || [];
    
    // Trigger retraining if we have enough negative feedback
    const recentFeedback = feedback.filter(f => 
      Date.now() - f.submittedAt.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    const averageRating = recentFeedback.reduce((sum, f) => sum + f.userRating, 0) / recentFeedback.length;
    
    if (recentFeedback.length >= 10 && averageRating < 3.0) {
      logger.info(`Triggering automatic retraining for model ${modelId} due to low feedback ratings`);
      await this.triggerAutomaticRetraining(modelId, 'low_feedback_ratings');
    }
  }

  /**
   * Trigger automatic retraining
   */
  async triggerAutomaticRetraining(modelId: string, reason: string): Promise<string> {
    try {
      // Get model configuration
      const modelConfig = this.modelManager.getModelConfig(modelId);
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelId}`);
      }

      // Create enhanced training config based on feedback
      const trainingConfig: TrainingConfig = {
        modelId,
        trainingData: await this.prepareTrainingDataWithFeedback(modelId),
        hyperparameters: {
          learningRate: 0.0001, // Lower learning rate for fine-tuning
          batchSize: 16,
          epochs: 10,
          optimizer: 'adam'
        },
        objectives: ['improve_user_satisfaction', 'reduce_error_rate'],
        evaluationMetrics: ['accuracy', 'f1_score', 'user_rating']
      };

      const jobId = await this.startTraining(trainingConfig, 'system_automatic');
      
      logger.info(`Automatic retraining triggered for model ${modelId}, reason: ${reason}, job: ${jobId}`);
      this.emit('automaticRetrainingTriggered', { modelId, reason, jobId });

      return jobId;
    } catch (error) {
      logger.error(`Failed to trigger automatic retraining for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Prepare training data enhanced with feedback
   */
  private async prepareTrainingDataWithFeedback(modelId: string): Promise<TrainingDataset> {
    const feedback = this.feedbackBuffer.get(modelId) || [];
    
    // In a real implementation, this would process feedback into training examples
    return {
      id: uuidv4(),
      name: `${modelId}_feedback_enhanced_dataset`,
      source: 'feedback_collection',
      format: 'jsonl',
      size: feedback.length,
      features: ['input', 'expected_output', 'user_rating'],
      labels: ['corrected_output'],
      metadata: {
        feedbackCount: feedback.length,
        averageRating: feedback.reduce((sum, f) => sum + f.userRating, 0) / feedback.length,
        createdAt: new Date()
      }
    };
  }

  /**
   * Start A/B testing between two models
   */
  async startABTest(config: ABTestConfig): Promise<string> {
    try {
      // Validate models exist
      const modelA = this.modelManager.getModelConfig(config.modelA);
      const modelB = this.modelManager.getModelConfig(config.modelB);
      
      if (!modelA || !modelB) {
        throw new Error('One or both models not found for A/B testing');
      }

      config.status = 'running';
      this.abTests.set(config.id, config);
      
      // Store in cache
      await this.cache.set(`abtest:${config.id}`, JSON.stringify(config), config.duration * 24 * 60 * 60);

      // Schedule test completion
      setTimeout(() => {
        this.completeABTest(config.id);
      }, config.duration * 24 * 60 * 60 * 1000);

      logger.info(`A/B test started: ${config.id} (${config.modelA} vs ${config.modelB})`);
      this.emit('abTestStarted', { testId: config.id, modelA: config.modelA, modelB: config.modelB });

      return config.id;
    } catch (error) {
      logger.error('Failed to start A/B test:', error);
      throw error;
    }
  }

  /**
   * Complete A/B test and analyze results
   */
  private async completeABTest(testId: string): Promise<void> {
    try {
      const config = this.abTests.get(testId);
      if (!config) {
        throw new Error(`A/B test configuration not found: ${testId}`);
      }

      // Simulate collecting test results (in real implementation, get from metrics)
      const result: ABTestResult = {
        testId,
        modelA: {
          modelId: config.modelA,
          sampleSize: Math.floor(Math.random() * 1000) + 500,
          metrics: {
            accuracy: 0.85 + Math.random() * 0.1,
            responseTime: 200 + Math.random() * 100,
            userSatisfaction: 4.0 + Math.random() * 0.8
          }
        },
        modelB: {
          modelId: config.modelB,
          sampleSize: Math.floor(Math.random() * 1000) + 500,
          metrics: {
            accuracy: 0.87 + Math.random() * 0.1,
            responseTime: 180 + Math.random() * 100,
            userSatisfaction: 4.2 + Math.random() * 0.6
          }
        },
        statisticalSignificance: {
          accuracy: { pValue: 0.03, isSignificant: true, confidenceInterval: [0.01, 0.05] },
          responseTime: { pValue: 0.15, isSignificant: false, confidenceInterval: [-10, 50] },
          userSatisfaction: { pValue: 0.02, isSignificant: true, confidenceInterval: [0.05, 0.35] }
        },
        winner: 'B',
        completedAt: new Date()
      };

      // Store results
      await this.cache.set(`abtest:result:${testId}`, JSON.stringify(result), 86400 * 30);

      config.status = 'completed';
      this.abTests.set(testId, config);

      logger.info(`A/B test completed: ${testId}, winner: Model ${result.winner}`);
      this.emit('abTestCompleted', { testId, result });

    } catch (error) {
      logger.error(`Failed to complete A/B test ${testId}:`, error);
    }
  }

  /**
   * Detect model drift
   */
  async detectModelDrift(modelId: string): Promise<ModelDriftMetrics | null> {
    try {
      const model = this.modelManager.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      const metrics = this.modelManager.getMetrics(modelId);
      if (!metrics) {
        return null;
      }

      // Calculate drift score based on performance degradation
      const baselineSuccessRate = 95; // Expected baseline
      const currentSuccessRate = metrics.successRate;
      const performanceDrift = (baselineSuccessRate - currentSuccessRate) / baselineSuccessRate;

      const baselineResponseTime = 1000; // Expected baseline in ms
      const currentResponseTime = metrics.averageResponseTime;
      const latencyDrift = Math.max(0, (currentResponseTime - baselineResponseTime) / baselineResponseTime);

      const driftScore = Math.max(performanceDrift, latencyDrift);

      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (driftScore > 0.3) severity = 'critical';
      else if (driftScore > 0.2) severity = 'high';
      else if (driftScore > 0.1) severity = 'medium';

      const driftMetrics: ModelDriftMetrics = {
        modelId,
        driftScore,
        driftType: performanceDrift > latencyDrift ? 'performance' : 'data',
        detectedAt: new Date(),
        threshold: 0.1,
        severity,
        recommendedActions: this.getRecommendedActions(severity, driftScore)
      };

      // Store drift metrics
      await this.cache.set(`drift:${modelId}:${Date.now()}`, JSON.stringify(driftMetrics), 86400 * 7);

      if (severity === 'high' || severity === 'critical') {
        logger.warn(`Model drift detected for ${modelId}: ${severity} severity (score: ${driftScore.toFixed(3)})`);
        this.emit('modelDriftDetected', driftMetrics);
        
        // Trigger automatic retraining for critical drift
        if (severity === 'critical') {
          await this.triggerAutomaticRetraining(modelId, 'critical_model_drift');
        }
      }

      return driftMetrics;
    } catch (error) {
      logger.error(`Failed to detect model drift for ${modelId}:`, error);
      return null;
    }
  }

  /**
   * Get recommended actions based on drift severity
   */
  private getRecommendedActions(severity: string, driftScore: number): string[] {
    const actions: string[] = [];

    switch (severity) {
      case 'critical':
        actions.push('Immediate retraining required');
        actions.push('Consider rolling back to previous model version');
        actions.push('Investigate data quality issues');
        actions.push('Review model architecture');
        break;
      case 'high':
        actions.push('Schedule retraining within 24 hours');
        actions.push('Increase monitoring frequency');
        actions.push('Collect additional training data');
        break;
      case 'medium':
        actions.push('Schedule retraining within 1 week');
        actions.push('Monitor performance trends');
        actions.push('Review recent data changes');
        break;
      case 'low':
        actions.push('Continue monitoring');
        actions.push('Consider data collection improvements');
        break;
    }

    return actions;
  }

  /**
   * Start drift monitoring for all active models
   */
  private async startDriftMonitoring(): Promise<void> {
    const models = await this.modelManager.listModels();
    
    for (const model of models) {
      if (model.isActive) {
        this.startModelDriftMonitoring(model.id);
      }
    }
  }

  /**
   * Start drift monitoring for a specific model
   */
  startModelDriftMonitoring(modelId: string, intervalMinutes: number = 60): void {
    // Clear existing monitor
    if (this.driftMonitors.has(modelId)) {
      clearInterval(this.driftMonitors.get(modelId)!);
    }

    // Start new monitor
    const monitor = setInterval(async () => {
      await this.detectModelDrift(modelId);
    }, intervalMinutes * 60 * 1000);

    this.driftMonitors.set(modelId, monitor);
    logger.info(`Drift monitoring started for model ${modelId} (interval: ${intervalMinutes} minutes)`);
  }

  /**
   * Stop drift monitoring for a model
   */
  stopModelDriftMonitoring(modelId: string): void {
    const monitor = this.driftMonitors.get(modelId);
    if (monitor) {
      clearInterval(monitor);
      this.driftMonitors.delete(modelId);
      logger.info(`Drift monitoring stopped for model ${modelId}`);
    }
  }

  /**
   * Evaluate a trained model
   */
  async evaluateModel(modelId: string, trainingJobId?: string): Promise<ModelEvaluation> {
    try {
      // Create test dataset (in real implementation, use actual test data)
      const testDataset: TrainingDataset = {
        id: uuidv4(),
        name: `${modelId}_test_dataset`,
        source: 'evaluation_suite',
        format: 'jsonl',
        size: 1000,
        features: ['input'],
        labels: ['expected_output']
      };

      // Simulate evaluation metrics
      const metrics: ModelPerformanceMetrics = {
        accuracy: 0.85 + Math.random() * 0.1,
        precision: 0.82 + Math.random() * 0.1,
        recall: 0.88 + Math.random() * 0.1,
        f1Score: 0.85 + Math.random() * 0.1,
        latency: 150 + Math.random() * 100,
        throughput: 100 + Math.random() * 50,
        errorRate: Math.random() * 0.05,
        costEfficiency: 0.8 + Math.random() * 0.2
      };

      const evaluation: ModelEvaluation = {
        id: uuidv4(),
        modelId,
        version: '1.0.0',
        testDataset,
        metrics,
        benchmarkResults: [
          { benchmarkName: 'GLUE', score: 0.85, details: {}, comparisonBaseline: 0.80 },
          { benchmarkName: 'Custom Business Metrics', score: 0.92, details: {} }
        ],
        evaluatedAt: new Date(),
        evaluatedBy: trainingJobId ? 'training_pipeline' : 'manual_evaluation'
      };

      // Store evaluation
      await this.cache.set(`evaluation:${evaluation.id}`, JSON.stringify(evaluation), 86400 * 30);

      logger.info(`Model evaluation completed for ${modelId}: F1=${metrics.f1Score?.toFixed(3)}, Accuracy=${metrics.accuracy?.toFixed(3)}`);
      this.emit('modelEvaluated', { modelId, evaluationId: evaluation.id, metrics });

      return evaluation;
    } catch (error) {
      logger.error(`Failed to evaluate model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get training job status
   */
  async getTrainingJob(jobId: string): Promise<TrainingJob | null> {
    try {
      // Check active jobs first
      if (this.activeJobs.has(jobId)) {
        return this.activeJobs.get(jobId)!;
      }

      // Check cache
      const cached = await this.cache.get(`training:job:${jobId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get training job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * List all training jobs for a model
   */
  async getModelTrainingJobs(modelId: string): Promise<TrainingJob[]> {
    try {
      const jobs: TrainingJob[] = [];
      
      // Get from active jobs
      for (const job of this.activeJobs.values()) {
        if (job.modelId === modelId) {
          jobs.push(job);
        }
      }

      // TODO: In real implementation, query database for historical jobs
      
      return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error(`Failed to get training jobs for model ${modelId}:`, error);
      return [];
    }
  }

  /**
   * Cancel a training job
   */
  async cancelTrainingJob(jobId: string): Promise<void> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) {
        throw new Error(`Training job not found: ${jobId}`);
      }

      if (job.status !== TrainingStatus.RUNNING && job.status !== TrainingStatus.PENDING) {
        throw new Error(`Cannot cancel job in status: ${job.status}`);
      }

      job.status = TrainingStatus.CANCELLED;
      job.endTime = new Date();
      await this.updateJob(job);

      this.addLog(job, 'info', 'Training job cancelled by user');
      this.emit('trainingCancelled', { jobId, modelId: job.modelId });

      logger.info(`Training job cancelled: ${jobId}`);
    } catch (error) {
      logger.error(`Failed to cancel training job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Validate training configuration
   */
  private async validateTrainingConfig(config: TrainingConfig): Promise<void> {
    // Check if model exists
    const modelConfig = this.modelManager.getModelConfig(config.modelId);
    if (!modelConfig) {
      throw new Error(`Model not found: ${config.modelId}`);
    }

    // Validate hyperparameters
    if (config.hyperparameters.learningRate <= 0 || config.hyperparameters.learningRate > 1) {
      throw new Error('Learning rate must be between 0 and 1');
    }

    if (config.hyperparameters.batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }

    if (config.hyperparameters.epochs <= 0) {
      throw new Error('Epochs must be positive');
    }

    // Validate training data
    if (!config.trainingData || config.trainingData.size === 0) {
      throw new Error('Training data is required and must not be empty');
    }
  }

  /**
   * Load active jobs from cache
   */
  private async loadActiveJobs(): Promise<void> {
    try {
      // In real implementation, load from database
      logger.info('Active training jobs loaded from storage');
    } catch (error) {
      logger.error('Failed to load active jobs:', error);
    }
  }

  /**
   * Update job in storage
   */
  private async updateJob(job: TrainingJob): Promise<void> {
    this.activeJobs.set(job.id, job);
    await this.cache.set(`training:job:${job.id}`, JSON.stringify(job), 86400);
  }

  /**
   * Add log entry to job
   */
  private addLog(job: TrainingJob, level: 'info' | 'warning' | 'error' | 'debug', message: string): void {
    job.logs.push({
      timestamp: new Date(),
      level,
      message,
      metadata: {}
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop all drift monitors
    for (const [modelId, monitor] of this.driftMonitors) {
      clearInterval(monitor);
    }
    this.driftMonitors.clear();

    // Cancel active training jobs
    for (const job of this.activeJobs.values()) {
      if (job.status === TrainingStatus.RUNNING || job.status === TrainingStatus.PENDING) {
        await this.cancelTrainingJob(job.id);
      }
    }

    logger.info('Training pipeline cleanup completed');
  }
}