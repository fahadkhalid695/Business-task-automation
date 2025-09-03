import { logger } from '../shared/utils/logger';
import { RedisCache } from '../shared/cache/RedisCache';
import { FeedbackData, ModelPerformanceMetrics } from './types/AITypes';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface FeedbackAnalytics {
  modelId: string;
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  feedbackTrends: {
    daily: Array<{ date: string; averageRating: number; count: number }>;
    weekly: Array<{ week: string; averageRating: number; count: number }>;
  };
  commonIssues: Array<{ issue: string; frequency: number; examples: string[] }>;
  improvementSuggestions: string[];
}

export interface FeedbackThresholds {
  minFeedbackCount: number;
  lowRatingThreshold: number;
  retrainingTriggerRating: number;
  alertThreshold: number;
}

export class FeedbackCollector extends EventEmitter {
  private cache: RedisCache;
  private feedbackStore: Map<string, FeedbackData[]> = new Map();
  private thresholds: FeedbackThresholds;

  constructor(thresholds?: Partial<FeedbackThresholds>) {
    super();
    this.cache = new RedisCache();
    this.thresholds = {
      minFeedbackCount: 10,
      lowRatingThreshold: 3.0,
      retrainingTriggerRating: 2.5,
      alertThreshold: 2.0,
      ...thresholds
    };
    this.initializeFeedbackCollector();
  }

  /**
   * Initialize feedback collector
   */
  private async initializeFeedbackCollector(): Promise<void> {
    try {
      await this.loadExistingFeedback();
      logger.info('Feedback collector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize feedback collector:', error);
      throw error;
    }
  }

  /**
   * Submit user feedback for a model
   */
  async submitFeedback(feedback: Omit<FeedbackData, 'id' | 'submittedAt'>): Promise<string> {
    try {
      const feedbackData: FeedbackData = {
        ...feedback,
        id: uuidv4(),
        submittedAt: new Date()
      };

      // Validate feedback
      this.validateFeedback(feedbackData);

      // Store feedback
      await this.storeFeedback(feedbackData);

      // Add to in-memory store
      if (!this.feedbackStore.has(feedback.modelId)) {
        this.feedbackStore.set(feedback.modelId, []);
      }
      this.feedbackStore.get(feedback.modelId)!.push(feedbackData);

      // Analyze feedback and trigger actions if needed
      await this.analyzeFeedback(feedback.modelId);

      logger.info(`Feedback submitted for model ${feedback.modelId}: ${feedbackData.id} (rating: ${feedback.userRating})`);
      this.emit('feedbackSubmitted', { modelId: feedback.modelId, feedbackId: feedbackData.id, rating: feedback.userRating });

      return feedbackData.id;
    } catch (error) {
      logger.error('Failed to submit feedback:', error);
      throw error;
    }
  }

