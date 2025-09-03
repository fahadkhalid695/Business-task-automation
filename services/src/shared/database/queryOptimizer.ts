import mongoose from 'mongoose';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

const logger = new Logger('QueryOptimizer');
const metrics = MetricsCollector.getInstance();

export interface QueryPerformanceStats {
  query: string;
  executionTime: number;
  documentsExamined: number;
  documentsReturned: number;
  indexesUsed: string[];
  timestamp: Date;
}

export interface IndexRecommendation {
  collection: string;
  fields: Record<string, 1 | -1>;
  reason: string;
  estimatedImprovement: number;
}

export class QueryOptimizer {
  private static instance: QueryOptimizer;
  private queryStats: Map<string, QueryPerformanceStats[]> = new Map();
  private slowQueryThreshold: number = 100; // ms
  private indexRecommendations: IndexRecommendation[] = [];

  private constructor() {
    this.setupQueryProfiling();
    this.startPerformanceMonitoring();
  }

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  private setupQueryProfiling(): void {
    // Enable MongoDB profiling for slow queries
    mongoose.connection.on('connected', async () => {
      try {
        await mongoose.connection.db.admin().command({
          profile: 2,
          slowms: this.slowQueryThreshold,
          sampleRate: 1.0
        });
        logger.info('Database profiling enabled');
      } catch (error) {
        logger.error('Failed to enable database profiling', error);
      }
    });
  }

  private startPerformanceMonitoring(): void {
    // Monitor query performance every 5 minutes
    setInterval(() => {
      this.analyzeQueryPerformance();
    }, 5 * 60 * 1000);

    // Generate index recommendations every hour
    setInterval(() => {
      this.generateIndexRecommendations();
    }, 60 * 60 * 1000);
  }

  async recordQuery(
    collection: string,
    query: any,
    executionTime: number,
    stats: any
  ): Promise<void> {
    const queryKey = `${collection}:${JSON.stringify(query)}`;
    const queryStats: QueryPerformanceStats = {
      query: queryKey,
      executionTime,
      documentsExamined: stats.totalDocsExamined || 0,
      documentsReturned: stats.totalDocsReturned || 0,
      indexesUsed: stats.indexesUsed || [],
      timestamp: new Date()
    };

    const existingStats = this.queryStats.get(queryKey) || [];
    existingStats.push(queryStats);

    // Keep only last 1000 entries per query
    if (existingStats.length > 1000) {
      existingStats.shift();
    }

    this.queryStats.set(queryKey, existingStats);

    // Record metrics
    metrics.recordHistogram('db_query_duration_ms', executionTime, {
      collection,
      slow: (executionTime > this.slowQueryThreshold).toString()
    });

    metrics.setGauge('db_documents_examined', stats.totalDocsExamined || 0, {
      collection
    });

    if (executionTime > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        collection,
        executionTime,
        query: JSON.stringify(query),
        stats
      });

