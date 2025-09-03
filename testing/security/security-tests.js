const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SecurityTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api/v1`;
    this.results = {
      vulnerabilities: [],
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  async runAllTests() {
    console.log('Starting security tests...');
    
    try {
      await this.testAuthentication();
      await this.testAuthorization();
      await this.testInputValidation();
      await this.testSQLInjection();
      await this.testXSS();
      await this.testCSRF();
      await this.testSessionManagement();
      await this.testDataEncryption();
      await this.testRateLimiting();
      await this.testSecurityHeaders();
      
      this.generateReport();
    } catch (error) {
      console.error('Security test suite failed:', error);
      throw error;
    }
  }

  async testAuthentication() {
    console.log('Testing authentication security...');
    
    // Test weak password policy
    try {
      const response = await axios.post(`${this.apiUrl}/auth/register`, {
        email: 'test@test.com',
        password: '123',
        name: 'Test User'
      });
      
      this.addVulnerability('WEAK_PASSWORD_POLICY', 'System accepts weak passwords', 'HIGH');
    } catch (error) {
      if (error.response?.status === 400) {
        this.addPass('Password policy enforced');
      }
    }

    // Test brute force protection
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(
        axios.post(`${this.apiUrl}/auth/login`, {
          email: 'test@test.com',
          password: 'wrongpassword'
        }).catch(err => err.response)
      );
    }

    const responses = await Promise.all(attempts);
    const lastResponse = responses[responses.length - 1];
    
    if (lastResponse.status !== 429) {
      this.addVulnerability('NO_BRUTE_FORCE_PROTECTION', 'No rate limiting on login attempts', 'HIGH');
    } else {
      this.addPass('Brute force protection active');
    }
  }

  async testAuthorization() {
    console.log('Testing authorization controls...');
    
    // Get user token
    const userLogin = await axios.post(`${this.apiUrl}/auth/login`, {
      email: 'user@test.com',
      password: 'TestUser123!'
    });
    
    const userToken = userLogin.data.token;
    
    // Test accessing admin endpoints with user token
    try {
      const response = await axios.get(`${this.apiUrl}/admin/users`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      if (response.status === 200) {
        this.addVulnerability('BROKEN_ACCESS_CONTROL', 'User can access admin endpoints', 'CRITICAL');
      }
    } catch (error) {
      if (error.response?.status === 403) {
        this.addPass('Access control working correctly');
      }
    }

    // Test horizontal privilege escalation
    try {
      const response = await axios.get(`${this.apiUrl}/users/other-user-id`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      if (response.status === 200) {
        this.addVulnerability('HORIZONTAL_PRIVILEGE_ESCALATION', 'User can access other users data', 'HIGH');
      }
    } catch (error) {
      if (error.response?.status === 403) {
        this.addPass('Horizontal access control working');
      }
    }
  }

  async testInputValidation() {
    console.log('Testing input validation...');
    
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      '"; DROP TABLE users; --',
      '../../../etc/passwd',
      '${7*7}',
      '{{7*7}}',
      'javascript:alert(1)',
    ];

    for (const input of maliciousInputs) {
      try {
        const response = await axios.post(`${this.apiUrl}/tasks`, {
          title: input,
          description: 'Test task',
          type: 'administrative'
        }, {
          headers: { Authorization: `Bearer ${await this.getUserToken()}` }
        });

        // Check if malicious input is reflected in response
        if (response.data && JSON.stringify(response.data).includes(input)) {
          this.addVulnerability('INSUFFICIENT_INPUT_VALIDATION', 
            `Malicious input not sanitized: ${input}`, 'MEDIUM');
        }
      } catch (error) {
        // Input validation working if request is rejected
        this.addPass(`Input validation blocked: ${input}`);
      }
    }
  }

  async testSQLInjection() {
    console.log('Testing SQL injection vulnerabilities...');
    
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --"
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await axios.get(`${this.apiUrl}/tasks?search=${encodeURIComponent(payload)}`, {
          headers: { Authorization: `Bearer ${await this.getUserToken()}` }
        });

        // Check for SQL error messages in response
        const responseText = JSON.stringify(response.data).toLowerCase();
        if (responseText.includes('sql') || responseText.includes('mysql') || 
            responseText.includes('postgres') || responseText.includes('syntax error')) {
          this.addVulnerability('SQL_INJECTION', `SQL injection possible with payload: ${payload}`, 'CRITICAL');
        }
      } catch (error) {
        // Good if request fails due to validation
        this.addPass(`SQL injection blocked: ${payload}`);
      }
    }
  }

  async testXSS() {
    console.log('Testing XSS vulnerabilities...');
    
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      'javascript:alert("xss")',
      '<svg onload=alert("xss")>',
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await axios.post(`${this.apiUrl}/tasks`, {
          title: payload,
          description: 'XSS test',
          type: 'administrative'
        }, {
          headers: { Authorization: `Bearer ${await this.getUserToken()}` }
        });

        // Check if payload is reflected without encoding
        if (response.data && JSON.stringify(response.data).includes(payload)) {
          this.addVulnerability('XSS_VULNERABILITY', `XSS payload not encoded: ${payload}`, 'HIGH');
        }
      } catch (error) {
        this.addPass(`XSS payload blocked: ${payload}`);
      }
    }
  }

  async testCSRF() {
    console.log('Testing CSRF protection...');
    
    try {
      // Test if CSRF token is required for state-changing operations
      const response = await axios.post(`${this.apiUrl}/tasks`, {
        title: 'CSRF Test',
        description: 'Testing CSRF protection',
        type: 'administrative'
      }, {
        headers: { 
          Authorization: `Bearer ${await this.getUserToken()}`,
          'Origin': 'http://malicious-site.com'
        }
      });

      if (response.status === 201) {
        this.addVulnerability('CSRF_VULNERABILITY', 'No CSRF protection on state-changing operations', 'MEDIUM');
      }
    } catch (error) {
      if (error.response?.status === 403) {
        this.addPass('CSRF protection active');
      }
    }
  }

  async testSessionManagement() {
    console.log('Testing session management...');
    
    // Test session fixation
    const token = await this.getUserToken();
    
    // Test if token expires
    setTimeout(async () => {
      try {
        const response = await axios.get(`${this.apiUrl}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 200) {
          this.addWarning('Long session timeout - consider shorter expiration');
        }
      } catch (error) {
        this.addPass('Session expiration working');
      }
    }, 60000); // Test after 1 minute
  }

  async testDataEncryption() {
    console.log('Testing data encryption...');
    
    // Test if sensitive data is transmitted over HTTPS
    if (!this.baseUrl.startsWith('https://')) {
      this.addVulnerability('INSECURE_TRANSPORT', 'Application not using HTTPS', 'HIGH');
    } else {
      this.addPass('HTTPS in use');
    }
  }

  async testRateLimiting() {
    console.log('Testing rate limiting...');
    
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        axios.get(`${this.apiUrl}/health`).catch(err => err.response)
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r?.status === 429);
    
    if (!rateLimited) {
      this.addVulnerability('NO_RATE_LIMITING', 'No rate limiting detected', 'MEDIUM');
    } else {
      this.addPass('Rate limiting active');
    }
  }

  async testSecurityHeaders() {
    console.log('Testing security headers...');
    
    try {
      const response = await axios.get(this.baseUrl);
      const headers = response.headers;
      
      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy'
      ];

      for (const header of requiredHeaders) {
        if (!headers[header]) {
          this.addVulnerability('MISSING_SECURITY_HEADER', 
            `Missing security header: ${header}`, 'LOW');
        } else {
          this.addPass(`Security header present: ${header}`);
        }
      }
    } catch (error) {
      this.addVulnerability('HEADER_TEST_FAILED', 'Could not test security headers', 'LOW');
    }
  }

  async getUserToken() {
    const response = await axios.post(`${this.apiUrl}/auth/login`, {
      email: 'user@test.com',
      password: 'TestUser123!'
    });
    return response.data.token;
  }

  addVulnerability(type, description, severity) {
    this.results.vulnerabilities.push({ type, description, severity, timestamp: new Date() });
    this.results.failed++;
    console.log(`❌ VULNERABILITY [${severity}]: ${description}`);
  }

  addPass(description) {
    this.results.passed++;
    console.log(`✅ PASS: ${description}`);
  }

  addWarning(description) {
    this.results.warnings++;
    console.log(`⚠️  WARNING: ${description}`);
  }

  generateReport() {
    const report = {
      summary: {
        total: this.results.passed + this.results.failed + this.results.warnings,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        timestamp: new Date()
      },
      vulnerabilities: this.results.vulnerabilities
    };

    const reportPath = path.join(__dirname, 'reports', 'security-test-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 Security Test Summary:`);
    console.log(`   Passed: ${this.results.passed}`);
    console.log(`   Failed: ${this.results.failed}`);
    console.log(`   Warnings: ${this.results.warnings}`);
    console.log(`   Report saved to: ${reportPath}`);
  }
}

module.exports = SecurityTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllTests().catch(console.error);
}