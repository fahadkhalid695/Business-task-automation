const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ChaosTestRunner {
  constructor() {
    this.config = require('../configs/test-config.json');
    this.baseURL = this.config.environments.development.apiUrl;
    this.reportsDir = path.join(__dirname, 'reports');
    this.testResults = [];
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async runAllChaosTests() {
    console.log('🌪️  Starting comprehensive chaos engineering tests...');
    
    try {
      // Test system resilience under various failure conditions
      await this.testNetworkFailures();
      await this.testServiceFailures();
      await this.testDatabaseFailures();
      await this.testResourceExhaustion();
      await this.testLatencyInjection();
      await this.testDataCorruption();
      await this.testCascadingFailures();
      await this.testRecoveryMechanisms();
      
      // Generate comprehensive report
      this.generateReport();
      
      const failedTests = this.testResults.filter(test => !test.passed);
      
      if (failedTests.length === 0) {
        console.log('✅ All chaos tests passed - system is resilient!');
        return true;
      } else {
        console.log(`⚠️  ${failedTests.length} chaos tests revealed vulnerabilities`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Chaos testing failed:', error.message);
      return false;
    }
  }

  async testNetworkFailures() {
    console.log('Testing network failure resilience...');
    
    const tests = [
      {
        name: 'Network Partition Simulation',
        test: async () => {
          // Simulate network partition by blocking traffic to specific services
          await this.simulateNetworkPartition();
          
          // Test if system continues to function with degraded capabilities
          const healthResponse = await this.checkSystemHealth();
          
          // Restore network
          await this.restoreNetwork();
          
          return healthResponse.degradedButFunctional;
        }
      },
      {
        name: 'High Network Latency',
        test: async () => {
          // Inject high latency into network calls
          await this.injectNetworkLatency(5000); // 5 second delay
          
          // Test if system handles timeouts gracefully
          const token = await this.authenticate();
          
          try {
            const response = await axios.get(`${this.baseURL}/workflows`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000
            });
            
            // Restore normal latency
            await this.restoreNetworkLatency();
            
            return response.status === 200 || response.status === 408; // OK or timeout
          } catch (error) {
            await this.restoreNetworkLatency();
            return error.code === 'ECONNABORTED'; // Expected timeout
          }
        }
      },
      {
        name: 'Intermittent Connection Drops',
        test: async () => {
          // Simulate intermittent connection drops
          const results = [];
          
          for (let i = 0; i < 10; i++) {
            if (i % 3 === 0) {
              await this.dropConnections();
            }
            
            try {
              const response = await axios.get(`${this.baseURL}/health`);
              results.push(response.status === 200);
            } catch (error) {
              results.push(false);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          await this.restoreConnections();
          
          // System should handle at least 70% of requests successfully
          const successRate = results.filter(r => r).length / results.length;
          return successRate >= 0.7;
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Network Failures',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Network Failures',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testServiceFailures() {
    console.log('Testing service failure resilience...');
    
    const tests = [
      {
        name: 'API Gateway Failure',
        test: async () => {
          // Simulate API Gateway failure
          await this.killService('api-gateway');
          
          // Wait for failover
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Test if backup gateway takes over
          try {
            const response = await axios.get(`${this.baseURL}/health`);
            await this.restartService('api-gateway');
            return response.status === 200;
          } catch (error) {
            await this.restartService('api-gateway');
            return false;
          }
        }
      },
      {
        name: 'Task Orchestrator Failure',
        test: async () => {
          // Kill task orchestrator
          await this.killService('task-orchestrator');
          
          const token = await this.authenticate();
          
          // Try to execute a workflow
          try {
            const response = await axios.post(`${this.baseURL}/workflows/test/execute`, {
              input: { test: 'chaos' }
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            await this.restartService('task-orchestrator');
            
            // Should either succeed with backup or fail gracefully
            return response.status === 200 || response.status === 503;
          } catch (error) {
            await this.restartService('task-orchestrator');
            return error.response?.status === 503; // Service unavailable is acceptable
          }
        }
      },
      {
        name: 'AI/ML Engine Failure',
        test: async () => {
          await this.killService('ai-ml-engine');
          
          const token = await this.authenticate();
          
          try {
            const response = await axios.post(`${this.baseURL}/ai/inference`, {
              model: 'test-model',
              input: { text: 'test' }
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            await this.restartService('ai-ml-engine');
            
            // Should fallback to alternative processing or queue for later
            return response.status === 200 || response.status === 202;
          } catch (error) {
            await this.restartService('ai-ml-engine');
            return error.response?.status === 503;
          }
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Service Failures',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Service Failures',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testDatabaseFailures() {
    console.log('Testing database failure resilience...');
    
    const tests = [
      {
        name: 'Primary Database Failure',
        test: async () => {
          // Simulate primary database failure
          await this.killDatabase('primary');
          
          const token = await this.authenticate();
          
          try {
            // Try to read data (should work with read replica)
            const response = await axios.get(`${this.baseURL}/workflows`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            await this.restartDatabase('primary');
            
            return response.status === 200;
          } catch (error) {
            await this.restartDatabase('primary');
            return false;
          }
        }
      },
      {
        name: 'Database Connection Pool Exhaustion',
        test: async () => {
          // Exhaust database connection pool
          await this.exhaustConnectionPool();
          
          const token = await this.authenticate();
          
          try {
            const response = await axios.get(`${this.baseURL}/health/database`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            await this.restoreConnectionPool();
            
            // Should handle gracefully with connection queuing
            return response.status === 200 || response.status === 503;
          } catch (error) {
            await this.restoreConnectionPool();
            return error.response?.status === 503;
          }
        }
      },
      {
        name: 'Database Slow Query Simulation',
        test: async () => {
          // Inject slow queries
          await this.injectSlowQueries();
          
          const token = await this.authenticate();
          
          const startTime = Date.now();
          
          try {
            const response = await axios.get(`${this.baseURL}/workflows`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 15000
            });
            
            const duration = Date.now() - startTime;
            
            await this.restoreQueryPerformance();
            
            // Should either complete or timeout gracefully
            return (response.status === 200 && duration < 15000) || 
                   (response.status === 408);
          } catch (error) {
            await this.restoreQueryPerformance();
            return error.code === 'ECONNABORTED';
          }
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Database Failures',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Database Failures',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testResourceExhaustion() {
    console.log('Testing resource exhaustion resilience...');
    
    const tests = [
      {
        name: 'Memory Exhaustion',
        test: async () => {
          // Simulate memory exhaustion
          await this.exhaustMemory();
          
          try {
            const response = await axios.get(`${this.baseURL}/health`);
            await this.restoreMemory();
            
            // System should handle memory pressure gracefully
            return response.status === 200 || response.status === 503;
          } catch (error) {
            await this.restoreMemory();
            return error.response?.status === 503;
          }
        }
      },
      {
        name: 'CPU Exhaustion',
        test: async () => {
          // Simulate high CPU usage
          await this.exhaustCPU();
          
          const token = await this.authenticate();
          
          try {
            const response = await axios.get(`${this.baseURL}/workflows`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30000
            });
            
            await this.restoreCPU();
            
            // Should handle high CPU load
            return response.status === 200;
          } catch (error) {
            await this.restoreCPU();
            return error.code === 'ECONNABORTED';
          }
        }
      },
      {
        name: 'Disk Space Exhaustion',
        test: async () => {
          // Simulate disk space exhaustion
          await this.exhaustDiskSpace();
          
          const token = await this.authenticate();
          
          try {
            const response = await axios.post(`${this.baseURL}/workflows`, {
              name: 'Chaos Test Workflow',
              type: 'test'
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            await this.restoreDiskSpace();
            
            // Should handle disk space issues
            return response.status === 201 || response.status === 507;
          } catch (error) {
            await this.restoreDiskSpace();
            return error.response?.status === 507;
          }
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Resource Exhaustion',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Resource Exhaustion',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testRecoveryMechanisms() {
    console.log('Testing recovery mechanisms...');
    
    const tests = [
      {
        name: 'Auto-scaling Response',
        test: async () => {
          // Simulate high load to trigger auto-scaling
          await this.simulateHighLoad();
          
          // Wait for auto-scaling to kick in
          await new Promise(resolve => setTimeout(resolve, 30000));
          
          // Check if additional instances were created
          const scalingResponse = await this.checkAutoScaling();
          
          await this.restoreNormalLoad();
          
          return scalingResponse.scaled;
        }
      },
      {
        name: 'Circuit Breaker Functionality',
        test: async () => {
          // Cause service to fail repeatedly to trigger circuit breaker
          await this.triggerCircuitBreaker();
          
          const token = await this.authenticate();
          
          try {
            const response = await axios.get(`${this.baseURL}/workflows`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            await this.resetCircuitBreaker();
            
            // Circuit breaker should prevent cascading failures
            return response.status === 503; // Service unavailable due to circuit breaker
          } catch (error) {
            await this.resetCircuitBreaker();
            return error.response?.status === 503;
          }
        }
      },
      {
        name: 'Health Check Recovery',
        test: async () => {
          // Simulate unhealthy service
          await this.makeServiceUnhealthy();
          
          // Wait for health check to detect and remove from load balancer
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Restore service health
          await this.restoreServiceHealth();
          
          // Wait for health check to detect recovery
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Check if service is back in rotation
          const response = await axios.get(`${this.baseURL}/health`);
          
          return response.status === 200;
        }
      }
    ];

    for (const test of tests) {
      try {
        const passed = await test.test();
        this.testResults.push({
          category: 'Recovery Mechanisms',
          name: test.name,
          passed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.testResults.push({
          category: 'Recovery Mechanisms',
          name: test.name,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Simulation methods (these would interact with actual infrastructure in a real implementation)
  async simulateNetworkPartition() {
    console.log('🌐 Simulating network partition...');
    // In real implementation, this would use tools like tc, iptables, or chaos engineering tools
  }

  async restoreNetwork() {
    console.log('🔧 Restoring network connectivity...');
  }

  async injectNetworkLatency(ms) {
    console.log(`⏱️  Injecting ${ms}ms network latency...`);
  }

  async restoreNetworkLatency() {
    console.log('🔧 Restoring normal network latency...');
  }

  async killService(serviceName) {
    console.log(`💀 Killing service: ${serviceName}...`);
    // In real implementation, this would stop Docker containers or kill processes
  }

  async restartService(serviceName) {
    console.log(`🔄 Restarting service: ${serviceName}...`);
  }

  async killDatabase(type) {
    console.log(`💀 Killing ${type} database...`);
  }

  async restartDatabase(type) {
    console.log(`🔄 Restarting ${type} database...`);
  }

  async exhaustMemory() {
    console.log('🧠 Exhausting system memory...');
  }

  async restoreMemory() {
    console.log('🔧 Restoring normal memory usage...');
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email: this.config.testData.users.admin.email,
        password: this.config.testData.users.admin.password
      });
      return response.data.token;
    } catch (error) {
      return null;
    }
  }

  async checkSystemHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health/detailed`);
      return {
        healthy: response.status === 200,
        degradedButFunctional: response.status === 200 && response.data.status === 'degraded'
      };
    } catch (error) {
      return { healthy: false, degradedButFunctional: false };
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(test => test.passed).length,
        failed: this.testResults.filter(test => !test.passed).length,
        resilienceScore: this.calculateResilienceScore()
      },
      categories: {},
      results: this.testResults,
      recommendations: this.generateRecommendations()
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
    
    const reportPath = path.join(this.reportsDir, `chaos-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`🌪️  Chaos test report generated: ${reportPath}`);
  }

  calculateResilienceScore() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(test => test.passed).length;
    
    return totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  }

  generateRecommendations() {
    const failedCategories = new Set();
    
    this.testResults.forEach(test => {
      if (!test.passed) {
        failedCategories.add(test.category);
      }
    });
    
    const recommendations = [];
    
    if (failedCategories.has('Network Failures')) {
      recommendations.push('Implement network redundancy and failover mechanisms');
      recommendations.push('Add circuit breakers for external service calls');
    }
    
    if (failedCategories.has('Service Failures')) {
      recommendations.push('Implement service mesh for better failure handling');
      recommendations.push('Add health checks and automatic service recovery');
    }
    
    if (failedCategories.has('Database Failures')) {
      recommendations.push('Set up database replication and failover');
      recommendations.push('Implement connection pooling and query optimization');
    }
    
    if (failedCategories.has('Resource Exhaustion')) {
      recommendations.push('Implement resource monitoring and alerting');
      recommendations.push('Add auto-scaling policies for resource management');
    }
    
    return recommendations;
  }
}

// Run chaos tests if called directly
if (require.main === module) {
  const runner = new ChaosTestRunner();
  runner.runAllChaosTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ChaosTestRunner;