      metrics.incrementCounter('db_slow_queries_total', 1, { collection });
    }
  }

  private async analyzeQueryPerformance(): Promise<void> {
    try {
      // Get profiling data from MongoDB
      const profilingData = await mongoose.connection.db
        .collection('system.profile')
        .find({
          ts: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        })
        .toArray();

      for (const profile of profilingData) {
        if (profile.command && profile.ns) {
          const collection = profile.ns.split('.')[1];
          await this.recordQuery(
            collection,
            profile.command,
            profile.millis,
            {
              totalDocsExamined: profile.docsExamined,
              totalDocsReturned: profile.nreturned,
              indexesUsed: profile.planSummary ? [profile.planSummary] : []
            }
          );
        }
      }
    } catch (error) {
      logger.error('Failed to analyze query performance', error);
    }
  }

  private async generateIndexRecommendations(): Promise<void> {
    try {
      const recommendations: IndexRecommendation[] = [];

      for (const [queryKey, stats] of this.queryStats) {
        const [collection] = queryKey.split(':');
        const avgExecutionTime = stats.reduce((sum, s) => sum + s.executionTime, 0) / stats.length;
        const avgDocsExamined = stats.reduce((sum, s) => sum + s.documentsExamined, 0) / stats.length;
        const avgDocsReturned = stats.reduce((sum, s) => sum + s.documentsReturned, 0) / stats.length;

        // Recommend index if query is slow and examines many documents
        if (avgExecutionTime > this.slowQueryThreshold && avgDocsExamined > avgDocsReturned * 10) {
          try {
            const query = JSON.parse(queryKey.split(':', 2)[1]);
            const indexFields = this.extractIndexFields(query);

            if (Object.keys(indexFields).length > 0) {
              recommendations.push({
                collection,
                fields: indexFields,
                reason: `Slow query with high document examination ratio (${(avgDocsExamined / avgDocsReturned).toFixed(2)})`,
                estimatedImprovement: Math.min(90, (avgDocsExamined / avgDocsReturned) * 10)
              });
            }
          } catch (error) {
            logger.debug('Failed to parse query for index recommendation', { queryKey });
          }
        }
      }

      this.indexRecommendations = recommendations;
      
      if (recommendations.length > 0) {
        logger.info(`Generated ${recommendations.length} index recommendations`, {
          recommendations: recommendations.slice(0, 5) // Log first 5
        });
      }
    } catch (error) {
      logger.error('Failed to generate index recommendations', error);
    }
  }

  private extractIndexFields(query: any): Record<string, 1 | -1> {
    const fields: Record<string, 1 | -1> = {};

    const extractFromObject = (obj: any, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        if (key === '$and' || key === '$or') {
          if (Array.isArray(value)) {
            value.forEach(condition => extractFromObject(condition, prefix));
          }
        } else if (key.startsWith('$')) {
          // Skip operators
          continue;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Handle nested objects
          if (Object.keys(value).some(k => k.startsWith('$'))) {
            // This is a field with operators
            fields[fieldPath] = 1;
          } else {
            extractFromObject(value, fieldPath);
          }
        } else {
          // Simple field
          fields[fieldPath] = 1;
        }
      }
    };

    extractFromObject(query);
    return fields;
  }

  async createRecommendedIndexes(): Promise<void> {
    for (const recommendation of this.indexRecommendations) {
      try {
        const collection = mongoose.connection.db.collection(recommendation.collection);
        await collection.createIndex(recommendation.fields);
        
        logger.info('Created recommended index', {
          collection: recommendation.collection,
          fields: recommendation.fields,
          reason: recommendation.reason
        });

        metrics.incrementCounter('db_indexes_created_total', 1, {
          collection: recommendation.collection
        });
      } catch (error) {
        logger.error('Failed to create recommended index', error, {
          collection: recommendation.collection,
          fields: recommendation.fields
        });
      }
    }

    // Clear recommendations after processing
    this.indexRecommendations = [];
  }

  getQueryStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [queryKey, queryStats] of this.queryStats) {
      const avgExecutionTime = queryStats.reduce((sum, s) => sum + s.executionTime, 0) / queryStats.length;
      const maxExecutionTime = Math.max(...queryStats.map(s => s.executionTime));
      const totalExecutions = queryStats.length;

      stats[queryKey] = {
        totalExecutions,
        avgExecutionTime,
        maxExecutionTime,
        lastExecution: queryStats[queryStats.length - 1]?.timestamp
      };
    }

    return {
      queries: stats,
      recommendations: this.indexRecommendations,
      slowQueryThreshold: this.slowQueryThreshold
    };
  }

  async getCollectionStats(): Promise<Record<string, any>> {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const stats: Record<string, any> = {};

    for (const collection of collections) {
      try {
        const collectionStats = await mongoose.connection.db
          .collection(collection.name)
          .stats();

        const indexes = await mongoose.connection.db
          .collection(collection.name)
          .listIndexes()
          .toArray();

        stats[collection.name] = {
          documentCount: collectionStats.count,
          avgDocumentSize: collectionStats.avgObjSize,
          totalSize: collectionStats.size,
          indexCount: indexes.length,
          indexes: indexes.map(idx => ({
            name: idx.name,
            keys: idx.key,
            unique: idx.unique || false
          }))
        };
      } catch (error) {
        logger.debug(`Failed to get stats for collection ${collection.name}`, error);
      }
    }

    return stats;
  }
}

// Mongoose plugin to automatically track query performance
export function queryOptimizationPlugin(schema: mongoose.Schema) {
  const optimizer = QueryOptimizer.getInstance();

  schema.pre(/^find/, function() {
    this.startTime = Date.now();
  });

  schema.post(/^find/, async function(result) {
    if (this.startTime) {
      const executionTime = Date.now() - this.startTime;
      const collection = this.getQuery().constructor.name;
      
      await optimizer.recordQuery(
        collection,
        this.getQuery(),
        executionTime,
        {
          totalDocsExamined: result?.length || 0,
          totalDocsReturned: result?.length || 0,
          indexesUsed: []
        }
      );
    }
  });
}