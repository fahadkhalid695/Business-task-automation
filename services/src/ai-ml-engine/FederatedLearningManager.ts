import { logger } from '../shared/utils/logger';
import { RedisCache } from '../shared/cache/RedisCache';
import { ModelManager } from './ModelManager';
import { 
  FederatedLearningConfig, 
  FederatedParticipant,
  TrainingMetrics,
  ModelCheckpoint
} from './types/AITypes';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface FederatedRound {
  id: string;
  roundNumber: number;
  configId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  participants: FederatedParticipant[];
  globalModel: ModelCheckpoint;
  localUpdates: Map<string, LocalModelUpdate>;
  aggregatedUpdate: ModelCheckpoint | null;
  metrics: FederatedRoundMetrics;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface LocalModelUpdate {
  participantId: string;
  modelUpdate: ModelCheckpoint;
  trainingMetrics: TrainingMetrics;
  dataSize: number;
  computeTime: number;
  uploadTime: Date;
  isValid: boolean;
  validationErrors?: string[];
}

export interface FederatedRoundMetrics {
  roundNumber: number;
  participantCount: number;
  averageAccuracy: number;
  averageLoss: number;
  convergenceScore: number;
  communicationCost: number;
  aggregationTime: number;
  totalTrainingTime: number;
  privacyBudgetUsed?: number;
}

export interface PrivacyMetrics {
  epsilon: number;
  delta: number;
  budgetUsed: number;
  budgetRemaining: number;
  noiseLevel: number;
  privacyLoss: number;
}

export interface FederatedSession {
  id: string;
  config: FederatedLearningConfig;
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'paused';
  currentRound: number;
  totalRounds: number;
  rounds: FederatedRound[];
  globalModel: ModelCheckpoint;
  convergenceHistory: number[];
  privacyMetrics?: PrivacyMetrics;
  startTime: Date;
  endTime?: Date;
  createdBy: string;
}

export class FederatedLearningManager extends EventEmitter {
  private modelManager: ModelManager;
  private cache: RedisCache;
  private activeSessions: Map<string, FederatedSession> = new Map();
  private participantConnections: Map<string, WebSocket> = new Map();
  private aggregationStrategies: Map<string, (updates: LocalModelUpdate[]) => ModelCheckpoint> = new Map();

  constructor(modelManager: ModelManager) {
    super();
    this.modelManager = modelManager;
    this.cache = new RedisCache();
    this.initializeFederatedLearning();
  }

  /**
   * Initialize federated learning manager
   */
  private async initializeFederatedLearning(): Promise<void> {
    try {
      this.setupAggregationStrategies();
      await this.loadActiveSessions();
      logger.info('Federated Learning Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Federated Learning Manager:', error);
      throw error;
    }
  }

  /**
   * Create a new federated learning session
   */
  async createFederatedSession(
    config: FederatedLearningConfig, 
    createdBy: string
  ): Promise<string> {
    try {
      // Validate configuration
      await this.validateFederatedConfig(config);

      const sessionId = uuidv4();
      
      // Initialize global model
      const globalModel = await this.initializeGlobalModel(config.modelId);

      const session: FederatedSession = {
        id: sessionId,
        config,
        status: 'initializing',
        currentRound: 0,
        totalRounds: config.rounds,
        rounds: [],
        globalModel,
        convergenceHistory: [],
        privacyMetrics: config.differentialPrivacy ? {
          epsilon: config.differentialPrivacy.epsilon,
          delta: config.differentialPrivacy.delta,
          budgetUsed: 0,
          budgetRemaining: config.privacyBudget || 1.0,
          noiseLevel: 0,
          privacyLoss: 0
        } : undefined,
        startTime: new Date(),
        createdBy
      };

      // Store session
      this.activeSessions.set(sessionId, session);
      await this.cache.set(`federated:session:${sessionId}`, JSON.stringify(session), 86400 * 7);

      logger.info(`Federated learning session created: ${sessionId} with ${config.participants.length} participants`);
      this.emit('sessionCreated', { sessionId, config });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create federated learning session:', error);
      throw error;
    }
  }

  /**
   * Start federated learning session
   */
  async startFederatedSession(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Federated session not found: ${sessionId}`);
      }

      if (session.status !== 'initializing') {
        throw new Error(`Cannot start session in status: ${session.status}`);
      }

      // Check minimum participants
      const activeParticipants = session.config.participants.filter(p => p.isActive);
      if (activeParticipants.length < session.config.minParticipants) {
        throw new Error(`Insufficient active participants: ${activeParticipants.length} < ${session.config.minParticipants}`);
      }

      session.status = 'running';
      await this.updateSession(session);

      // Start first round
      await this.startFederatedRound(sessionId);

      logger.info(`Federated learning session started: ${sessionId}`);
      this.emit('sessionStarted', { sessionId });
    } catch (error) {
      logger.error(`Failed to start federated session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Start a new federated round
   */
  private async startFederatedRound(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const roundNumber = session.currentRound + 1;
      
      if (roundNumber > session.totalRounds) {
        await this.completeFederatedSession(sessionId);
        return;
      }

      // Select participants for this round
      const selectedParticipants = this.selectParticipants(session.config.participants, session.config.minParticipants);

      const round: FederatedRound = {
        id: uuidv4(),
        roundNumber,
        configId: sessionId,
        status: 'pending',
        participants: selectedParticipants,
        globalModel: session.globalModel,
        localUpdates: new Map(),
        aggregatedUpdate: null,
        metrics: {
          roundNumber,
          participantCount: selectedParticipants.length,
          averageAccuracy: 0,
          averageLoss: 0,
          convergenceScore: 0,
          communicationCost: 0,
          aggregationTime: 0,
          totalTrainingTime: 0,
          privacyBudgetUsed: 0
        },
        startTime: new Date()
      };

      session.rounds.push(round);
      session.currentRound = roundNumber;
      await this.updateSession(session);

      // Distribute global model to participants
      await this.distributeGlobalModel(round);

      // Start round execution
      await this.executeRound(round);

      logger.info(`Federated round ${roundNumber} started for session ${sessionId}`);
      this.emit('roundStarted', { sessionId, roundNumber, participantCount: selectedParticipants.length });
    } catch (error) {
      logger.error(`Failed to start federated round for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a federated round
   */
  private async executeRound(round: FederatedRound): Promise<void> {
    try {
      round.status = 'running';
      
      // Simulate participant training (in real implementation, coordinate with actual participants)
      const trainingPromises = round.participants.map(participant => 
        this.simulateParticipantTraining(round, participant)
      );

      // Wait for all participants to complete training
      const localUpdates = await Promise.all(trainingPromises);
      
      // Store local updates
      localUpdates.forEach(update => {
        round.localUpdates.set(update.participantId, update);
      });

      // Aggregate local updates
      const aggregationStartTime = Date.now();
      round.aggregatedUpdate = await this.aggregateLocalUpdates(round);
      round.metrics.aggregationTime = Date.now() - aggregationStartTime;

      // Update global model
      const session = this.activeSessions.get(round.configId)!;
      session.globalModel = round.aggregatedUpdate;

      // Calculate round metrics
      await this.calculateRoundMetrics(round);

      // Update privacy budget if using differential privacy
      if (session.privacyMetrics) {
        await this.updatePrivacyBudget(session, round);
      }

      // Check convergence
      const hasConverged = await this.checkConvergence(session);

      round.status = 'completed';
      round.endTime = new Date();
      await this.updateSession(session);

      logger.info(`Federated round ${round.roundNumber} completed for session ${round.configId}`);
      this.emit('roundCompleted', { 
        sessionId: round.configId, 
        roundNumber: round.roundNumber, 
        metrics: round.metrics,
        hasConverged 
      });

      // Start next round or complete session
      if (hasConverged || round.roundNumber >= session.totalRounds) {
        await this.completeFederatedSession(round.configId);
      } else {
        // Schedule next round
        setTimeout(() => {
          this.startFederatedRound(round.configId);
        }, 5000); // 5 second delay between rounds
      }
    } catch (error) {
      round.status = 'failed';
      round.error = error instanceof Error ? error.message : 'Unknown error';
      round.endTime = new Date();
      
      logger.error(`Federated round ${round.roundNumber} failed:`, error);
      this.emit('roundFailed', { sessionId: round.configId, roundNumber: round.roundNumber, error: round.error });
    }
  }

  /**
   * Simulate participant training
   */
  private async simulateParticipantTraining(
    round: FederatedRound, 
    participant: FederatedParticipant
  ): Promise<LocalModelUpdate> {
    try {
      // Simulate training time based on participant capability
      const baseTrainingTime = 30000; // 30 seconds
      const capabilityMultiplier = participant.computeCapability === 'high' ? 0.5 : 
                                  participant.computeCapability === 'medium' ? 1.0 : 2.0;
      const trainingTime = baseTrainingTime * capabilityMultiplier;

      await new Promise(resolve => setTimeout(resolve, trainingTime));

      // Generate mock training metrics
      const metrics: TrainingMetrics = {
        epoch: round.roundNumber,
        trainingLoss: Math.max(0.1, 2.0 - (round.roundNumber * 0.1) + (Math.random() * 0.2 - 0.1)),
        validationLoss: Math.max(0.15, 2.2 - (round.roundNumber * 0.1) + (Math.random() * 0.3 - 0.15)),
        accuracy: Math.min(0.95, 0.5 + (round.roundNumber * 0.05) + (Math.random() * 0.1 - 0.05)),
        f1Score: Math.min(0.92, 0.45 + (round.roundNumber * 0.05) + (Math.random() * 0.1 - 0.05)),
        timestamp: new Date()
      };

      // Create mock model update
      const modelUpdate: ModelCheckpoint = {
        id: uuidv4(),
        modelId: round.globalModel.modelId,
        trainingJobId: round.id,
        epoch: round.roundNumber,
        metrics,
        filePath: `/federated/${participant.id}/round_${round.roundNumber}.ckpt`,
        size: Math.floor(Math.random() * 1000000) + 500000,
        createdAt: new Date()
      };

      const localUpdate: LocalModelUpdate = {
        participantId: participant.id,
        modelUpdate,
        trainingMetrics: metrics,
        dataSize: participant.dataSize,
        computeTime: trainingTime,
        uploadTime: new Date(),
        isValid: true
      };

      // Validate update
      await this.validateLocalUpdate(localUpdate, participant);

      return localUpdate;
    } catch (error) {
      logger.error(`Participant training failed for ${participant.id}:`, error);
      
      // Return invalid update
      return {
        participantId: participant.id,
        modelUpdate: round.globalModel, // Return original model
        trainingMetrics: {
          epoch: round.roundNumber,
          trainingLoss: 999,
          accuracy: 0,
          timestamp: new Date()
        },
        dataSize: participant.dataSize,
        computeTime: 0,
        uploadTime: new Date(),
        isValid: false,
        validationErrors: [error instanceof Error ? error.message : 'Training failed']
      };
    }
  }

  /**
   * Aggregate local updates using configured strategy
   */
  private async aggregateLocalUpdates(round: FederatedRound): Promise<ModelCheckpoint> {
    try {
      const session = this.activeSessions.get(round.configId)!;
      const strategy = session.config.aggregationStrategy;
      
      // Get valid updates only
      const validUpdates = Array.from(round.localUpdates.values()).filter(update => update.isValid);
      
      if (validUpdates.length === 0) {
        throw new Error('No valid local updates to aggregate');
      }

      // Get aggregation function
      const aggregationFn = this.aggregationStrategies.get(strategy);
      if (!aggregationFn) {
        throw new Error(`Unknown aggregation strategy: ${strategy}`);
      }

      // Perform aggregation
      const aggregatedModel = aggregationFn(validUpdates);
      
      logger.info(`Aggregated ${validUpdates.length} local updates using ${strategy} strategy`);
      return aggregatedModel;
    } catch (error) {
      logger.error('Failed to aggregate local updates:', error);
      throw error;
    }
  }

  /**
   * Setup aggregation strategies
   */
  private setupAggregationStrategies(): void {
    // Federated Averaging (FedAvg)
    this.aggregationStrategies.set('fedavg', (updates: LocalModelUpdate[]) => {
      const totalDataSize = updates.reduce((sum, update) => sum + update.dataSize, 0);
      
      // Weighted average based on data size
      const weightedMetrics = updates.reduce((acc, update) => {
        const weight = update.dataSize / totalDataSize;
        return {
          trainingLoss: acc.trainingLoss + (update.trainingMetrics.trainingLoss * weight),
          accuracy: acc.accuracy + ((update.trainingMetrics.accuracy || 0) * weight),
          f1Score: acc.f1Score + ((update.trainingMetrics.f1Score || 0) * weight)
        };
      }, { trainingLoss: 0, accuracy: 0, f1Score: 0 });

      return {
        id: uuidv4(),
        modelId: updates[0].modelUpdate.modelId,
        trainingJobId: updates[0].modelUpdate.trainingJobId,
        epoch: updates[0].modelUpdate.epoch,
        metrics: {
          epoch: updates[0].modelUpdate.epoch,
          trainingLoss: weightedMetrics.trainingLoss,
          accuracy: weightedMetrics.accuracy,
          f1Score: weightedMetrics.f1Score,
          timestamp: new Date()
        },
        filePath: `/federated/aggregated/round_${updates[0].modelUpdate.epoch}.ckpt`,
        size: Math.max(...updates.map(u => u.modelUpdate.size)),
        createdAt: new Date()
      };
    });

    // FedProx (similar to FedAvg but with proximal term)
    this.aggregationStrategies.set('fedprox', this.aggregationStrategies.get('fedavg')!);

    // SCAFFOLD (with control variates)
    this.aggregationStrategies.set('scaffold', this.aggregationStrategies.get('fedavg')!);
  }

  /**
   * Calculate round metrics
   */
  private async calculateRoundMetrics(round: FederatedRound): Promise<void> {
    const validUpdates = Array.from(round.localUpdates.values()).filter(update => update.isValid);
    
    if (validUpdates.length === 0) {
      return;
    }

    round.metrics.participantCount = validUpdates.length;
    round.metrics.averageAccuracy = validUpdates.reduce((sum, update) => 
      sum + (update.trainingMetrics.accuracy || 0), 0) / validUpdates.length;
    round.metrics.averageLoss = validUpdates.reduce((sum, update) => 
      sum + update.trainingMetrics.trainingLoss, 0) / validUpdates.length;
    round.metrics.totalTrainingTime = validUpdates.reduce((sum, update) => 
      sum + update.computeTime, 0);
    round.metrics.communicationCost = validUpdates.reduce((sum, update) => 
      sum + update.modelUpdate.size, 0);

    // Calculate convergence score (simplified)
    const session = this.activeSessions.get(round.configId)!;
    if (session.convergenceHistory.length > 0) {
      const previousAccuracy = session.convergenceHistory[session.convergenceHistory.length - 1];
      round.metrics.convergenceScore = Math.abs(round.metrics.averageAccuracy - previousAccuracy);
    }

    session.convergenceHistory.push(round.metrics.averageAccuracy);
  }

  /**
   * Update privacy budget
   */
  private async updatePrivacyBudget(session: FederatedSession, round: FederatedRound): Promise<void> {
    if (!session.privacyMetrics || !session.config.differentialPrivacy) {
      return;
    }

    // Calculate privacy cost for this round
    const privacyCost = session.config.differentialPrivacy.epsilon / session.totalRounds;
    
    session.privacyMetrics.budgetUsed += privacyCost;
    session.privacyMetrics.budgetRemaining -= privacyCost;
    session.privacyMetrics.privacyLoss += privacyCost;
    
    round.metrics.privacyBudgetUsed = privacyCost;

    // Check if privacy budget is exhausted
    if (session.privacyMetrics.budgetRemaining <= 0) {
      logger.warn(`Privacy budget exhausted for session ${session.id}`);
      this.emit('privacyBudgetExhausted', { sessionId: session.id });
    }
  }

  /**
   * Check convergence
   */
  private async checkConvergence(session: FederatedSession): Promise<boolean> {
    if (session.convergenceHistory.length < 3) {
      return false; // Need at least 3 rounds to check convergence
    }

    // Simple convergence check: if improvement is less than threshold for 2 consecutive rounds
    const recent = session.convergenceHistory.slice(-3);
    const improvement1 = recent[1] - recent[0];
    const improvement2 = recent[2] - recent[1];
    
    const convergenceThreshold = 0.001;
    const hasConverged = improvement1 < convergenceThreshold && improvement2 < convergenceThreshold;

    if (hasConverged) {
      logger.info(`Convergence detected for session ${session.id} after ${session.currentRound} rounds`);
    }

    return hasConverged;
  }

  /**
   * Complete federated session
   */
  private async completeFederatedSession(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return;
      }

      session.status = 'completed';
      session.endTime = new Date();
      await this.updateSession(session);

      // Deploy final global model
      await this.deployGlobalModel(session);

      logger.info(`Federated learning session completed: ${sessionId} after ${session.currentRound} rounds`);
      this.emit('sessionCompleted', { 
        sessionId, 
        totalRounds: session.currentRound,
        finalAccuracy: session.convergenceHistory[session.convergenceHistory.length - 1]
      });
    } catch (error) {
      logger.error(`Failed to complete federated session ${sessionId}:`, error);
    }
  }

  /**
   * Select participants for a round
   */
  private selectParticipants(
    allParticipants: FederatedParticipant[], 
    minParticipants: number
  ): FederatedParticipant[] {
    const activeParticipants = allParticipants.filter(p => p.isActive);
    
    // Simple selection: take all active participants if we have enough
    if (activeParticipants.length >= minParticipants) {
      return activeParticipants;
    }
    
    throw new Error(`Insufficient active participants: ${activeParticipants.length} < ${minParticipants}`);
  }

  /**
   * Validate local update
   */
  private async validateLocalUpdate(
    update: LocalModelUpdate, 
    participant: FederatedParticipant
  ): Promise<void> {
    const errors: string[] = [];

    // Check if metrics are reasonable
    if (update.trainingMetrics.trainingLoss < 0 || update.trainingMetrics.trainingLoss > 10) {
      errors.push('Training loss out of reasonable range');
    }

    if (update.trainingMetrics.accuracy && (update.trainingMetrics.accuracy < 0 || update.trainingMetrics.accuracy > 1)) {
      errors.push('Accuracy out of valid range [0, 1]');
    }

    // Check model size
    if (update.modelUpdate.size <= 0) {
      errors.push('Invalid model size');
    }

    // Check participant trust level
    if (participant.trustLevel < 0.5) {
      errors.push('Participant trust level too low');
    }

    if (errors.length > 0) {
      update.isValid = false;
      update.validationErrors = errors;
      logger.warn(`Local update validation failed for participant ${participant.id}: ${errors.join(', ')}`);
    }
  }

  /**
   * Initialize global model
   */
  private async initializeGlobalModel(modelId: string): Promise<ModelCheckpoint> {
    const model = this.modelManager.getModelConfig(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    return {
      id: uuidv4(),
      modelId,
      trainingJobId: 'federated_init',
      epoch: 0,
      metrics: {
        epoch: 0,
        trainingLoss: 2.0,
        accuracy: 0.5,
        timestamp: new Date()
      },
      filePath: `/federated/global/${modelId}_init.ckpt`,
      size: 1000000, // 1MB initial size
      createdAt: new Date()
    };
  }

  /**
   * Distribute global model to participants
   */
  private async distributeGlobalModel(round: FederatedRound): Promise<void> {
    // In real implementation, send model to participants via secure channels
    logger.info(`Global model distributed to ${round.participants.length} participants for round ${round.roundNumber}`);
  }

  /**
   * Deploy final global model
   */
  private async deployGlobalModel(session: FederatedSession): Promise<void> {
    try {
      // In real implementation, deploy the final model to production
      logger.info(`Final global model deployed for session ${session.id}`);
      this.emit('modelDeployed', { sessionId: session.id, modelId: session.globalModel.modelId });
    } catch (error) {
      logger.error(`Failed to deploy global model for session ${session.id}:`, error);
    }
  }

  /**
   * Get federated session
   */
  async getFederatedSession(sessionId: string): Promise<FederatedSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * List federated sessions
   */
  async listFederatedSessions(status?: FederatedSession['status']): Promise<FederatedSession[]> {
    const sessions = Array.from(this.activeSessions.values());
    return status ? sessions.filter(s => s.status === status) : sessions;
  }

  /**
   * Pause federated session
   */
  async pauseFederatedSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'paused';
    await this.updateSession(session);

    logger.info(`Federated session paused: ${sessionId}`);
    this.emit('sessionPaused', { sessionId });
  }

  /**
   * Resume federated session
   */
  async resumeFederatedSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'paused') {
      throw new Error(`Cannot resume session in status: ${session.status}`);
    }

    session.status = 'running';
    await this.updateSession(session);

    // Resume from current round
    await this.startFederatedRound(sessionId);

    logger.info(`Federated session resumed: ${sessionId}`);
    this.emit('sessionResumed', { sessionId });
  }

  /**
   * Validate federated configuration
   */
  private async validateFederatedConfig(config: FederatedLearningConfig): Promise<void> {
    const model = this.modelManager.getModelConfig(config.modelId);
    if (!model) {
      throw new Error(`Model not found: ${config.modelId}`);
    }

    if (config.participants.length === 0) {
      throw new Error('At least one participant is required');
    }

    if (config.minParticipants <= 0 || config.minParticipants > config.participants.length) {
      throw new Error('Invalid minimum participants count');
    }

    if (config.rounds <= 0) {
      throw new Error('Number of rounds must be positive');
    }

    if (!['fedavg', 'fedprox', 'scaffold'].includes(config.aggregationStrategy)) {
      throw new Error(`Unsupported aggregation strategy: ${config.aggregationStrategy}`);
    }

    // Validate differential privacy settings
    if (config.differentialPrivacy) {
      if (config.differentialPrivacy.epsilon <= 0) {
        throw new Error('Epsilon must be positive');
      }
      if (config.differentialPrivacy.delta < 0 || config.differentialPrivacy.delta >= 1) {
        throw new Error('Delta must be in range [0, 1)');
      }
    }
  }

  /**
   * Update session in storage
   */
  private async updateSession(session: FederatedSession): Promise<void> {
    this.activeSessions.set(session.id, session);
    await this.cache.set(`federated:session:${session.id}`, JSON.stringify(session), 86400 * 7);
  }

  /**
   * Load active sessions from storage
   */
  private async loadActiveSessions(): Promise<void> {
    try {
      // In real implementation, load from database
      logger.info('Active federated sessions loaded from storage');
    } catch (error) {
      logger.error('Failed to load active federated sessions:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Pause all running sessions
    for (const session of this.activeSessions.values()) {
      if (session.status === 'running') {
        await this.pauseFederatedSession(session.id);
      }
    }

    // Close participant connections
    for (const [participantId, connection] of this.participantConnections) {
      connection.close();
    }
    this.participantConnections.clear();

    logger.info('Federated Learning Manager cleanup completed');
  }
}