  /**
   * Submit batch feedback
   */
  async submitBatchFeedback(feedbackList: Array<Omit<FeedbackData, 'id' | 'submittedAt'>>): Promise<string[]> {
    try {
      const feedbackIds: string[] = [];
      
      for (const feedback of feedbackList) {
        const id = await this.submitFeedback(feedback);
        feedbackIds.push(id);
      }

      logger.info(`Batch feedback submitted: ${feedbackIds.length} items`);
      return feedbackIds;
    } catch (error) {
      logger.error('Failed to submit batch feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback analytics for a model
   */
  async getFeedbackAnalytics(modelId: string, days: number = 30): Promise<FeedbackAnalytics> {
    try {
      const feedback = await this.getModelFeedback(modelId, days);
      
      if (feedback.length === 0) {
        return this.createEmptyAnalytics(modelId);
      }

      const analytics: FeedbackAnalytics = {
        modelId,
        totalFeedback: feedback.length,
        averageRating: this.calculateAverageRating(feedback),
        ratingDistribution: this.calculateRatingDistribution(feedback),
        feedbackTrends: this.calculateFeedbackTrends(feedback),
        commonIssues: await this.identifyCommonIssues(feedback),
        improvementSuggestions: this.generateImprovementSuggestions(feedback)
      };

      return analytics;
    } catch (error) {
      logger.error(`Failed to get feedback analytics for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get recent feedback for a model
   */
  async getModelFeedback(modelId: string, days: number = 30): Promise<FeedbackData[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const allFeedback = this.feedbackStore.get(modelId) || [];
      return allFeedback.filter(f => f.submittedAt >= cutoffDate);
    } catch (error) {
      logger.error(`Failed to get feedback for model ${modelId}:`, error);
      return [];
    }
  }

  /**
   * Get feedback by rating range
   */
  async getFeedbackByRating(modelId: string, minRating: number, maxRating: number): Promise<FeedbackData[]> {
    try {
      const allFeedback = this.feedbackStore.get(modelId) || [];
      return allFeedback.filter(f => f.userRating >= minRating && f.userRating <= maxRating);
    } catch (error) {
      logger.error(`Failed to get feedback by rating for model ${modelId}:`, error);
      return [];
    }
  }

  /**
   * Get feedback requiring attention (low ratings)
   */
  async getFeedbackRequiringAttention(modelId: string): Promise<FeedbackData[]> {
    return this.getFeedbackByRating(modelId, 1, this.thresholds.lowRatingThreshold);
  }

  /**
   * Analyze feedback and trigger actions
   */
  private async analyzeFeedback(modelId: string): Promise<void> {
    try {
      const recentFeedback = await this.getModelFeedback(modelId, 7); // Last 7 days
      
      if (recentFeedback.length < this.thresholds.minFeedbackCount) {
        return; // Not enough feedback to analyze
      }

      const averageRating = this.calculateAverageRating(recentFeedback);
      
      // Check for retraining trigger
      if (averageRating <= this.thresholds.retrainingTriggerRating) {
        logger.warn(`Model ${modelId} average rating (${averageRating.toFixed(2)}) below retraining threshold`);
        this.emit('retrainingRequired', { 
          modelId, 
          averageRating, 
          feedbackCount: recentFeedback.length,
          reason: 'low_user_ratings'
        });
      }

      // Check for alert threshold
      if (averageRating <= this.thresholds.alertThreshold) {
        logger.error(`Model ${modelId} average rating (${averageRating.toFixed(2)}) critically low`);
        this.emit('criticalFeedbackAlert', { 
          modelId, 
          averageRating, 
          feedbackCount: recentFeedback.length 
        });
      }

      // Analyze feedback trends
      const trends = this.calculateFeedbackTrends(recentFeedback);
      const latestWeek = trends.weekly[trends.weekly.length - 1];
      const previousWeek = trends.weekly[trends.weekly.length - 2];

      if (latestWeek && previousWeek && latestWeek.averageRating < previousWeek.averageRating - 0.5) {
        logger.warn(`Model ${modelId} showing declining feedback trend`);
        this.emit('feedbackTrendAlert', { 
          modelId, 
          currentRating: latestWeek.averageRating,
          previousRating: previousWeek.averageRating
        });
      }

    } catch (error) {
      logger.error(`Failed to analyze feedback for model ${modelId}:`, error);
    }
  }

  /**
   * Calculate average rating
   */
  private calculateAverageRating(feedback: FeedbackData[]): number {
    if (feedback.length === 0) return 0;
    const sum = feedback.reduce((total, f) => total + f.userRating, 0);
    return sum / feedback.length;
  }

  /**
   * Calculate rating distribution
   */
  private calculateRatingDistribution(feedback: FeedbackData[]): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    feedback.forEach(f => {
      const rating = Math.floor(f.userRating);
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
      }
    });

    return distribution;
  }

  /**
   * Calculate feedback trends over time
   */
  private calculateFeedbackTrends(feedback: FeedbackData[]): FeedbackAnalytics['feedbackTrends'] {
    const dailyMap = new Map<string, { ratings: number[]; count: number }>();
    const weeklyMap = new Map<string, { ratings: number[]; count: number }>();

    feedback.forEach(f => {
      const date = f.submittedAt.toISOString().split('T')[0];
      const week = this.getWeekString(f.submittedAt);

      // Daily trends
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { ratings: [], count: 0 });
      }
      dailyMap.get(date)!.ratings.push(f.userRating);
      dailyMap.get(date)!.count++;

      // Weekly trends
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, { ratings: [], count: 0 });
      }
      weeklyMap.get(week)!.ratings.push(f.userRating);
      weeklyMap.get(week)!.count++;
    });

    const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      averageRating: data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length,
      count: data.count
    })).sort((a, b) => a.date.localeCompare(b.date));

    const weekly = Array.from(weeklyMap.entries()).map(([week, data]) => ({
      week,
      averageRating: data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length,
      count: data.count
    })).sort((a, b) => a.week.localeCompare(b.week));

    return { daily, weekly };
  }

  /**
   * Identify common issues from feedback
   */
  private async identifyCommonIssues(feedback: FeedbackData[]): Promise<Array<{ issue: string; frequency: number; examples: string[] }>> {
    // Simple keyword-based issue identification
    const issueKeywords = {
      'accuracy': ['wrong', 'incorrect', 'inaccurate', 'mistake', 'error'],
      'speed': ['slow', 'timeout', 'delay', 'performance'],
      'relevance': ['irrelevant', 'off-topic', 'unrelated', 'not helpful'],
      'completeness': ['incomplete', 'missing', 'partial', 'cut off'],
      'clarity': ['unclear', 'confusing', 'ambiguous', 'hard to understand']
    };

    const issues: Record<string, { frequency: number; examples: string[] }> = {};

    feedback.forEach(f => {
      if (f.userRating <= 3 && f.expectedOutput) {
        const text = f.expectedOutput.toLowerCase();
        
        Object.entries(issueKeywords).forEach(([issue, keywords]) => {
          const hasIssue = keywords.some(keyword => text.includes(keyword));
          if (hasIssue) {
            if (!issues[issue]) {
              issues[issue] = { frequency: 0, examples: [] };
            }
            issues[issue].frequency++;
            if (issues[issue].examples.length < 3) {
              issues[issue].examples.push(f.expectedOutput.substring(0, 100));
            }
          }
        });
      }
    });

    return Object.entries(issues)
      .map(([issue, data]) => ({ issue, ...data }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Generate improvement suggestions based on feedback
   */
  private generateImprovementSuggestions(feedback: FeedbackData[]): string[] {
    const suggestions: string[] = [];
    const lowRatingFeedback = feedback.filter(f => f.userRating <= 3);
    
    if (lowRatingFeedback.length === 0) {
      return ['Continue monitoring feedback for improvement opportunities'];
    }

    const averageRating = this.calculateAverageRating(feedback);
    
    if (averageRating < 3.0) {
      suggestions.push('Consider immediate model retraining with recent feedback data');
      suggestions.push('Review and update training datasets');
      suggestions.push('Implement additional quality checks before model responses');
    }

    if (averageRating < 3.5) {
      suggestions.push('Collect more diverse training examples');
      suggestions.push('Implement user preference learning');
      suggestions.push('Add context-aware response generation');
    }

    // Analyze feedback types
    const correctionFeedback = feedback.filter(f => f.feedbackType === 'correction');
    if (correctionFeedback.length > feedback.length * 0.3) {
      suggestions.push('Focus on accuracy improvements in training');
      suggestions.push('Implement correction-based fine-tuning');
    }

    const preferenceFeedback = feedback.filter(f => f.feedbackType === 'preference');
    if (preferenceFeedback.length > feedback.length * 0.2) {
      suggestions.push('Implement personalization features');
      suggestions.push('Add user preference modeling');
    }

    return suggestions.length > 0 ? suggestions : ['Monitor feedback trends and collect more data'];
  }

  /**
   * Validate feedback data
   */
  private validateFeedback(feedback: FeedbackData): void {
    if (!feedback.modelId) {
      throw new Error('Model ID is required');
    }

    if (!feedback.inputData) {
      throw new Error('Input data is required');
    }

    if (!feedback.actualOutput) {
      throw new Error('Actual output is required');
    }

    if (feedback.userRating < 1 || feedback.userRating > 5) {
      throw new Error('User rating must be between 1 and 5');
    }

    if (!['correction', 'rating', 'preference'].includes(feedback.feedbackType)) {
      throw new Error('Invalid feedback type');
    }
  }

  /**
   * Store feedback in cache and persistent storage
   */
  private async storeFeedback(feedback: FeedbackData): Promise<void> {
    try {
      // Store in cache
      await this.cache.set(`feedback:${feedback.id}`, JSON.stringify(feedback), 86400 * 30);
      
      // Store in model-specific list
      const modelFeedbackKey = `feedback:model:${feedback.modelId}`;
      const existingFeedback = await this.cache.get(modelFeedbackKey);
      const feedbackList = existingFeedback ? JSON.parse(existingFeedback) : [];
      feedbackList.push(feedback.id);
      
      // Keep only recent feedback IDs (last 1000)
      if (feedbackList.length > 1000) {
        feedbackList.splice(0, feedbackList.length - 1000);
      }
      
      await this.cache.set(modelFeedbackKey, JSON.stringify(feedbackList), 86400 * 30);
    } catch (error) {
      logger.error('Failed to store feedback:', error);
      throw error;
    }
  }

  /**
   * Load existing feedback from storage
   */
  private async loadExistingFeedback(): Promise<void> {
    try {
      // In a real implementation, this would load from database
      logger.info('Existing feedback loaded from storage');
    } catch (error) {
      logger.error('Failed to load existing feedback:', error);
    }
  }

  /**
   * Create empty analytics object
   */
  private createEmptyAnalytics(modelId: string): FeedbackAnalytics {
    return {
      modelId,
      totalFeedback: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      feedbackTrends: { daily: [], weekly: [] },
      commonIssues: [],
      improvementSuggestions: ['Collect initial feedback to generate suggestions']
    };
  }

  /**
   * Get week string for grouping
   */
  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Export feedback data for analysis
   */
  async exportFeedbackData(modelId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const feedback = await this.getModelFeedback(modelId, 365); // Last year
      
      if (format === 'csv') {
        const headers = ['id', 'modelId', 'inputData', 'expectedOutput', 'actualOutput', 'userRating', 'feedbackType', 'submittedBy', 'submittedAt'];
        const csvRows = feedback.map(f => [
          f.id,
          f.modelId,
          `"${f.inputData.replace(/"/g, '""')}"`,
          `"${f.expectedOutput.replace(/"/g, '""')}"`,
          `"${f.actualOutput.replace(/"/g, '""')}"`,
          f.userRating,
          f.feedbackType,
          f.submittedBy,
          f.submittedAt.toISOString()
        ].join(','));
        
        return [headers.join(','), ...csvRows].join('\n');
      }
      
      return JSON.stringify(feedback, null, 2);
    } catch (error) {
      logger.error(`Failed to export feedback data for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStatistics(): Promise<Record<string, any>> {
    try {
      const stats: Record<string, any> = {};
      
      for (const [modelId, feedback] of this.feedbackStore) {
        stats[modelId] = {
          totalFeedback: feedback.length,
          averageRating: this.calculateAverageRating(feedback),
          recentFeedback: feedback.filter(f => 
            Date.now() - f.submittedAt.getTime() < 7 * 24 * 60 * 60 * 1000
          ).length
        };
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get feedback statistics:', error);
      return {};
    }
  }
}