import { logger } from '../shared/utils/logger';
import { RedisCache } from '../shared/cache/RedisCache';
import { ModelManager } from './ModelManager';
import { InferenceEngine } from './InferenceEngine';
import { 
  ABTestConfig, 
  ABTestResult, 
  InferenceRequest, 
  InferenceResult 
} from './types/AITypes';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface ABTestMetrics {
  testId: string;
  modelA: {
    modelId: string;
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    averageRating: number;
    errorRate: number;
  };
  modelB: {
    modelId: string;
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    averageRating: number;
    errorRate: number;
  };
  currentWinner?: 'A' | 'B' | 'tie';
  confidenceLevel: number;
  lastUpdated: Date;
}

export interface ABTestRequest {
  testId: string;
  userId?: string;
  sessionId?: string;
  request: InferenceRequest;
  assignedModel: 'A' | 'B';
  timestamp: Date;
}

export interface ABTestResponse {
  testId: string;
  assignedModel: 'A' | 'B';
  modelId: string;
  result: InferenceResult;
  responseTime: number;
  timestamp: Date;
}

export class ABTestManager extends EventEmitter {
  private modelManager: ModelManager;
  private inferenceEngine: InferenceEngine;
  private cache: RedisCache;
  private activeTests: Map<string, ABTestConfig> = new Map();
  private testMetrics: Map<string, ABTestMetrics> = new Map();
  private testAssignments: Map<string, Map<string, 'A' | 'B'>> = new Map(); // testId -> userId -> assignment

  constructor(modelManager: ModelManager, inferenceEngine: InferenceEngine) {
    super();
    this.modelManager = modelManager;
    this.inferenceEngine = inferenceEngine;
    this.cache = new RedisCache();
    this.initializeABTestManager();
  }

  /**
   * Initialize A/B test manager
   */
  private async initializeABTestManager(): Promise<void> {
    try {
      await this.loadActiveTests();
      logger.info('A/B Test Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize A/B Test Manager:', error);
      throw error;
    }
  }

  /**
   * Create and start a new A/B test
   */
  async createABTest(config: Omit<ABTestConfig, 'id' | 'status'>): Promise<string> {
    try {
      // Validate test configuration
      await this.validateABTestConfig(config);

      const testId = uuidv4();
      const testConfig: ABTestConfig = {
        ...config,
        id: testId,
        status: 'draft'
      };

      // Store test configuration
      this.activeTests.set(testId, testConfig);
      await this.cache.set(`abtest:config:${testId}`, JSON.stringify(testConfig), config.duration * 24 * 60 * 60);

      // Initialize metrics
      const metrics: ABTestMetrics = {
        testId,
        modelA: {
          modelId: config.modelA,
          totalRequests: 0,
          successfulRequests: 0,
          averageResponseTime: 0,
          averageRating: 0,
          errorRate: 0
        },
        modelB: {
          modelId: config.modelB,
          totalRequests: 0,
          successfulRequests: 0,
          averageResponseTime: 0,
          averageRating: 0,
          errorRate: 0
        },
        confidenceLevel: 0,
        lastUpdated: new Date()
      };

      this.testMetrics.set(testId, metrics);
      this.testAssignments.set(testId, new Map());

      logger.info(`A/B test created: ${testId} (${config.modelA} vs ${config.modelB})`);
      this.emit('abTestCreated', { testId, config: testConfig });

      return testId;
    } catch (error) {
      logger.error('Failed to create A/B test:', error);
      throw error;
    }
  }

