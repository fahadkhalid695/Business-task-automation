#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const Redis = require('redis');
const fs = require('fs');
const path = require('path');

class TestDataSeeder {
  constructor() {
    this.config = require('../configs/test-config.json');
    this.dbUrl = this.config.environments.development.database;
    this.redisUrl = this.config.environments.development.redis;
  }

  async seedAllTestData() {
    console.log('🌱 Seeding comprehensive test data...');
    
    try {
      // Connect to databases
      await this.connectDatabases();
      
      // Seed MongoDB collections
      await this.seedUsers();
      await this.seedWorkflows();
      await this.seedAIModels();
      await this.seedDataSources();
      await this.seedExecutions();
      await this.seedNotifications();
      
      // Seed Redis cache data
      await this.seedCacheData();
      
      // Create test files
      await this.createTestFiles();
      
      // Generate validation datasets
      await this.generateValidationDatasets();
      
      console.log('✅ Test data seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Test data seeding failed:', error.message);
      throw error;
    } finally {
      await this.closeDatabases();
    }
  }

  async connectDatabases() {
    this.mongoClient = new MongoClient(this.dbUrl);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db();
    
    this.redisClient = Redis.createClient({ url: this.redisUrl });
    await this.redisClient.connect();
    
    console.log('✅ Connected to databases');
  }

