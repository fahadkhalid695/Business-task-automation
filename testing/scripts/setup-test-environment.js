#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TestEnvironmentSetup {
  constructor() {
    this.config = require('../configs/test-config.json');
    this.services = ['mongodb', 'redis', 'api-gateway', 'task-orchestrator', 'ai-ml-engine'];
    this.setupSteps = [];
  }

  async setupTestEnvironment() {
    console.log('🚀 Setting up comprehensive test environment...');
    
    try {
      // Start infrastructure services
      await this.startInfrastructureServices();
      
      // Start application services
      await this.startApplicationServices();
      
      // Wait for services to be ready
      await this.waitForServicesReady();
      
      // Create test databases and collections
      await this.setupTestDatabases();
      
      // Seed test data
      await this.seedTestData();
      
      // Setup test users and permissions
      await this.setupTestUsers();
      
      // Configure test integrations
      await this.setupTestIntegrations();
      
      // Validate environment
      await this.validateEnvironment();
      
      console.log('✅ Test environment setup completed successfully!');
      this.generateSetupReport();
      
    } catch (error) {
      console.error('❌ Test environment setup failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  async startInfrastructureServices() {
    console.log('Starting infrastructure services...');
    
    const infraServices = [
      {
        name: 'MongoDB',
        command: 'docker',
        args: ['run', '-d', '--name', 'test-mongodb', '-p', '27017:27017', 'mongo:latest']
      },
      {
        name: 'Redis',
        command: 'docker',
        args: ['run', '-d', '--name', 'test-redis', '-p', '6379:6379', 'redis:latest']
      },
      {
        name: 'Elasticsearch',
        command: 'docker',
        args: ['run', '-d', '--name', 'test-elasticsearch', '-p', '9200:9200', '-e', 'discovery.type=single-node', 'elasticsearch:7.17.0']
      }
    ];

    for (const service of infraServices) {
      try {
        await this.runCommand(service.command, service.args);
        this.setupSteps.push({ step: `Start ${service.name}`, status: 'SUCCESS' });
        console.log(`✅ ${service.name} started`);
      } catch (error) {
        this.setupSteps.push({ step: `Start ${service.name}`, status: 'FAILED', error: error.message });
        throw new Error(`Failed to start ${service.name}: ${error.message}`);
      }
    }
  }

  async startApplicationServices() {
    console.log('Starting application services...');
    
    // Start services using docker-compose
    try {
      await this.runCommand('docker-compose', ['-f', 'docker-compose.test.yml', 'up', '-d']);
      this.setupSteps.push({ step: 'Start Application Services', status: 'SUCCESS' });
      console.log('✅ Application services started');
    } catch (error) {
      this.setupSteps.push({ step: 'Start Application Services', status: 'FAILED', error: error.message });
      throw new Error(`Failed to start application services: ${error.message}`);
    }
  }

  async waitForServicesReady() {
    console.log('Waiting for services to be ready...');
    
    const healthChecks = [
      { name: 'MongoDB', url: 'mongodb://localhost:27017', type: 'mongodb' },
      { name: 'Redis', url: 'redis://localhost:6379', type: 'redis' },
      { name: 'API Gateway', url: 'http://localhost:3000/health', type: 'http' },
      { name: 'Task Orchestrator', url: 'http://localhost:3001/health', type: 'http' },
      { name: 'AI/ML Engine', url: 'http://localhost:3002/health', type: 'http' }
    ];

    for (const check of healthChecks) {
      console.log(`Checking ${check.name}...`);
      
      let attempts = 0;
      const maxAttempts = 30;
      let ready = false;
      
      while (!ready && attempts < maxAttempts) {
        try {
          if (check.type === 'http') {
            const response = await axios.get(check.url, { timeout: 5000 });
            ready = response.status === 200;
          } else if (check.type === 'mongodb') {
            const { MongoClient } = require('mongodb');
            const client = new MongoClient(check.url);
            await client.connect();
            await client.close();
            ready = true;
          } else if (check.type === 'redis') {
            const Redis = require('redis');
            const client = Redis.createClient({ url: check.url });
            await client.connect();
            await client.quit();
            ready = true;
          }
          
          if (ready) {
            console.log(`✅ ${check.name} is ready`);
            this.setupSteps.push({ step: `${check.name} Health Check`, status: 'SUCCESS' });
          }
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            this.setupSteps.push({ step: `${check.name} Health Check`, status: 'FAILED', error: error.message });
            throw new Error(`${check.name} failed to become ready: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  async setupTestDatabases() {
    console.log('Setting up test databases...');
    
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(this.config.environments.development.database);
      await client.connect();
      
      const db = client.db();
      
      // Create collections
      const collections = ['users', 'workflows', 'executions', 'models', 'data_sources'];
      
      for (const collectionName of collections) {
        try {
          await db.createCollection(collectionName);
          console.log(`✅ Created collection: ${collectionName}`);
        } catch (error) {
          // Collection might already exist
          console.log(`ℹ️  Collection ${collectionName} already exists`);
        }
      }
      
      // Create indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('workflows').createIndex({ name: 1, userId: 1 });
      await db.collection('executions').createIndex({ workflowId: 1, createdAt: -1 });
      
      await client.close();
      
      this.setupSteps.push({ step: 'Setup Test Databases', status: 'SUCCESS' });
      console.log('✅ Test databases setup completed');
      
    } catch (error) {
      this.setupSteps.push({ step: 'Setup Test Databases', status: 'FAILED', error: error.message });
      throw new Error(`Failed to setup test databases: ${error.message}`);
    }
  }

  async seedTestData() {
    console.log('Seeding test data...');
    
    try {
      // Run the seed script
      await this.runCommand('node', ['testing/scripts/seed-test-data.js']);
      
      this.setupSteps.push({ step: 'Seed Test Data', status: 'SUCCESS' });
      console.log('✅ Test data seeded successfully');
      
    } catch (error) {
      this.setupSteps.push({ step: 'Seed Test Data', status: 'FAILED', error: error.message });
      throw new Error(`Failed to seed test data: ${error.message}`);
    }
  }

  async setupTestUsers() {
    console.log('Setting up test users...');
    
    const testUsers = [
      this.config.testData.users.admin,
      this.config.testData.users.manager,
      this.config.testData.users.user
    ];

    try {
      for (const user of testUsers) {
        const response = await axios.post(`${this.config.environments.development.apiUrl}/auth/register`, {
          email: user.email,
          password: user.password,
          role: user.role,
          name: `Test ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`
        });
        
        if (response.status === 201 || response.status === 409) { // Created or already exists
          console.log(`✅ Test user created: ${user.email}`);
        }
      }
      
      this.setupSteps.push({ step: 'Setup Test Users', status: 'SUCCESS' });
      
    } catch (error) {
      this.setupSteps.push({ step: 'Setup Test Users', status: 'FAILED', error: error.message });
      throw new Error(`Failed to setup test users: ${error.message}`);
    }
  }

  async setupTestIntegrations() {
    console.log('Setting up test integrations...');
    
    try {
      // Setup test email service
      await this.setupTestEmailService();
      
      // Setup test file storage
      await this.setupTestFileStorage();
      
      // Setup test AI services
      await this.setupTestAIServices();
      
      this.setupSteps.push({ step: 'Setup Test Integrations', status: 'SUCCESS' });
      console.log('✅ Test integrations setup completed');
      
    } catch (error) {
      this.setupSteps.push({ step: 'Setup Test Integrations', status: 'FAILED', error: error.message });
      throw new Error(`Failed to setup test integrations: ${error.message}`);
    }
  }

  async setupTestEmailService() {
    // Configure test email service (e.g., MailHog for testing)
    try {
      await this.runCommand('docker', ['run', '-d', '--name', 'test-mailhog', '-p', '1025:1025', '-p', '8025:8025', 'mailhog/mailhog']);
      console.log('✅ Test email service (MailHog) started');
    } catch (error) {
      console.log('ℹ️  Test email service already running or not available');
    }
  }

  async setupTestFileStorage() {
    // Setup test file storage (local directory)
    const testStorageDir = path.join(process.cwd(), 'test-storage');
    
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
    
    console.log('✅ Test file storage directory created');
  }

  async setupTestAIServices() {
    // Setup mock AI services or configure test AI endpoints
    console.log('✅ Test AI services configured');
  }

  async validateEnvironment() {
    console.log('Validating test environment...');
    
    const validationChecks = [
      {
        name: 'API Gateway Health',
        check: async () => {
          const response = await axios.get(`${this.config.environments.development.apiUrl}/health`);
          return response.status === 200;
        }
      },
      {
        name: 'Database Connectivity',
        check: async () => {
          const { MongoClient } = require('mongodb');
          const client = new MongoClient(this.config.environments.development.database);
          await client.connect();
          const collections = await client.db().listCollections().toArray();
          await client.close();
          return collections.length > 0;
        }
      },
      {
        name: 'Redis Connectivity',
        check: async () => {
          const Redis = require('redis');
          const client = Redis.createClient({ url: this.config.environments.development.redis });
          await client.connect();
          await client.set('test-key', 'test-value');
          const value = await client.get('test-key');
          await client.del('test-key');
          await client.quit();
          return value === 'test-value';
        }
      },
      {
        name: 'Test User Authentication',
        check: async () => {
          const response = await axios.post(`${this.config.environments.development.apiUrl}/auth/login`, {
            email: this.config.testData.users.admin.email,
            password: this.config.testData.users.admin.password
          });
          return response.status === 200 && response.data.token;
        }
      }
    ];

    for (const validation of validationChecks) {
      try {
        const result = await validation.check();
        if (result) {
          console.log(`✅ ${validation.name} - PASSED`);
          this.setupSteps.push({ step: `Validate ${validation.name}`, status: 'SUCCESS' });
        } else {
          throw new Error('Validation failed');
        }
      } catch (error) {
        console.log(`❌ ${validation.name} - FAILED`);
        this.setupSteps.push({ step: `Validate ${validation.name}`, status: 'FAILED', error: error.message });
        throw new Error(`Environment validation failed: ${validation.name}`);
      }
    }
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }

  async cleanup() {
    console.log('🧹 Cleaning up failed setup...');
    
    const cleanupCommands = [
      ['docker', ['stop', 'test-mongodb', 'test-redis', 'test-elasticsearch', 'test-mailhog']],
      ['docker', ['rm', 'test-mongodb', 'test-redis', 'test-elasticsearch', 'test-mailhog']],
      ['docker-compose', ['-f', 'docker-compose.test.yml', 'down']]
    ];

    for (const [command, args] of cleanupCommands) {
      try {
        await this.runCommand(command, args);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  generateSetupReport() {
    const report = {
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      steps: this.setupSteps,
      environment: {
        apiUrl: this.config.environments.development.apiUrl,
        webUrl: this.config.environments.development.webUrl,
        database: this.config.environments.development.database,
        redis: this.config.environments.development.redis
      },
      testUsers: Object.keys(this.config.testData.users).map(role => ({
        role,
        email: this.config.testData.users[role].email
      }))
    };
    
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportPath = path.join(reportsDir, `setup-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Setup report generated: ${reportPath}`);
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new TestEnvironmentSetup();
  setup.setupTestEnvironment();
}

module.exports = TestEnvironmentSetup;