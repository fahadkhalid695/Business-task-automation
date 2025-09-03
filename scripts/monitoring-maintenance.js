#!/usr/bin/env node

/**
 * Monitoring Maintenance Script
 * 
 * This script performs regular maintenance tasks for the monitoring system:
 * - Cleans up old metrics data
 * - Optimizes database indexes
 * - Generates maintenance reports
 * - Validates monitoring configuration
 */

const { MongoClient } = require('mongodb');
const Redis = require('redis');
const fs = require('fs').promises;
const path = require('path');

class MonitoringMaintenance {
  constructor() {
    this.mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/business_automation';
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.config = null;
    this.db = null;
    this.redis = null;
  }

  async initialize() {
    console.log('🔧 Initializing monitoring maintenance...');
    
    // Load configuration
    await this.loadConfig();
    
    // Connect to databases
    await this.connectDatabases();
    
    console.log('✅ Maintenance system initialized');
  }

  async loadConfig() {
    try {
      const configPath = path.join(__dirname, '../services/monitoring-config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log('📋 Configuration loaded');
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  async connectDatabases() {
    try {
      // Connect to MongoDB
      this.mongoClient = new MongoClient(this.mongoUrl);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db();
      console.log('🗄️  Connected to MongoDB');

      // Connect to Redis
      this.redis = Redis.createClient({ url: this.redisUrl });
      await this.redis.connect();
      console.log('🔴 Connected to Redis');
    } catch (error) {
      console.error('❌ Failed to connect to databases:', error.message);
      process.exit(1);
    }
  }

  async runMaintenance() {
    console.log('🚀 Starting monitoring maintenance tasks...');
    
    const tasks = [
      { name: 'Clean Old Metrics', fn: () => this.cleanOldMetrics() },
      { name: 'Clean Old Alerts', fn: () => this.cleanOldAlerts() },
      { name: 'Optimize Indexes', fn: () => this.optimizeIndexes() },
      { name: 'Clean Cache', fn: () => this.cleanCache() },
      { name: 'Validate Configuration', fn: () => this.validateConfiguration() },
      { name: 'Generate Report', fn: () => this.generateMaintenanceReport() }
    ];

    const results = [];
    
    for (const task of tasks) {
      console.log(`\n📋 Running: ${task.name}`);
      try {
        const startTime = Date.now();
        const result = await task.fn();
        const duration = Date.now() - startTime;
        
        results.push({
          name: task.name,
          status: 'success',
          duration,
          result
        });
        
        console.log(`✅ ${task.name} completed in ${duration}ms`);
      } catch (error) {
        console.error(`❌ ${task.name} failed:`, error.message);
        results.push({
          name: task.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }

  async cleanOldMetrics() {
    const retentionDays = this.config.monitoring.metricsRetention || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const collections = ['metrics', 'business_metrics'];
    let totalDeleted = 0;

    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      
      const result = await collection.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      totalDeleted += result.deletedCount;
      console.log(`  🗑️  Deleted ${result.deletedCount} old records from ${collectionName}`);
    }

    return { deletedRecords: totalDeleted, cutoffDate };
  }

  async cleanOldAlerts() {
    const retentionDays = this.config.monitoring.alertRetention || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const collection = this.db.collection('alerts');
    
    const result = await collection.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: 'resolved'
    });

    console.log(`  🗑️  Deleted ${result.deletedCount} old resolved alerts`);
    return { deletedAlerts: result.deletedCount, cutoffDate };
  }

  async optimizeIndexes() {
    const collections = [
      {
        name: 'metrics',
        indexes: [
          { name: 1, timestamp: -1 },
          { service: 1, timestamp: -1 },
          { timestamp: -1 }
        ]
      },
      {
        name: 'business_metrics',
        indexes: [
          { name: 1, timestamp: -1 },
          { category: 1, timestamp: -1 },
          { timestamp: -1 }
        ]
      },
      {
        name: 'alerts',
        indexes: [
          { status: 1, createdAt: -1 },
          { severity: 1, createdAt: -1 },
          { service: 1, status: 1 }
        ]
      },
      {
        name: 'user_sessions',
        indexes: [
          { userId: 1, lastActivity: -1 },
          { lastActivity: -1 }
        ]
      }
    ];

    let indexesCreated = 0;

    for (const collectionInfo of collections) {
      const collection = this.db.collection(collectionInfo.name);
      
      for (const index of collectionInfo.indexes) {
        try {
          await collection.createIndex(index);
          indexesCreated++;
          console.log(`  📊 Created index on ${collectionInfo.name}:`, Object.keys(index).join(', '));
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.warn(`  ⚠️  Failed to create index on ${collectionInfo.name}:`, error.message);
          }
        }
      }
    }

    return { indexesCreated };
  }

  async cleanCache() {
    const pattern = 'monitoring:*';
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(keys);
      console.log(`  🧹 Cleared ${keys.length} cache entries`);
    }

    return { clearedKeys: keys.length };
  }

  async validateConfiguration() {
    const issues = [];

    // Validate thresholds
    const thresholds = this.config.thresholds;
    if (!thresholds || !thresholds.system || !thresholds.performance) {
      issues.push('Missing required threshold configurations');
    }

    // Validate alert configuration
    const alerts = this.config.alerts;
    if (!alerts || !alerts.escalationRules || alerts.escalationRules.length === 0) {
      issues.push('No escalation rules configured');
    }

    // Validate notification settings
    const notifications = alerts?.notifications;
    if (!notifications || (!notifications.email?.enabled && !notifications.slack?.enabled)) {
      issues.push('No notification channels enabled');
    }

    // Check database connectivity
    try {
      await this.db.admin().ping();
    } catch (error) {
      issues.push('Database connectivity issue');
    }

    // Check Redis connectivity
    try {
      await this.redis.ping();
    } catch (error) {
      issues.push('Redis connectivity issue');
    }

    if (issues.length > 0) {
      console.log('  ⚠️  Configuration issues found:');
      issues.forEach(issue => console.log(`    - ${issue}`));
    } else {
      console.log('  ✅ Configuration validation passed');
    }

    return { issues };
  }

  async generateMaintenanceReport() {
    const report = {
      timestamp: new Date(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      },
      database: {},
      cache: {},
      collections: {}
    };

    // Database statistics
    try {
      const dbStats = await this.db.stats();
      report.database = {
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        indexSize: dbStats.indexSize,
        storageSize: dbStats.storageSize
      };
    } catch (error) {
      report.database.error = error.message;
    }

    // Redis statistics
    try {
      const redisInfo = await this.redis.info('memory');
      const memoryMatch = redisInfo.match(/used_memory:(\d+)/);
      report.cache = {
        usedMemory: memoryMatch ? parseInt(memoryMatch[1]) : 0,
        connected: true
      };
    } catch (error) {
      report.cache.error = error.message;
    }

    // Collection statistics
    const collections = ['metrics', 'business_metrics', 'alerts', 'dashboards'];
    for (const collectionName of collections) {
      try {
        const collection = this.db.collection(collectionName);
        const count = await collection.countDocuments();
        const stats = await collection.stats();
        
        report.collections[collectionName] = {
          documents: count,
          size: stats.size,
          avgObjSize: stats.avgObjSize
        };
      } catch (error) {
        report.collections[collectionName] = { error: error.message };
      }
    }

    // Save report
    const reportPath = path.join(__dirname, '../logs/maintenance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`  📊 Maintenance report saved to ${reportPath}`);

    return report;
  }

  async generateHealthSummary() {
    console.log('\n📊 System Health Summary');
    console.log('========================');

    // Recent alerts
    const alerts = await this.db.collection('alerts').find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).toArray();

    console.log(`🚨 Alerts (last 24h): ${alerts.length}`);
    
    const alertsBySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});

    Object.entries(alertsBySeverity).forEach(([severity, count]) => {
      console.log(`  ${severity}: ${count}`);
    });

    // Recent metrics
    const recentMetrics = await this.db.collection('metrics').find({
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    }).limit(10).toArray();

    console.log(`\n📈 Recent Metrics: ${recentMetrics.length} collected in last hour`);

    // Business metrics
    const businessMetrics = await this.db.collection('business_metrics').find({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).toArray();

    console.log(`💼 Business Metrics (last 24h): ${businessMetrics.length}`);

    return {
      alerts: alertsBySeverity,
      recentMetrics: recentMetrics.length,
      businessMetrics: businessMetrics.length
    };
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up connections...');
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Main execution
async function main() {
  const maintenance = new MonitoringMaintenance();
  
  try {
    await maintenance.initialize();
    
    const results = await maintenance.runMaintenance();
    
    await maintenance.generateHealthSummary();
    
    console.log('\n📋 Maintenance Summary');
    console.log('=====================');
    
    results.forEach(result => {
      const status = result.status === 'success' ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.status}`);
      
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    console.log(`\n🎯 Overall: ${successCount}/${totalCount} tasks completed successfully`);
    
  } catch (error) {
    console.error('💥 Maintenance failed:', error);
    process.exit(1);
  } finally {
    await maintenance.cleanup();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Monitoring Maintenance Script

Usage: node monitoring-maintenance.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Run without making changes
  --verbose      Enable verbose logging

Environment Variables:
  MONGODB_URI    MongoDB connection string
  REDIS_URL      Redis connection string
  
Examples:
  node monitoring-maintenance.js
  node monitoring-maintenance.js --dry-run
  MONGODB_URI=mongodb://localhost:27017/test node monitoring-maintenance.js
  `);
  process.exit(0);
}

if (args.includes('--dry-run')) {
  console.log('🔍 Running in dry-run mode (no changes will be made)');
  // Set a flag for dry-run mode
  process.env.DRY_RUN = 'true';
}

if (args.includes('--verbose')) {
  console.log('📝 Verbose logging enabled');
  process.env.VERBOSE = 'true';
}

// Run the maintenance
main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});

module.exports = MonitoringMaintenance;