const axios = require('axios');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const Redis = require('redis');
const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
  constructor() {
    this.config = require('../configs/test-config.json');
    this.baseURL = this.config.environments.development.apiUrl;
    this.webURL = this.config.environments.development.webUrl;
    this.dbURL = this.config.environments.development.database;
    this.redisURL = this.config.environments.development.redis;
    
    this.reportsDir = path.join(__dirname, 'reports');
    this.testResults = [];
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🔗 Starting comprehensive integration testing...');
    
    try {
      // Test service-to-service communication
      await this.testServiceCommunication();
      
      // Test database integrations
      await this.testDatabaseIntegrations();
      
      // Test external API integrations
      await this.testExternalAPIIntegrations();
      
      // Test real-time communication
      await this.testRealtimeCommunication();
      
      // Test workflow orchestration
      await this.testWorkflowOrchestration();
      
      // Test AI/ML service integration
      await this.testAIMLIntegration();
      
      // Test file processing integration
      await this.testFileProcessingIntegration();
      
      // Test notification systems
      await this.testNotificationSystems();
      
      // Generate comprehensive report
      this.generateReport();
      
      const failedTests = this.testResults.filter(test => !test.passed);
      
      if (failedTests.length === 0) {
        console.log('✅ All integration tests passed!');
        return true;
      } else {
        console.log(`❌ ${failedTests.length} integration tests failed`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Integration testing failed:', error.message);
      return false;
    }
  }

  async testServiceCommunication() {
    console.log('Testing service-to-service communication...');
    
    const tests = [
      {
        name: 'API Gateway to Task Orchestrator',
        test: async () => {
          const response = await axios.get(`${this.baseURL}/health/orchestrator`);
          return response.status === 200 && response.data.status === 'healthy';
        }
      },
      {
        name: 'Task Orchestrator to AI/ML Engine',
        test: async () => {
          const response = await axios.get(`${this.baseURL}/health/ai-engine`);
          return response.status === 200 && response.data.status === 'healthy';
        }
      },
      {
        name: 'Service Discovery',
        test: async () => {
          const response = await axios.get(`${this.baseURL}/services/discovery`);
          return response.status === 200 && response.data.services.length > 0;
        }
      },
      {
        name: 'Load Balancer Health Check',
        test: async () => {
          const response = await axios.get(`${this.baseURL}/health`);
          return response.status === 200 && response.data.uptime > 0;
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Service Communication',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Service Communication',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testDatabaseIntegrations() {
    console.log('Testing database integrations...');
    
    const tests = [
      {
        name: 'MongoDB Connection',
        test: async () => {
          const client = new MongoClient(this.dbURL);
          await client.connect();
          const db = client.db();
          const collections = await db.listCollections().toArray();
          await client.close();
          return collections.length > 0;
        }
      },
      {
        name: 'Redis Connection',
        test: async () => {
          const client = Redis.createClient({ url: this.redisURL });
          await client.connect();
          await client.set('test-key', 'test-value');
          const value = await client.get('test-key');
          await client.del('test-key');
          await client.quit();
          return value === 'test-value';
        }
      },
      {
        name: 'Database CRUD Operations',
        test: async () => {
          const token = await this.authenticate();
          
          // Create
          const createResponse = await axios.post(`${this.baseURL}/workflows`, {
            name: 'Integration Test Workflow',
            type: 'test'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (createResponse.status !== 201) return false;
          
          const workflowId = createResponse.data.id;
          
          // Read
          const readResponse = await axios.get(`${this.baseURL}/workflows/${workflowId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (readResponse.status !== 200) return false;
          
          // Update
          const updateResponse = await axios.put(`${this.baseURL}/workflows/${workflowId}`, {
            name: 'Updated Integration Test Workflow'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (updateResponse.status !== 200) return false;
          
          // Delete
          const deleteResponse = await axios.delete(`${this.baseURL}/workflows/${workflowId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return deleteResponse.status === 200;
        }
      },
      {
        name: 'Database Transactions',
        test: async () => {
          const token = await this.authenticate();
          
          const response = await axios.post(`${this.baseURL}/workflows/batch`, {
            workflows: [
              { name: 'Batch Test 1', type: 'test' },
              { name: 'Batch Test 2', type: 'test' }
            ]
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return response.status === 201 && response.data.created === 2;
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Database Integration',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Database Integration',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testExternalAPIIntegrations() {
    console.log('Testing external API integrations...');
    
    const tests = [
      {
        name: 'Email Service Integration',
        test: async () => {
          const token = await this.authenticate();
          
          const response = await axios.post(`${this.baseURL}/integrations/email/test`, {
            to: 'test@example.com',
            subject: 'Integration Test',
            body: 'This is a test email'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return response.status === 200 && response.data.sent === true;
        }
      },
      {
        name: 'Cloud Storage Integration',
        test: async () => {
          const token = await this.authenticate();
          
          const response = await axios.post(`${this.baseURL}/integrations/storage/test`, {
            fileName: 'test-file.txt',
            content: 'Integration test content'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return response.status === 200 && response.data.uploaded === true;
        }
      },
      {
        name: 'Third-party AI API Integration',
        test: async () => {
          const token = await this.authenticate();
          
          const response = await axios.post(`${this.baseURL}/integrations/ai/test`, {
            text: 'Test text for AI processing',
            operation: 'sentiment-analysis'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return response.status === 200 && response.data.result !== undefined;
        }
      },
      {
        name: 'Webhook Integration',
        test: async () => {
          const token = await this.authenticate();
          
          const response = await axios.post(`${this.baseURL}/integrations/webhooks/test`, {
            url: 'https://httpbin.org/post',
            payload: { test: 'integration' }
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return response.status === 200 && response.data.delivered === true;
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'External API Integration',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'External API Integration',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testRealtimeCommunication() {
    console.log('Testing real-time communication...');
    
    const tests = [
      {
        name: 'WebSocket Connection',
        test: async () => {
          return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:3000/ws`);
            
            ws.on('open', () => {
              ws.send(JSON.stringify({ type: 'ping' }));
            });
            
            ws.on('message', (data) => {
              const message = JSON.parse(data);
              ws.close();
              resolve(message.type === 'pong');
            });
            
            ws.on('error', () => {
              resolve(false);
            });
            
            setTimeout(() => {
              ws.close();
              resolve(false);
            }, 5000);
          });
        }
      },
      {
        name: 'Real-time Notifications',
        test: async () => {
          const token = await this.authenticate();
          
          return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
            
            ws.on('open', async () => {
              // Trigger a notification
              await axios.post(`${this.baseURL}/notifications/test`, {
                message: 'Integration test notification'
              }, {
                headers: { Authorization: `Bearer ${token}` }
              });
            });
            
            ws.on('message', (data) => {
              const message = JSON.parse(data);
              ws.close();
              resolve(message.type === 'notification');
            });
            
            setTimeout(() => {
              ws.close();
              resolve(false);
            }, 10000);
          });
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Real-time Communication',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Real-time Communication',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testWorkflowOrchestration() {
    console.log('Testing workflow orchestration...');
    
    const token = await this.authenticate();
    
    const tests = [
      {
        name: 'End-to-End Workflow Execution',
        test: async () => {
          // Create a complex workflow
          const workflowResponse = await axios.post(`${this.baseURL}/workflows`, {
            name: 'Integration Test Complex Workflow',
            type: 'email-processing',
            steps: [
              { type: 'email-trigger', config: { filter: 'subject:integration' } },
              { type: 'ai-processing', config: { model: 'document-classifier' } },
              { type: 'data-extraction', config: { fields: ['sender', 'subject', 'body'] } },
              { type: 'data-validation', config: { rules: ['email-format', 'required-fields'] } },
              { type: 'notification', config: { type: 'email', template: 'processing-complete' } }
            ]
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (workflowResponse.status !== 201) return false;
          
          const workflowId = workflowResponse.data.id;
          
          // Execute the workflow
          const executeResponse = await axios.post(`${this.baseURL}/workflows/${workflowId}/execute`, {
            input: {
              subject: 'Integration Test Email',
              sender: 'test@integration.com',
              body: 'This is an integration test email for workflow processing.'
            }
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (executeResponse.status !== 200) return false;
          
          const executionId = executeResponse.data.executionId;
          
          // Wait for completion and check status
          let completed = false;
          let attempts = 0;
          
          while (!completed && attempts < 30) {
            const statusResponse = await axios.get(`${this.baseURL}/workflows/executions/${executionId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (statusResponse.data.status === 'completed') {
              completed = true;
            } else if (statusResponse.data.status === 'failed') {
              return false;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
          
          return completed;
        }
      },
      {
        name: 'Workflow Error Handling',
        test: async () => {
          // Create a workflow that will fail
          const workflowResponse = await axios.post(`${this.baseURL}/workflows`, {
            name: 'Integration Test Error Workflow',
            type: 'error-test',
            steps: [
              { type: 'invalid-step', config: { shouldFail: true } }
            ]
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (workflowResponse.status !== 201) return false;
          
          const workflowId = workflowResponse.data.id;
          
          // Execute the workflow
          const executeResponse = await axios.post(`${this.baseURL}/workflows/${workflowId}/execute`, {
            input: { test: 'error' }
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Should handle the error gracefully
          return executeResponse.status === 200 && executeResponse.data.status === 'failed';
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Workflow Orchestration',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Workflow Orchestration',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async authenticate() {
    const response = await axios.post(`${this.baseURL}/auth/login`, {
      email: this.config.testData.users.admin.email,
      password: this.config.testData.users.admin.password
    });
    
    return response.data.token;
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(test => test.passed).length,
        failed: this.testResults.filter(test => !test.passed).length
      },
      categories: {},
      results: this.testResults
    };
    
    // Group by category
    this.testResults.forEach(test => {
      if (!report.categories[test.category]) {
        report.categories[test.category] = { total: 0, passed: 0, failed: 0 };
      }
      
      report.categories[test.category].total++;
      if (test.passed) {
        report.categories[test.category].passed++;
      } else {
        report.categories[test.category].failed++;
      }
    });
    
    const reportPath = path.join(this.reportsDir, `integration-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Integration test report generated: ${reportPath}`);
  }
}

// Run integration tests if called directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = IntegrationTestRunner;