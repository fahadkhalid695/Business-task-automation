/**
 * Chaos Engineering Tests for Business Task Automation Platform
 * Tests system resilience and failure recovery capabilities
 */

const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ChaosTestSuite {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:3000';
        this.kubernetesNamespace = config.namespace || 'business-automation';
        this.testResults = [];
        this.authToken = null;
    }

    async authenticate() {
        try {
            const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
                email: 'chaos-test@example.com',
                password: 'ChaosTestPassword123!'
            });
            
            this.authToken = response.data.token;
            console.log('Authentication successful');
        } catch (error) {
            console.error('Authentication failed:', error.message);
            throw error;
        }
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    async executeKubectlCommand(command) {
        return new Promise((resolve, reject) => {
            const kubectl = spawn('kubectl', command.split(' '));
            let stdout = '';
            let stderr = '';

            kubectl.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            kubectl.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            kubectl.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr));
                }
            });
        });
    }

    async testServiceFailure() {
        console.log('Testing service failure resilience...');
        
        const testResult = {
            testName: 'service_failure',
            startTime: new Date(),
            steps: [],
            passed: false
        };

        try {
            // Step 1: Verify system is healthy
            const healthCheck = await axios.get(`${this.baseUrl}/api/health`);
            testResult.steps.push({
                step: 'initial_health_check',
                status: 'passed',
                response: healthCheck.status
            });

            // Step 2: Kill a random service pod
            const pods = await this.executeKubectlCommand(
                `get pods -n ${this.kubernetesNamespace} -l app=task-orchestrator -o name`
            );
            
            const podList = pods.trim().split('\n').filter(pod => pod);
            if (podList.length > 0) {
                const randomPod = podList[Math.floor(Math.random() * podList.length)];
                await this.executeKubectlCommand(`delete ${randomPod} -n ${this.kubernetesNamespace}`);
                
                testResult.steps.push({
                    step: 'pod_deletion',
                    status: 'executed',
                    deletedPod: randomPod
                });

                // Step 3: Wait for pod to be recreated
                await this.sleep(10000); // Wait 10 seconds

                // Step 4: Test system recovery
                let recoveryAttempts = 0;
                let systemRecovered = false;
                
                while (recoveryAttempts < 12 && !systemRecovered) { // Max 2 minutes
                    try {
                        const recoveryCheck = await axios.get(`${this.baseUrl}/api/health`);
                        if (recoveryCheck.status === 200) {
                            systemRecovered = true;
                            testResult.steps.push({
                                step: 'system_recovery',
                                status: 'passed',
                                recoveryTime: recoveryAttempts * 10
                            });
                        }
                    } catch (error) {
                        recoveryAttempts++;
                        await this.sleep(10000);
                    }
                }

                if (!systemRecovered) {
                    testResult.steps.push({
                        step: 'system_recovery',
                        status: 'failed',
                        error: 'System did not recover within 2 minutes'
                    });
                }

                testResult.passed = systemRecovered;
            }

        } catch (error) {
            testResult.steps.push({
                step: 'error',
                status: 'failed',
                error: error.message
            });
        }

        testResult.endTime = new Date();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.testResults.push(testResult);
        
        return testResult;
    }

    async testNetworkPartition() {
        console.log('Testing network partition resilience...');
        
        const testResult = {
            testName: 'network_partition',
            startTime: new Date(),
            steps: [],
            passed: false
        };

        try {
            // Step 1: Create network policy to simulate partition
            const networkPolicy = {
                apiVersion: 'networking.k8s.io/v1',
                kind: 'NetworkPolicy',
                metadata: {
                    name: 'chaos-network-partition',
                    namespace: this.kubernetesNamespace
                },
                spec: {
                    podSelector: {
                        matchLabels: {
                            app: 'api-gateway'
                        }
                    },
                    policyTypes: ['Ingress', 'Egress'],
                    ingress: [],
                    egress: []
                }
            };

            // Apply network policy
            await fs.writeFile('/tmp/network-policy.yaml', JSON.stringify(networkPolicy));
            await this.executeKubectlCommand('apply -f /tmp/network-policy.yaml');
            
            testResult.steps.push({
                step: 'network_partition_applied',
                status: 'executed'
            });

            // Step 2: Test system behavior during partition
            await this.sleep(5000);
            
            try {
                await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
                testResult.steps.push({
                    step: 'partition_behavior',
                    status: 'unexpected',
                    note: 'System still accessible during partition'
                });
            } catch (error) {
                testResult.steps.push({
                    step: 'partition_behavior',
                    status: 'expected',
                    note: 'System correctly unavailable during partition'
                });
            }

            // Step 3: Remove network policy
            await this.executeKubectlCommand(
                `delete networkpolicy chaos-network-partition -n ${this.kubernetesNamespace}`
            );
            
            testResult.steps.push({
                step: 'network_partition_removed',
                status: 'executed'
            });

            // Step 4: Test recovery
            await this.sleep(10000);
            
            const recoveryCheck = await axios.get(`${this.baseUrl}/api/health`);
            testResult.steps.push({
                step: 'network_recovery',
                status: recoveryCheck.status === 200 ? 'passed' : 'failed'
            });

            testResult.passed = recoveryCheck.status === 200;

        } catch (error) {
            testResult.steps.push({
                step: 'error',
                status: 'failed',
                error: error.message
            });
        }

        testResult.endTime = new Date();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.testResults.push(testResult);
        
        return testResult;
    }

    async testDatabaseFailure() {
        console.log('Testing database failure resilience...');
        
        const testResult = {
            testName: 'database_failure',
            startTime: new Date(),
            steps: [],
            passed: false
        };

        try {
            // Step 1: Test normal database operations
            const createResponse = await axios.post(`${this.baseUrl}/api/workflows`, {
                name: 'Chaos Test Workflow',
                type: 'test'
            }, { headers: this.getHeaders() });
            
            testResult.steps.push({
                step: 'normal_db_operation',
                status: 'passed',
                workflowId: createResponse.data.id
            });

            // Step 2: Scale down MongoDB
            await this.executeKubectlCommand(
                `scale deployment mongodb --replicas=0 -n ${this.kubernetesNamespace}`
            );
            
            testResult.steps.push({
                step: 'database_scaled_down',
                status: 'executed'
            });

            await this.sleep(10000);

            // Step 3: Test system behavior without database
            try {
                await axios.get(`${this.baseUrl}/api/workflows`, { 
                    headers: this.getHeaders(),
                    timeout: 5000 
                });
                testResult.steps.push({
                    step: 'db_failure_behavior',
                    status: 'unexpected',
                    note: 'API still responding without database'
                });
            } catch (error) {
                testResult.steps.push({
                    step: 'db_failure_behavior',
                    status: 'expected',
                    note: 'API correctly failing without database'
                });
            }

            // Step 4: Scale MongoDB back up
            await this.executeKubectlCommand(
                `scale deployment mongodb --replicas=1 -n ${this.kubernetesNamespace}`
            );
            
            testResult.steps.push({
                step: 'database_scaled_up',
                status: 'executed'
            });

            // Step 5: Wait for database to be ready
            await this.sleep(30000);

            // Step 6: Test recovery
            const recoveryResponse = await axios.get(`${this.baseUrl}/api/workflows`, {
                headers: this.getHeaders()
            });
            
            testResult.steps.push({
                step: 'database_recovery',
                status: recoveryResponse.status === 200 ? 'passed' : 'failed'
            });

            testResult.passed = recoveryResponse.status === 200;

        } catch (error) {
            testResult.steps.push({
                step: 'error',
                status: 'failed',
                error: error.message
            });
        }

        testResult.endTime = new Date();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.testResults.push(testResult);
        
        return testResult;
    }

    async testHighLoad() {
        console.log('Testing system behavior under high load...');
        
        const testResult = {
            testName: 'high_load',
            startTime: new Date(),
            steps: [],
            passed: false
        };

        try {
            // Step 1: Generate high load
            const concurrentRequests = 100;
            const requestPromises = [];

            for (let i = 0; i < concurrentRequests; i++) {
                const promise = axios.post(`${this.baseUrl}/api/workflows`, {
                    name: `Load Test Workflow ${i}`,
                    type: 'load-test'
                }, { 
                    headers: this.getHeaders(),
                    timeout: 10000
                }).catch(error => ({ error: error.message }));
                
                requestPromises.push(promise);
            }

            const results = await Promise.all(requestPromises);
            
            const successfulRequests = results.filter(r => !r.error).length;
            const successRate = successfulRequests / concurrentRequests;

            testResult.steps.push({
                step: 'high_load_test',
                status: 'executed',
                totalRequests: concurrentRequests,
                successfulRequests: successfulRequests,
                successRate: successRate
            });

            // Step 2: Check system health after load
            await this.sleep(5000);
            
            const healthCheck = await axios.get(`${this.baseUrl}/api/health`);
            testResult.steps.push({
                step: 'post_load_health',
                status: healthCheck.status === 200 ? 'passed' : 'failed'
            });

            // Consider test passed if success rate > 80% and system is healthy
            testResult.passed = successRate > 0.8 && healthCheck.status === 200;

        } catch (error) {
            testResult.steps.push({
                step: 'error',
                status: 'failed',
                error: error.message
            });
        }

        testResult.endTime = new Date();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.testResults.push(testResult);
        
        return testResult;
    }

    async testMemoryExhaustion() {
        console.log('Testing memory exhaustion resilience...');
        
        const testResult = {
            testName: 'memory_exhaustion',
            startTime: new Date(),
            steps: [],
            passed: false
        };

        try {
            // Step 1: Create memory-intensive workload
            const memoryIntensivePayload = {
                name: 'Memory Test Workflow',
                type: 'data-processing',
                data: Array(10000).fill().map((_, i) => ({
                    id: i,
                    data: 'x'.repeat(1000) // Large string data
                }))
            };

            const response = await axios.post(`${this.baseUrl}/api/workflows/memory-test`, 
                memoryIntensivePayload, 
                { headers: this.getHeaders() }
            );

            testResult.steps.push({
                step: 'memory_intensive_request',
                status: response.status === 200 ? 'passed' : 'failed'
            });

            // Step 2: Monitor system behavior
            await this.sleep(10000);
            
            const healthCheck = await axios.get(`${this.baseUrl}/api/health`);
            testResult.steps.push({
                step: 'system_stability',
                status: healthCheck.status === 200 ? 'passed' : 'failed'
            });

            testResult.passed = healthCheck.status === 200;

        } catch (error) {
            testResult.steps.push({
                step: 'error',
                status: 'failed',
                error: error.message
            });
        }

        testResult.endTime = new Date();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.testResults.push(testResult);
        
        return testResult;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                passedTests: this.testResults.filter(t => t.passed).length,
                failedTests: this.testResults.filter(t => !t.passed).length,
                overallSuccess: this.testResults.every(t => t.passed)
            },
            testResults: this.testResults,
            recommendations: []
        };

        // Generate recommendations based on failures
        this.testResults.forEach(test => {
            if (!test.passed) {
                switch (test.testName) {
                    case 'service_failure':
                        report.recommendations.push('Improve service recovery mechanisms and health checks');
                        break;
                    case 'network_partition':
                        report.recommendations.push('Implement better network resilience and circuit breakers');
                        break;
                    case 'database_failure':
                        report.recommendations.push('Add database connection pooling and retry logic');
                        break;
                    case 'high_load':
                        report.recommendations.push('Implement auto-scaling and load balancing improvements');
                        break;
                    case 'memory_exhaustion':
                        report.recommendations.push('Add memory limits and garbage collection optimization');
                        break;
                }
            }
        });

        const reportPath = path.join('testing', 'reports', 'chaos', `chaos_report_${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`Chaos engineering report saved: ${reportPath}`);
        return reportPath;
    }

    async runAllTests() {
        console.log('Starting chaos engineering tests...');
        
        try {
            await this.authenticate();
            
            // Run all chaos tests
            await this.testServiceFailure();
            await this.testNetworkPartition();
            await this.testDatabaseFailure();
            await this.testHighLoad();
            await this.testMemoryExhaustion();
            
            const reportPath = await this.generateReport();
            
            console.log('Chaos engineering tests completed');
            return reportPath;
            
        } catch (error) {
            console.error('Chaos testing failed:', error);
            throw error;
        }
    }
}

// CLI execution
if (require.main === module) {
    const config = {
        baseUrl: process.argv[2] || 'http://localhost:3000',
        namespace: process.argv[3] || 'business-automation'
    };
    
    const chaosTests = new ChaosTestSuite(config);
    
    chaosTests.runAllTests()
        .then(reportPath => {
            console.log(`Chaos tests completed. Report: ${reportPath}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('Chaos tests failed:', error);
            process.exit(1);
        });
}

module.exports = ChaosTestSuite;