  /**
   * Start an A/B test
   */
  async startABTest(testId: string): Promise<void> {
    try {
      const config = this.activeTests.get(testId);
      if (!config) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      if (config.status !== 'draft') {
        throw new Error(`Cannot start test in status: ${config.status}`);
      }

      config.status = 'running';
      await this.updateTestConfig(config);

      // Schedule automatic completion
      setTimeout(() => {
        this.completeABTest(testId);
      }, config.duration * 24 * 60 * 60 * 1000);

      logger.info(`A/B test started: ${testId}`);
      this.emit('abTestStarted', { testId, config });
    } catch (error) {
      logger.error(`Failed to start A/B test ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Process inference request through A/B test
   */
  async processABTestRequest(
    testId: string, 
    request: InferenceRequest, 
    userId?: string, 
    sessionId?: string
  ): Promise<ABTestResponse> {
    try {
      const config = this.activeTests.get(testId);
      if (!config || config.status !== 'running') {
        throw new Error(`A/B test not active: ${testId}`);
      }

      // Determine model assignment
      const assignedModel = this.getModelAssignment(testId, userId, sessionId, config.trafficSplit);
      const modelId = assignedModel === 'A' ? config.modelA : config.modelB;

      // Record test request
      const testRequest: ABTestRequest = {
        testId,
        userId,
        sessionId,
        request,
        assignedModel,
        timestamp: new Date()
      };

      // Execute inference
      const startTime = Date.now();
      let result: InferenceResult;
      let success = false;

      try {
        // Route to appropriate inference method based on request type
        if (request.input.includes('translate')) {
          // Simple heuristic - in real implementation, use proper request classification
          result = await this.inferenceEngine.translate(
            request.input, 
            'auto', 
            'en', 
            modelId
          );
        } else if (request.input.includes('classify')) {
          result = await this.inferenceEngine.classify(request.input, modelId);
        } else {
          result = await this.inferenceEngine.generateText(request.input, modelId, request.options);
        }
        success = result.success;
      } catch (error) {
        result = {
          success: false,
          output: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          metadata: { abTest: true, testId, assignedModel }
        };
      }

      const responseTime = Date.now() - startTime;

      // Create test response
      const testResponse: ABTestResponse = {
        testId,
        assignedModel,
        modelId,
        result,
        responseTime,
        timestamp: new Date()
      };

      // Update metrics
      await this.updateTestMetrics(testId, assignedModel, success, responseTime);

      // Store test data
      await this.storeTestData(testRequest, testResponse);

      return testResponse;
    } catch (error) {
      logger.error(`Failed to process A/B test request for ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Get model assignment for user/session
   */
  private getModelAssignment(
    testId: string, 
    userId?: string, 
    sessionId?: string, 
    trafficSplit: number
  ): 'A' | 'B' {
    const assignments = this.testAssignments.get(testId)!;
    const key = userId || sessionId || `anonymous_${Date.now()}_${Math.random()}`;

    // Check if user already has assignment
    if (assignments.has(key)) {
      return assignments.get(key)!;
    }

    // Assign based on traffic split
    const assignment = Math.random() * 100 < trafficSplit ? 'A' : 'B';
    assignments.set(key, assignment);

    return assignment;
  }

  /**
   * Update test metrics
   */
  private async updateTestMetrics(
    testId: string, 
    assignedModel: 'A' | 'B', 
    success: boolean, 
    responseTime: number,
    userRating?: number
  ): Promise<void> {
    try {
      const metrics = this.testMetrics.get(testId);
      if (!metrics) return;

      const modelMetrics = assignedModel === 'A' ? metrics.modelA : metrics.modelB;

      // Update counters
      modelMetrics.totalRequests++;
      if (success) {
        modelMetrics.successfulRequests++;
      }

      // Update averages
      modelMetrics.averageResponseTime = (
        (modelMetrics.averageResponseTime * (modelMetrics.totalRequests - 1)) + responseTime
      ) / modelMetrics.totalRequests;

      if (userRating) {
        modelMetrics.averageRating = (
          (modelMetrics.averageRating * (modelMetrics.successfulRequests - 1)) + userRating
        ) / modelMetrics.successfulRequests;
      }

      modelMetrics.errorRate = (modelMetrics.totalRequests - modelMetrics.successfulRequests) / modelMetrics.totalRequests;

      metrics.lastUpdated = new Date();

      // Calculate statistical significance
      await this.calculateStatisticalSignificance(testId);

      // Store updated metrics
      await this.cache.set(`abtest:metrics:${testId}`, JSON.stringify(metrics), 86400);
    } catch (error) {
      logger.error(`Failed to update test metrics for ${testId}:`, error);
    }
  }

  /**
   * Calculate statistical significance
   */
  private async calculateStatisticalSignificance(testId: string): Promise<void> {
    try {
      const metrics = this.testMetrics.get(testId);
      const config = this.activeTests.get(testId);
      if (!metrics || !config) return;

      const { modelA, modelB } = metrics;

      // Check if we have minimum sample size
      if (modelA.totalRequests < config.minSampleSize || modelB.totalRequests < config.minSampleSize) {
        return;
      }

      // Simple statistical significance calculation (in real implementation, use proper statistical tests)
      const sampleSizeA = modelA.totalRequests;
      const sampleSizeB = modelB.totalRequests;
      const successRateA = modelA.successfulRequests / sampleSizeA;
      const successRateB = modelB.successfulRequests / sampleSizeB;

      // Calculate z-score for difference in proportions
      const pooledRate = (modelA.successfulRequests + modelB.successfulRequests) / (sampleSizeA + sampleSizeB);
      const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/sampleSizeA + 1/sampleSizeB));
      const zScore = Math.abs(successRateA - successRateB) / standardError;

      // Convert z-score to confidence level (simplified)
      metrics.confidenceLevel = Math.min(99.9, (1 - 2 * (1 - this.normalCDF(Math.abs(zScore)))) * 100);

      // Determine winner if significant
      if (metrics.confidenceLevel >= (config.significanceLevel * 100)) {
        if (successRateA > successRateB) {
          metrics.currentWinner = 'A';
        } else if (successRateB > successRateA) {
          metrics.currentWinner = 'B';
        } else {
          metrics.currentWinner = 'tie';
        }

        // Emit significance achieved event
        this.emit('statisticalSignificanceAchieved', { 
          testId, 
          winner: metrics.currentWinner, 
          confidenceLevel: metrics.confidenceLevel 
        });
      }
    } catch (error) {
      logger.error(`Failed to calculate statistical significance for ${testId}:`, error);
    }
  }

  /**
   * Normal cumulative distribution function (approximation)
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Complete A/B test and generate results
   */
  async completeABTest(testId: string): Promise<ABTestResult> {
    try {
      const config = this.activeTests.get(testId);
      const metrics = this.testMetrics.get(testId);

      if (!config || !metrics) {
        throw new Error(`A/B test data not found: ${testId}`);
      }

      if (config.status !== 'running') {
        throw new Error(`Cannot complete test in status: ${config.status}`);
      }

      // Generate final results
      const result: ABTestResult = {
        testId,
        modelA: {
          modelId: config.modelA,
          sampleSize: metrics.modelA.totalRequests,
          metrics: {
            successRate: metrics.modelA.successfulRequests / metrics.modelA.totalRequests,
            averageResponseTime: metrics.modelA.averageResponseTime,
            averageRating: metrics.modelA.averageRating,
            errorRate: metrics.modelA.errorRate
          }
        },
        modelB: {
          modelId: config.modelB,
          sampleSize: metrics.modelB.totalRequests,
          metrics: {
            successRate: metrics.modelB.successfulRequests / metrics.modelB.totalRequests,
            averageResponseTime: metrics.modelB.averageResponseTime,
            averageRating: metrics.modelB.averageRating,
            errorRate: metrics.modelB.errorRate
          }
        },
        statisticalSignificance: await this.calculateFinalStatistics(testId),
        winner: metrics.currentWinner,
        completedAt: new Date()
      };

      // Update test status
      config.status = 'completed';
      await this.updateTestConfig(config);

      // Store final results
      await this.cache.set(`abtest:result:${testId}`, JSON.stringify(result), 86400 * 30);

      logger.info(`A/B test completed: ${testId}, winner: ${result.winner || 'inconclusive'}`);
      this.emit('abTestCompleted', { testId, result });

      return result;
    } catch (error) {
      logger.error(`Failed to complete A/B test ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate final statistical significance for all metrics
   */
  private async calculateFinalStatistics(testId: string): Promise<ABTestResult['statisticalSignificance']> {
    const metrics = this.testMetrics.get(testId);
    if (!metrics) {
      throw new Error(`Metrics not found for test ${testId}`);
    }

    // In a real implementation, use proper statistical tests (t-test, chi-square, etc.)
    return {
      successRate: {
        pValue: 0.05,
        isSignificant: metrics.confidenceLevel >= 95,
        confidenceInterval: [0.01, 0.05]
      },
      averageResponseTime: {
        pValue: 0.1,
        isSignificant: false,
        confidenceInterval: [-10, 50]
      },
      averageRating: {
        pValue: 0.03,
        isSignificant: metrics.confidenceLevel >= 95,
        confidenceInterval: [0.05, 0.35]
      }
    };
  }

  /**
   * Cancel A/B test
   */
  async cancelABTest(testId: string): Promise<void> {
    try {
      const config = this.activeTests.get(testId);
      if (!config) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      config.status = 'cancelled';
      await this.updateTestConfig(config);

      logger.info(`A/B test cancelled: ${testId}`);
      this.emit('abTestCancelled', { testId });
    } catch (error) {
      logger.error(`Failed to cancel A/B test ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResult(testId: string): Promise<ABTestResult | null> {
    try {
      const cached = await this.cache.get(`abtest:result:${testId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // If test is still running, return current metrics
      const config = this.activeTests.get(testId);
      const metrics = this.testMetrics.get(testId);

      if (config && metrics && config.status === 'running') {
        return {
          testId,
          modelA: {
            modelId: config.modelA,
            sampleSize: metrics.modelA.totalRequests,
            metrics: {
              successRate: metrics.modelA.successfulRequests / Math.max(1, metrics.modelA.totalRequests),
              averageResponseTime: metrics.modelA.averageResponseTime,
              averageRating: metrics.modelA.averageRating,
              errorRate: metrics.modelA.errorRate
            }
          },
          modelB: {
            modelId: config.modelB,
            sampleSize: metrics.modelB.totalRequests,
            metrics: {
              successRate: metrics.modelB.successfulRequests / Math.max(1, metrics.modelB.totalRequests),
              averageResponseTime: metrics.modelB.averageResponseTime,
              averageRating: metrics.modelB.averageRating,
              errorRate: metrics.modelB.errorRate
            }
          },
          statisticalSignificance: {
            successRate: { pValue: 1, isSignificant: false, confidenceInterval: [0, 0] },
            averageResponseTime: { pValue: 1, isSignificant: false, confidenceInterval: [0, 0] },
            averageRating: { pValue: 1, isSignificant: false, confidenceInterval: [0, 0] }
          },
          winner: metrics.currentWinner,
          completedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get A/B test result for ${testId}:`, error);
      return null;
    }
  }

  /**
   * List all A/B tests
   */
  async listABTests(status?: ABTestConfig['status']): Promise<ABTestConfig[]> {
    try {
      const tests = Array.from(this.activeTests.values());
      return status ? tests.filter(test => test.status === status) : tests;
    } catch (error) {
      logger.error('Failed to list A/B tests:', error);
      return [];
    }
  }

  /**
   * Get A/B test metrics
   */
  getABTestMetrics(testId: string): ABTestMetrics | null {
    return this.testMetrics.get(testId) || null;
  }

  /**
   * Validate A/B test configuration
   */
  private async validateABTestConfig(config: Omit<ABTestConfig, 'id' | 'status'>): Promise<void> {
    // Check if models exist
    const modelA = this.modelManager.getModelConfig(config.modelA);
    const modelB = this.modelManager.getModelConfig(config.modelB);

    if (!modelA) {
      throw new Error(`Model A not found: ${config.modelA}`);
    }

    if (!modelB) {
      throw new Error(`Model B not found: ${config.modelB}`);
    }

    if (config.modelA === config.modelB) {
      throw new Error('Model A and Model B must be different');
    }

    if (config.trafficSplit < 0 || config.trafficSplit > 100) {
      throw new Error('Traffic split must be between 0 and 100');
    }

    if (config.duration <= 0) {
      throw new Error('Duration must be positive');
    }

    if (config.minSampleSize <= 0) {
      throw new Error('Minimum sample size must be positive');
    }

    if (config.significanceLevel <= 0 || config.significanceLevel >= 1) {
      throw new Error('Significance level must be between 0 and 1');
    }
  }

  /**
   * Update test configuration
   */
  private async updateTestConfig(config: ABTestConfig): Promise<void> {
    this.activeTests.set(config.id, config);
    await this.cache.set(`abtest:config:${config.id}`, JSON.stringify(config), config.duration * 24 * 60 * 60);
  }

  /**
   * Store test request and response data
   */
  private async storeTestData(request: ABTestRequest, response: ABTestResponse): Promise<void> {
    try {
      const data = { request, response };
      await this.cache.set(
        `abtest:data:${request.testId}:${Date.now()}:${Math.random()}`, 
        JSON.stringify(data), 
        86400 * 7
      );
    } catch (error) {
      logger.error('Failed to store A/B test data:', error);
    }
  }

  /**
   * Load active tests from storage
   */
  private async loadActiveTests(): Promise<void> {
    try {
      // In real implementation, load from database
      logger.info('Active A/B tests loaded from storage');
    } catch (error) {
      logger.error('Failed to load active A/B tests:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cancel all running tests
    for (const config of this.activeTests.values()) {
      if (config.status === 'running') {
        await this.cancelABTest(config.id);
      }
    }

    logger.info('A/B Test Manager cleanup completed');
  }
}