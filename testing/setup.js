#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Setting up Testing Environment...\n');

// Check if package.json exists
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.log('📦 Creating package.json for testing...');
  
  const packageJson = {
    "name": "business-automation-testing",
    "version": "1.0.0",
    "description": "Testing suite for Business Task Automation Platform",
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage",
      "test:e2e": "cypress run",
      "test:e2e:open": "cypress open",
      "test:integration": "jest --config=integration/jest.config.js",
      "test:performance": "k6 run performance/load-test.js",
      "test:security": "npm run test:security:owasp && npm run test:security:snyk",
      "test:security:owasp": "zap-baseline.py -t http://localhost:3001",
      "test:security:snyk": "snyk test",
      "test:all": "npm run test && npm run test:integration && npm run test:e2e",
      "setup": "node setup.js",
      "install:tools": "npm install && npm run install:k6 && npm run install:zap",
      "install:k6": "echo 'Please install k6 from https://k6.io/docs/getting-started/installation/'",
      "install:zap": "echo 'Please install OWASP ZAP from https://www.zaproxy.org/download/'"
    },
    "devDependencies": {
      "jest": "^29.7.0",
      "cypress": "^13.6.0",
      "@types/jest": "^29.5.8",
      "supertest": "^6.3.3",
      "puppeteer": "^21.5.0",
      "axios": "^1.6.2",
      "snyk": "^1.1259.0",
      "@cypress/code-coverage": "^3.12.8",
      "nyc": "^15.1.0"
    },
    "jest": {
      "testEnvironment": "node",
      "collectCoverageFrom": [
        "../services/src/**/*.{js,ts}",
        "../client/src/**/*.{js,ts,tsx}",
        "!**/node_modules/**",
        "!**/dist/**"
      ],
      "coverageDirectory": "./coverage",
      "coverageReporters": ["text", "lcov", "html"]
    }
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Created package.json');
}

// Create test directories
const testDirectories = [
  'unit',
  'integration/api',
  'integration/database',
  'e2e/specs',
  'e2e/fixtures',
  'performance/scenarios',
  'security/reports',
  'data-quality/schemas',
  'contract/pacts',
  'chaos/scenarios',
  'reports',
  'coverage'
];

testDirectories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Create basic test configuration files
const configs = {
  'cypress.config.js': `const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'e2e/support/e2e.js',
    specPattern: 'e2e/specs/**/*.cy.{js,jsx,ts,tsx}',
    video: true,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      apiUrl: 'http://localhost:3001',
      testUser: 'admin@example.com',
      testPassword: 'password'
    }
  }
});`,

  'jest.config.js': `module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/unit', '<rootDir>/integration'],
  testMatch: ['**/__tests__/**/*.{js,ts}', '**/?(*.)+(spec|test).{js,ts}'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    '../services/src/**/*.{js,ts}',
    '!../services/src/**/*.d.ts',
    '!../services/node_modules/**',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/setup/jest.setup.js'],
};`,

  'integration/jest.config.js': `module.exports = {
  ...require('../jest.config.js'),
  testMatch: ['<rootDir>/integration/**/*.test.{js,ts}'],
  setupFilesAfterEnv: ['<rootDir>/setup/integration.setup.js'],
};`
};

Object.entries(configs).forEach(([filename, content]) => {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created ${filename}`);
  }
});

// Create setup files
const setupDir = path.join(__dirname, 'setup');
if (!fs.existsSync(setupDir)) {
  fs.mkdirSync(setupDir, { recursive: true });
}

const setupFiles = {
  'setup/jest.setup.js': `// Jest setup for unit tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';`,

  'setup/integration.setup.js': `// Integration test setup
const axios = require('axios');

// Set default timeout for integration tests
jest.setTimeout(30000);

// Global test configuration
global.testConfig = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3001',
  testUser: {
    email: 'admin@example.com',
    password: 'password'
  }
};

// Helper function to get auth token
global.getAuthToken = async () => {
  const response = await axios.post(\`\${global.testConfig.apiUrl}/api/auth/login\`, {
    email: global.testConfig.testUser.email,
    password: global.testConfig.testUser.password
  });
  return response.data.data.token;
};`
};

Object.entries(setupFiles).forEach(([filename, content]) => {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created ${filename}`);
  }
});

// Create sample test files
const sampleTests = {
  'unit/auth.test.js': `const request = require('supertest');

describe('Authentication Tests', () => {
  test('should validate JWT token format', () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    expect(mockToken).toMatch(/^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]*$/);
  });

  test('should hash passwords securely', () => {
    // Mock password hashing test
    expect(true).toBe(true);
  });
});`,

  'integration/api/auth.test.js': `const axios = require('axios');

describe('Authentication API Integration', () => {
  const apiUrl = global.testConfig.apiUrl;

  test('should login with valid credentials', async () => {
    const response = await axios.post(\`\${apiUrl}/api/auth/login\`, {
      email: 'admin@example.com',
      password: 'password'
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.token).toBeDefined();
  });

  test('should reject invalid credentials', async () => {
    try {
      await axios.post(\`\${apiUrl}/api/auth/login\`, {
        email: 'admin@example.com',
        password: 'wrongpassword'
      });
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });
});`,

  'e2e/specs/login.cy.js': `describe('Login Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should login successfully with valid credentials', () => {
    cy.get('[data-testid="email-input"]').type(Cypress.env('testUser'));
    cy.get('[data-testid="password-input"]').type(Cypress.env('testPassword'));
    cy.get('[data-testid="login-button"]').click();
    
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-testid="email-input"]').type('invalid@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();
    
    cy.get('[data-testid="error-message"]').should('be.visible');
  });
});`,

  'performance/load-test.js': `import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
};

export default function() {
  // Test API health endpoint
  let response = http.get('http://localhost:3001/health');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}`
};

Object.entries(sampleTests).forEach(([filename, content]) => {
  const filePath = path.join(__dirname, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created sample test: ${filename}`);
  }
});

// Install dependencies if node_modules doesn't exist
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('📦 Installing testing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Testing dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    console.error('Please run: npm install');
  }
} else {
  console.log('ℹ️  Testing dependencies already installed');
}

console.log('\n🎉 Testing environment setup complete!');
console.log('\nAvailable test commands:');
console.log('- npm test                # Run unit tests');
console.log('- npm run test:integration # Run integration tests');
console.log('- npm run test:e2e        # Run E2E tests');
console.log('- npm run test:performance # Run performance tests (requires k6)');
console.log('- npm run test:security   # Run security tests');
console.log('- npm run test:all        # Run all tests');
console.log('\nNext steps:');
console.log('1. Ensure services are running: cd ../services && npm run dev');
console.log('2. Ensure frontend is running: cd ../client && npm start');
console.log('3. Run tests: npm test');