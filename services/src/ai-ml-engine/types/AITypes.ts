export enum ModelType {
  TEXT_GENERATION = 'text_generation',
  CLASSIFICATION = 'classification',
  TRANSLATION = 'translation',
  EMBEDDING = 'embedding',
  IMAGE_GENERATION = 'image_generation',
  SPEECH_TO_TEXT = 'speech_to_text',
  TEXT_TO_SPEECH = 'text_to_speech'
}

export interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  provider: string;
  version: string;
  endpoint?: string;
  maxTokens?: number;
  costPerToken?: number;
  isActive: boolean;
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface AIModel {
  id: string;
  config: ModelConfig;
  loadedAt: Date;
  lastUsed: Date;
  isLoaded: boolean;
  memoryUsage: number; // in MB
  metadata?: Record<string, any>;
}

export interface ModelMetrics {
  modelId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  successRate: number;
  totalTokensUsed: number;
  lastUpdated: Date;
}

export interface InferenceRequest {
  modelId: string;
  input: string;
  options?: InferenceOptions;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface InferenceOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  [key: string]: any;
}

export interface InferenceResult {
  success: boolean;
  output: string | null;
  confidence?: number;
  error?: string;
  timestamp: Date;
  metadata?: {
    modelId?: string;
    tokensUsed?: number;
    responseTime?: number;
    cost?: number;
    [key: string]: any;
  };
}

export interface TextGenerationOptions extends InferenceOptions {
  systemPrompt?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface ClassificationOptions extends InferenceOptions {
  categories?: string[];
  returnConfidence?: boolean;
  multiLabel?: boolean;
}

export interface TranslationOptions extends InferenceOptions {
  sourceLang: string;
  targetLang: string;
  preserveFormatting?: boolean;
  contextualHints?: string[];
}

export interface EmbeddingOptions extends InferenceOptions {
  dimensions?: number;
  normalize?: boolean;
}

export interface ModelPerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  latency: number;
  throughput: number;
  errorRate: number;
  costEfficiency: number;
}

export interface ModelVersion {
  version: string;
  releaseDate: Date;
  changelog: string[];
  isDeprecated: boolean;
  supportedUntil?: Date;
}

export interface ModelDeployment {
  modelId: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  deployedAt: Date;
  status: 'active' | 'inactive' | 'maintenance';
  replicas: number;
  resourceLimits: {
    cpu: string;
    memory: string;
    gpu?: string;
  };
}

export interface AIServiceError extends Error {
  code: string;
  modelId?: string;
  retryable: boolean;
  metadata?: Record<string, any>;
}

export interface BatchInferenceRequest {
  requests: InferenceRequest[];
  options?: {
    concurrency?: number;
    timeout?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffMultiplier: number;
    };
  };
}

export interface BatchInferenceResult {
  results: InferenceResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalTime: number;
    averageTime: number;
  };
}

// Training and Continuous Improvement Types
export enum TrainingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TrainingConfig {
  modelId: string;
  trainingData: TrainingDataset;
  validationData?: TrainingDataset;
  hyperparameters: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    optimizer: string;
    [key: string]: any;
  };
  objectives: string[];
  evaluationMetrics: string[];
  earlyStoppingConfig?: {
    patience: number;
    minDelta: number;
    metric: string;
  };
  checkpointConfig?: {
    saveFrequency: number;
    maxCheckpoints: number;
  };
}

export interface TrainingDataset {
  id: string;
  name: string;
  source: string;
  format: 'json' | 'csv' | 'parquet' | 'jsonl';
  size: number;
  features: string[];
  labels?: string[];
  metadata?: Record<string, any>;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  config: TrainingConfig;
  status: TrainingStatus;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  metrics?: TrainingMetrics;
  logs: TrainingLog[];
  checkpoints: ModelCheckpoint[];
  error?: string;
  createdBy: string;
  createdAt: Date;
}

export interface TrainingMetrics {
  epoch: number;
  trainingLoss: number;
  validationLoss?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  customMetrics?: Record<string, number>;
  timestamp: Date;
}

export interface TrainingLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

export interface ModelCheckpoint {
  id: string;
  modelId: string;
  trainingJobId: string;
  epoch: number;
  metrics: TrainingMetrics;
  filePath: string;
  size: number;
  createdAt: Date;
}

export interface ModelEvaluation {
  id: string;
  modelId: string;
  version: string;
  testDataset: TrainingDataset;
  metrics: ModelPerformanceMetrics;
  benchmarkResults: BenchmarkResult[];
  evaluatedAt: Date;
  evaluatedBy: string;
}

export interface BenchmarkResult {
  benchmarkName: string;
  score: number;
  details: Record<string, any>;
  comparisonBaseline?: number;
}

export interface FeedbackData {
  id: string;
  modelId: string;
  inputData: string;
  expectedOutput: string;
  actualOutput: string;
  userRating: number; // 1-5 scale
  feedbackType: 'correction' | 'rating' | 'preference';
  metadata?: Record<string, any>;
  submittedBy: string;
  submittedAt: Date;
}

export interface ModelDriftMetrics {
  modelId: string;
  driftScore: number;
  driftType: 'data' | 'concept' | 'performance';
  detectedAt: Date;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFeatures?: string[];
  recommendedActions: string[];
}

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  modelA: string;
  modelB: string;
  trafficSplit: number; // 0-100 percentage for model A
  metrics: string[];
  duration: number; // in days
  minSampleSize: number;
  significanceLevel: number;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
}

export interface ABTestResult {
  testId: string;
  modelA: {
    modelId: string;
    sampleSize: number;
    metrics: Record<string, number>;
  };
  modelB: {
    modelId: string;
    sampleSize: number;
    metrics: Record<string, number>;
  };
  statisticalSignificance: Record<string, {
    pValue: number;
    isSignificant: boolean;
    confidenceInterval: [number, number];
  }>;
  winner?: 'A' | 'B' | 'tie';
  completedAt: Date;
}

export interface FederatedLearningConfig {
  modelId: string;
  participants: FederatedParticipant[];
  aggregationStrategy: 'fedavg' | 'fedprox' | 'scaffold';
  rounds: number;
  minParticipants: number;
  privacyBudget?: number;
  differentialPrivacy?: {
    epsilon: number;
    delta: number;
  };
}

export interface FederatedParticipant {
  id: string;
  name: string;
  dataSize: number;
  computeCapability: 'low' | 'medium' | 'high';
  trustLevel: number; // 0-1 scale
  isActive: boolean;
}