  async closeDatabases() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    console.log('✅ Database connections closed');
  }

  async seedUsers() {
    console.log('Seeding users...');
    
    const users = [
      {
        _id: 'admin-user-id',
        email: 'admin@test.com',
        password: '$2a$10$hashedpassword', // In real implementation, hash the password
        role: 'admin',
        name: 'Test Admin',
        createdAt: new Date(),
        isActive: true,
        permissions: ['all']
      },
      {
        _id: 'manager-user-id',
        email: 'manager@test.com',
        password: '$2a$10$hashedpassword',
        role: 'manager',
        name: 'Test Manager',
        createdAt: new Date(),
        isActive: true,
        permissions: ['workflows', 'users', 'reports']
      },
      {
        _id: 'user-user-id',
        email: 'user@test.com',
        password: '$2a$10$hashedpassword',
        role: 'user',
        name: 'Test User',
        createdAt: new Date(),
        isActive: true,
        permissions: ['workflows']
      },
      // Additional test users
      ...Array.from({ length: 10 }, (_, i) => ({
        _id: `test-user-${i + 1}`,
        email: `testuser${i + 1}@test.com`,
        password: '$2a$10$hashedpassword',
        role: 'user',
        name: `Test User ${i + 1}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        isActive: Math.random() > 0.1,
        permissions: ['workflows']
      }))
    ];

    await this.db.collection('users').deleteMany({});
    await this.db.collection('users').insertMany(users);
    
    console.log(`✅ Seeded ${users.length} users`);
  }

  async seedWorkflows() {
    console.log('Seeding workflows...');
    
    const workflows = [
      {
        _id: 'email-processing-workflow',
        name: 'Email Processing Workflow',
        description: 'Processes incoming emails and extracts data',
        type: 'email-processing',
        userId: 'admin-user-id',
        status: 'active',
        steps: [
          {
            id: 'step-1',
            type: 'email-trigger',
            name: 'Email Trigger',
            config: {
              filter: 'subject:invoice',
              folder: 'inbox'
            }
          },
          {
            id: 'step-2',
            type: 'ai-processing',
            name: 'AI Document Analysis',
            config: {
              model: 'document-classifier',
              confidence_threshold: 0.8
            }
          },
          {
            id: 'step-3',
            type: 'data-extraction',
            name: 'Data Extraction',
            config: {
              fields: ['invoice_number', 'amount', 'date', 'vendor']
            }
          }
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        isActive: true,
        tags: ['email', 'invoice', 'automation']
      },
      {
        _id: 'document-generation-workflow',
        name: 'Document Generation Workflow',
        description: 'Generates reports from data sources',
        type: 'document-generation',
        userId: 'manager-user-id',
        status: 'active',
        steps: [
          {
            id: 'step-1',
            type: 'data-source',
            name: 'Data Collection',
            config: {
              source: 'database',
              query: 'SELECT * FROM sales_data WHERE date >= ?'
            }
          },
          {
            id: 'step-2',
            type: 'data-transformation',
            name: 'Data Processing',
            config: {
              operations: ['aggregate', 'calculate_totals', 'format_currency']
            }
          },
          {
            id: 'step-3',
            type: 'document-generation',
            name: 'Report Generation',
            config: {
              template: 'sales-report-template',
              format: 'pdf'
            }
          }
        ],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date(),
        isActive: true,
        tags: ['reports', 'sales', 'pdf']
      },
      // Additional test workflows
      ...Array.from({ length: 20 }, (_, i) => ({
        _id: `test-workflow-${i + 1}`,
        name: `Test Workflow ${i + 1}`,
        description: `Test workflow for automated testing ${i + 1}`,
        type: ['email-processing', 'document-generation', 'data-analysis'][i % 3],
        userId: ['admin-user-id', 'manager-user-id', 'user-user-id'][i % 3],
        status: ['active', 'inactive', 'draft'][i % 3],
        steps: [
          {
            id: 'step-1',
            type: 'trigger',
            name: 'Trigger Step',
            config: {}
          }
        ],
        createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        isActive: Math.random() > 0.2,
        tags: [`test-${i}`, 'automation']
      }))
    ];

    await this.db.collection('workflows').deleteMany({});
    await this.db.collection('workflows').insertMany(workflows);
    
    console.log(`✅ Seeded ${workflows.length} workflows`);
  }

  async seedAIModels() {
    console.log('Seeding AI models...');
    
    const models = [
      {
        _id: 'document-classifier',
        name: 'Document Classifier',
        description: 'Classifies documents by type and content',
        type: 'classification',
        version: '1.0.0',
        status: 'deployed',
        accuracy: 0.95,
        trainingData: {
          samples: 10000,
          features: 512,
          classes: ['invoice', 'receipt', 'contract', 'report']
        },
        performance: {
          inferenceTime: 150,
          throughput: 1000,
          memoryUsage: 256
        },
        createdAt: new Date('2024-01-01'),
        deployedAt: new Date('2024-01-05'),
        lastUpdated: new Date()
      },
      {
        _id: 'sentiment-analyzer',
        name: 'Sentiment Analyzer',
        description: 'Analyzes sentiment in text content',
        type: 'classification',
        version: '2.1.0',
        status: 'deployed',
        accuracy: 0.92,
        trainingData: {
          samples: 50000,
          features: 768,
          classes: ['positive', 'negative', 'neutral']
        },
        performance: {
          inferenceTime: 100,
          throughput: 1500,
          memoryUsage: 512
        },
        createdAt: new Date('2023-12-01'),
        deployedAt: new Date('2024-01-10'),
        lastUpdated: new Date()
      },
      {
        _id: 'text-summarizer',
        name: 'Text Summarizer',
        description: 'Generates summaries of long text documents',
        type: 'generation',
        version: '1.5.0',
        status: 'training',
        accuracy: 0.88,
        trainingData: {
          samples: 25000,
          features: 1024,
          classes: null
        },
        performance: {
          inferenceTime: 500,
          throughput: 200,
          memoryUsage: 1024
        },
        createdAt: new Date('2024-01-20'),
        deployedAt: null,
        lastUpdated: new Date()
      }
    ];

    await this.db.collection('models').deleteMany({});
    await this.db.collection('models').insertMany(models);
    
    console.log(`✅ Seeded ${models.length} AI models`);
  }

  async seedDataSources() {
    console.log('Seeding data sources...');
    
    const dataSources = [
      {
        _id: 'email-server-1',
        name: 'Primary Email Server',
        type: 'email',
        config: {
          host: 'imap.test.com',
          port: 993,
          secure: true,
          username: 'test@test.com'
        },
        status: 'active',
        lastSync: new Date(),
        createdAt: new Date('2024-01-01')
      },
      {
        _id: 'database-1',
        name: 'Sales Database',
        type: 'database',
        config: {
          host: 'localhost',
          port: 5432,
          database: 'sales_db',
          username: 'sales_user'
        },
        status: 'active',
        lastSync: new Date(),
        createdAt: new Date('2024-01-01')
      },
      {
        _id: 'file-storage-1',
        name: 'Document Storage',
        type: 'file_storage',
        config: {
          type: 's3',
          bucket: 'test-documents',
          region: 'us-east-1'
        },
        status: 'active',
        lastSync: new Date(),
        createdAt: new Date('2024-01-01')
      }
    ];

    await this.db.collection('data_sources').deleteMany({});
    await this.db.collection('data_sources').insertMany(dataSources);
    
    console.log(`✅ Seeded ${dataSources.length} data sources`);
  }

  async seedExecutions() {
    console.log('Seeding workflow executions...');
    
    const executions = [];
    const workflows = ['email-processing-workflow', 'document-generation-workflow'];
    const statuses = ['completed', 'failed', 'running', 'queued'];
    
    // Generate execution history
    for (let i = 0; i < 100; i++) {
      const workflowId = workflows[i % workflows.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const duration = Math.random() * 300000; // 0-5 minutes
      
      executions.push({
        _id: `execution-${i + 1}`,
        workflowId,
        userId: 'admin-user-id',
        status,
        input: {
          test: true,
          executionNumber: i + 1
        },
        output: status === 'completed' ? {
          result: 'success',
          processedItems: Math.floor(Math.random() * 100)
        } : null,
        error: status === 'failed' ? {
          message: 'Test error for demonstration',
          code: 'TEST_ERROR'
        } : null,
        startedAt: startTime,
        completedAt: status === 'completed' || status === 'failed' ? 
          new Date(startTime.getTime() + duration) : null,
        duration: status === 'completed' || status === 'failed' ? duration : null,
        steps: [
          {
            stepId: 'step-1',
            status: 'completed',
            startedAt: startTime,
            completedAt: new Date(startTime.getTime() + duration * 0.3),
            output: { processed: true }
          }
        ]
      });
    }

    await this.db.collection('executions').deleteMany({});
    await this.db.collection('executions').insertMany(executions);
    
    console.log(`✅ Seeded ${executions.length} workflow executions`);
  }

  async seedNotifications() {
    console.log('Seeding notifications...');
    
    const notifications = [];
    const types = ['info', 'warning', 'error', 'success'];
    
    for (let i = 0; i < 50; i++) {
      notifications.push({
        _id: `notification-${i + 1}`,
        userId: ['admin-user-id', 'manager-user-id', 'user-user-id'][i % 3],
        type: types[i % types.length],
        title: `Test Notification ${i + 1}`,
        message: `This is a test notification message ${i + 1}`,
        read: Math.random() > 0.3,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        data: {
          workflowId: i % 2 === 0 ? 'email-processing-workflow' : null,
          executionId: i % 3 === 0 ? `execution-${i + 1}` : null
        }
      });
    }

    await this.db.collection('notifications').deleteMany({});
    await this.db.collection('notifications').insertMany(notifications);
    
    console.log(`✅ Seeded ${notifications.length} notifications`);
  }

  async seedCacheData() {
    console.log('Seeding Redis cache data...');
    
    // Seed session data
    await this.redisClient.setEx('session:admin-session', 3600, JSON.stringify({
      userId: 'admin-user-id',
      role: 'admin',
      loginTime: new Date().toISOString()
    }));
    
    // Seed workflow cache
    await this.redisClient.setEx('workflow:email-processing-workflow:cache', 1800, JSON.stringify({
      lastExecution: new Date().toISOString(),
      executionCount: 150,
      averageDuration: 45000
    }));
    
    // Seed model performance cache
    await this.redisClient.setEx('model:document-classifier:performance', 3600, JSON.stringify({
      accuracy: 0.95,
      throughput: 1000,
      lastUpdated: new Date().toISOString()
    }));
    
    console.log('✅ Seeded Redis cache data');
  }

  async createTestFiles() {
    console.log('Creating test files...');
    
    const testFilesDir = path.join(process.cwd(), 'testing/data-quality/datasets');
    
    // Ensure directory exists
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    
    // Create test CSV files
    const customersCSV = `id,name,email,department,created_at
1,John Doe,john.doe@test.com,IT,2024-01-01
2,Jane Smith,jane.smith@test.com,HR,2024-01-02
3,Bob Johnson,bob.johnson@test.com,Finance,2024-01-03
4,Alice Brown,alice.brown@test.com,Marketing,2024-01-04
5,Charlie Wilson,charlie.wilson@test.com,IT,2024-01-05`;

    fs.writeFileSync(path.join(testFilesDir, 'customers.csv'), customersCSV);
    
    const transactionsCSV = `id,customer_id,amount,date,type
1,1,100.50,2024-01-01,purchase
2,2,250.00,2024-01-02,purchase
3,1,75.25,2024-01-03,refund
4,3,500.00,2024-01-04,purchase
5,2,125.75,2024-01-05,purchase`;

    fs.writeFileSync(path.join(testFilesDir, 'transactions.csv'), transactionsCSV);
    
    const productsCSV = `id,name,price,category,in_stock
1,Laptop,999.99,Electronics,true
2,Mouse,29.99,Electronics,true
3,Keyboard,79.99,Electronics,false
4,Monitor,299.99,Electronics,true
5,Headphones,149.99,Electronics,true`;

    fs.writeFileSync(path.join(testFilesDir, 'products.csv'), productsCSV);
    
    console.log('✅ Created test CSV files');
  }

  async generateValidationDatasets() {
    console.log('Generating validation datasets...');
    
    const validationDir = path.join(process.cwd(), 'testing/data-quality/datasets');
    
    // Generate classification validation data
    const classificationData = {
      inputs: [
        "This is a positive review of the product",
        "Terrible service, would not recommend",
        "Average experience, nothing special",
        "Excellent quality and fast delivery",
        "Poor customer support response"
      ],
      true_labels: ["positive", "negative", "neutral", "positive", "negative"]
    };
    
    fs.writeFileSync(
      path.join(validationDir, 'validation_classification.json'),
      JSON.stringify(classificationData, null, 2)
    );
    
    // Generate regression validation data
    const regressionData = {
      inputs: Array.from({ length: 100 }, () => 
        Array.from({ length: 5 }, () => Math.random() * 10)
      ),
      true_labels: Array.from({ length: 100 }, () => Math.random() * 100)
    };
    
    fs.writeFileSync(
      path.join(validationDir, 'validation_regression.json'),
      JSON.stringify(regressionData, null, 2)
    );
    
    console.log('✅ Generated validation datasets');
  }
}

// Run seeding if called directly
if (require.main === module) {
  const seeder = new TestDataSeeder();
  seeder.seedAllTestData().catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = TestDataSeeder;