const axios = require('axios');
const WebSocket = require('ws');
const { expect } = require('chai');

class ServiceIntegrationTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api/v1`;
    this.wsUrl = baseUrl.replace('http', 'ws');
    this.authToken = null;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async setup() {
    console.log('Setting up integration tests...');
    
    // Authenticate
    const response = await axios.post(`${this.apiUrl}/auth/login`, {
      email: 'integration-test@test.com',
      password: 'IntegrationTest123!'
    });
    
    this.authToken = response.data.token;
    console.log('Authentication successful');
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  async testApiGatewayToTaskOrchestrator() {
    console.log('Testing API Gateway -> Task Orchestrator integration...');
    
    try {
      // Create a task through API Gateway
      const taskResponse = await axios.post(`${this.apiUrl}/tasks`, {
        title: 'Integration Test Task',
        description: 'Testing service integration',
        type: 'administrative',
        priority: 'medium'
      }, { headers: this.getHeaders() });

      expect(taskResponse.status).to.equal(201);
      expect(taskResponse.data.id).to.exist;

      const taskId = taskResponse.data.id;

      // Check task status through orchestrator
      const statusResponse = await axios.get(`${this.apiUrl}/tasks/${taskId}/status`, {
        headers: this.getHeaders()
      });

      expect(statusResponse.status).to.equal(200);
      expect(statusResponse.data.status).to.be.oneOf(['pending', 'processing', 'completed']);

      this.addTestResult('API Gateway -> Task Orchestrator', true, 'Task creation and status check successful');
    } catch (error) {
      this.addTestResult('API Gateway -> Task Orchestrator', false, error.message);
    }
  }

  async testTaskOrchestratorToAIEngine() {
    console.log('Testing Task Orchestrator -> AI Engine integration...');
    
    try {
      // Create an AI-powered task
      const taskResponse = await axios.post(`${this.apiUrl}/tasks`, {
        title: 'AI Email Classification',
        description: 'Classify incoming emails',
        type: 'ai-processing',
        data: {
          emails: [
            { content: 'Urgent: Please review the quarterly report', sender: 'boss@company.com' },
            { content: 'Newsletter: Weekly updates', sender: 'newsletter@company.com' }
          ]
        }
      }, { headers: this.getHeaders() });

      expect(taskResponse.status).to.equal(201);
      const taskId = taskResponse.data.id;

      // Wait for AI processing
      await this.waitForTaskCompletion(taskId, 30000);

      // Check results
      const resultResponse = await axios.get(`${this.apiUrl}/tasks/${taskId}/results`, {
        headers: this.getHeaders()
      });

      expect(resultResponse.status).to.equal(200);
      expect(resultResponse.data.results).to.exist;
      expect(resultResponse.data.results.classifications).to.be.an('array');

      this.addTestResult('Task Orchestrator -> AI Engine', true, 'AI processing completed successfully');
    } catch (error) {
      this.addTestResult('Task Orchestrator -> AI Engine', false, error.message);
    }
  }

  async testDatabaseIntegration() {
    console.log('Testing database integration...');
    
    try {
      // Create user
      const userResponse = await axios.post(`${this.apiUrl}/users`, {
        name: 'Integration Test User',
        email: 'db-test@test.com',
        role: 'user'
      }, { headers: this.getHeaders() });

      expect(userResponse.status).to.equal(201);
      const userId = userResponse.data.id;

      // Retrieve user
      const getUserResponse = await axios.get(`${this.apiUrl}/users/${userId}`, {
        headers: this.getHeaders()
      });

      expect(getUserResponse.status).to.equal(200);
      expect(getUserResponse.data.email).to.equal('db-test@test.com');

      // Update user
      const updateResponse = await axios.put(`${this.apiUrl}/users/${userId}`, {
        name: 'Updated Integration Test User'
      }, { headers: this.getHeaders() });

      expect(updateResponse.status).to.equal(200);
      expect(updateResponse.data.name).to.equal('Updated Integration Test User');

      // Delete user
      const deleteResponse = await axios.delete(`${this.apiUrl}/users/${userId}`, {
        headers: this.getHeaders()
      });

      expect(deleteResponse.status).to.equal(204);

      this.addTestResult('Database Integration', true, 'CRUD operations successful');
    } catch (error) {
      this.addTestResult('Database Integration', false, error.message);
    }
  }

  async testMessageQueueIntegration() {
    console.log('Testing message queue integration...');
    
    try {
      // Create a workflow that uses message queue
      const workflowResponse = await axios.post(`${this.apiUrl}/workflows/execute`, {
        templateId: 'email-processing-workflow',
        parameters: {
          emailBatch: [
            { content: 'Test email 1', priority: 'high' },
            { content: 'Test email 2', priority: 'normal' }
          ]
        }
      }, { headers: this.getHeaders() });

      expect(workflowResponse.status).to.equal(202);
      const workflowId = workflowResponse.data.workflowId;

      // Check queue status
      const queueResponse = await axios.get(`${this.apiUrl}/queue/status`, {
        headers: this.getHeaders()
      });

      expect(queueResponse.status).to.equal(200);
      expect(queueResponse.data.activeJobs).to.be.a('number');

      // Wait for workflow completion
      await this.waitForWorkflowCompletion(workflowId, 45000);

      this.addTestResult('Message Queue Integration', true, 'Queue processing successful');
    } catch (error) {
      this.addTestResult('Message Queue Integration', false, error.message);
    }
  }

  async testWebSocketIntegration() {
    console.log('Testing WebSocket integration...');
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(`${this.wsUrl}/ws`, {
          headers: { Authorization: `Bearer ${this.authToken}` }
        });

        let messageReceived = false;

        ws.on('open', () => {
          console.log('WebSocket connected');
          
          // Subscribe to task updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'task-updates'
          }));

          // Create a task to trigger notification
          setTimeout(async () => {
            await axios.post(`${this.apiUrl}/tasks`, {
              title: 'WebSocket Test Task',
              description: 'Testing WebSocket notifications',
              type: 'administrative'
            }, { headers: this.getHeaders() });
          }, 1000);
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'task-created' || message.type === 'task-updated') {
            messageReceived = true;
            ws.close();
          }
        });

        ws.on('close', () => {
          if (messageReceived) {
            this.addTestResult('WebSocket Integration', true, 'Real-time notifications working');
          } else {
            this.addTestResult('WebSocket Integration', false, 'No WebSocket messages received');
          }
          resolve();
        });

        ws.on('error', (error) => {
          this.addTestResult('WebSocket Integration', false, error.message);
          resolve();
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!messageReceived) {
            ws.close();
          }
        }, 10000);

      } catch (error) {
        this.addTestResult('WebSocket Integration', false, error.message);
        resolve();
      }
    });
  }

  async testExternalIntegrations() {
    console.log('Testing external service integrations...');
    
    try {
      // Test email service integration
      const emailResponse = await axios.post(`${this.apiUrl}/integrations/email/send`, {
        to: 'test@example.com',
        subject: 'Integration Test',
        body: 'This is a test email from integration tests'
      }, { headers: this.getHeaders() });

      expect(emailResponse.status).to.be.oneOf([200, 202]);

      // Test calendar integration
      const calendarResponse = await axios.post(`${this.apiUrl}/integrations/calendar/events`, {
        title: 'Integration Test Meeting',
        startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        duration: 60,
        attendees: ['test@example.com']
      }, { headers: this.getHeaders() });

      expect(calendarResponse.status).to.be.oneOf([200, 201]);

      this.addTestResult('External Integrations', true, 'Email and calendar integrations working');
    } catch (error) {
      this.addTestResult('External Integrations', false, error.message);
    }
  }

  async testCacheIntegration() {
    console.log('Testing cache integration...');
    
    try {
      // Create data that should be cached
      const dataResponse = await axios.post(`${this.apiUrl}/cache/test`, {
        key: 'integration-test-key',
        value: 'integration-test-value',
        ttl: 300
      }, { headers: this.getHeaders() });

      expect(dataResponse.status).to.equal(200);

      // Retrieve cached data
      const cacheResponse = await axios.get(`${this.apiUrl}/cache/test/integration-test-key`, {
        headers: this.getHeaders()
      });

      expect(cacheResponse.status).to.equal(200);
      expect(cacheResponse.data.value).to.equal('integration-test-value');

      // Test cache invalidation
      const invalidateResponse = await axios.delete(`${this.apiUrl}/cache/test/integration-test-key`, {
        headers: this.getHeaders()
      });

      expect(invalidateResponse.status).to.equal(204);

      this.addTestResult('Cache Integration', true, 'Cache operations successful');
    } catch (error) {
      this.addTestResult('Cache Integration', false, error.message);
    }
  }

  async waitForTaskCompletion(taskId, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await axios.get(`${this.apiUrl}/tasks/${taskId}/status`, {
        headers: this.getHeaders()
      });
      
      if (response.data.status === 'completed') {
        return;
      } else if (response.data.status === 'failed') {
        throw new Error('Task failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Task completion timeout');
  }

  async waitForWorkflowCompletion(workflowId, timeout = 45000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await axios.get(`${this.apiUrl}/workflows/${workflowId}/status`, {
        headers: this.getHeaders()
      });
      
      if (response.data.status === 'completed') {
        return;
      } else if (response.data.status === 'failed') {
        throw new Error('Workflow failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Workflow completion timeout');
  }

  addTestResult(testName, passed, message) {
    this.results.tests.push({
      name: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });

    if (passed) {
      this.results.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.results.failed++;
      console.log(`❌ ${testName}: ${message}`);
    }
  }

  async runAllTests() {
    console.log('Starting service integration tests...');
    
    try {
      await this.setup();
      
      await this.testApiGatewayToTaskOrchestrator();
      await this.testTaskOrchestratorToAIEngine();
      await this.testDatabaseIntegration();
      await this.testMessageQueueIntegration();
      await this.testWebSocketIntegration();
      await this.testExternalIntegrations();
      await this.testCacheIntegration();
      
      this.generateReport();
    } catch (error) {
      console.error('Integration test suite failed:', error);
      throw error;
    }
  }

  generateReport() {
    const report = {
      summary: {
        total: this.results.passed + this.results.failed,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: this.results.passed / (this.results.passed + this.results.failed),
        timestamp: new Date().toISOString()
      },
      tests: this.results.tests
    };

    console.log(`\n📊 Integration Test Summary:`);
    console.log(`   Total Tests: ${report.summary.total}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Success Rate: ${(report.summary.successRate * 100).toFixed(1)}%`);

    // Save report
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'reports', 'integration-test-report.json');
    
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`   Report saved to: ${reportPath}`);
  }
}

module.exports = ServiceIntegrationTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new ServiceIntegrationTester();
  tester.runAllTests().catch(console.error);
}