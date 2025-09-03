---
inclusion: fileMatch
fileMatchPattern: "**/*.{test,spec}.{ts,js,py}"
---

# Testing Guidelines and Best Practices

## Overview
This document provides comprehensive testing guidelines for the Business Task Automation Platform, ensuring high-quality, reliable, and maintainable test suites across all components.

## Testing Philosophy

### Test Pyramid Strategy
```
    /\
   /  \     E2E Tests (Few)
  /____\    - Critical user journeys
 /      \   - Cross-service integration
/__________\ Integration Tests (Some)
            - API endpoints
            - Service interactions
            Unit Tests (Many)
            - Business logic
            - Utility functions
```

### Testing Principles
1. **Fast Feedback**: Unit tests should run quickly (< 1 second each)
2. **Reliable**: Tests should be deterministic and not flaky
3. **Maintainable**: Tests should be easy to understand and modify
4. **Comprehensive**: Cover happy paths, edge cases, and error conditions
5. **Independent**: Tests should not depend on each other

## Unit Testing Standards

### Test Structure (AAA Pattern)
```typescript
describe('WorkflowService', () => {
  describe('executeWorkflow', () => {
    it('should execute workflow successfully with valid input', async () => {
      // Arrange
      const workflow = createTestWorkflow({
        steps: [{ type: 'data-validation', config: { rules: ['required'] } }]
      });
      const mockContext = createMockExecutionContext();
      mockWorkflowEngine.execute.mockResolvedValue(createSuccessResult());

      // Act
      const result = await workflowService.executeWorkflow(workflow, mockContext);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockWorkflowEngine.execute).toHaveBeenCalledWith(
        workflow,
        expect.objectContaining(mockContext)
      );
    });
  });
});
```

### Mock Strategy
```typescript
// Use factory functions for test data
export const createTestWorkflow = (overrides: Partial<Workflow> = {}): Workflow => ({
  id: 'test-workflow-123',
  name: 'Test Workflow',
  status: 'active',
  steps: [],
  createdBy: 'test-user-456',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Create typed mocks for services
export const createMockWorkflowRepository = (): jest.Mocked<WorkflowRepository> => ({
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByUser: jest.fn(),
  findActiveWorkflows: jest.fn()
});

// Use dependency injection for testability
class WorkflowService {
  constructor(
    private workflowRepository: WorkflowRepository,
    private taskScheduler: TaskScheduler,
    private logger: Logger
  ) {}
}
```

### Error Testing
```typescript
describe('error handling', () => {
  it('should throw ValidationError for invalid workflow configuration', async () => {
    // Arrange
    const invalidWorkflow = createTestWorkflow({ steps: [] }); // Empty steps

    // Act & Assert
    await expect(workflowService.executeWorkflow(invalidWorkflow))
      .rejects.toThrow(ValidationError);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Workflow validation failed',
      expect.objectContaining({ workflowId: invalidWorkflow.id })
    );
  });

  it('should handle database connection failures gracefully', async () => {
    // Arrange
    mockWorkflowRepository.findById.mockRejectedValue(new Error('Connection timeout'));

    // Act & Assert
    await expect(workflowService.getWorkflow('workflow-123'))
      .rejects.toThrow('Failed to retrieve workflow');
  });
});
```

## Integration Testing

### API Testing with Supertest
```typescript
describe('Workflow API Integration', () => {
  let app: Express;
  let testDb: MongoMemoryServer;
  let authToken: string;

  beforeAll(async () => {
    testDb = await MongoMemoryServer.create();
    app = createTestApp({
      mongoUri: testDb.getUri(),
      redisUrl: 'redis://localhost:6379/1' // Test database
    });
    
    // Create test user and get auth token
    const testUser = await createTestUser({ role: 'admin' });
    authToken = generateTestToken(testUser);
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('should create workflow via API', async () => {
    const workflowData = {
      name: 'Integration Test Workflow',
      description: 'Test workflow for API integration',
      steps: [
        { type: 'data-validation', config: { rules: ['required'] }, order: 0 }
      ]
    };

    const response = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${authToken}`)
      .send(workflowData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      name: workflowData.name,
      description: workflowData.description,
      status: 'draft'
    });

    // Verify in database
    const savedWorkflow = await WorkflowModel.findById(response.body.data.id);
    expect(savedWorkflow).toBeTruthy();
    expect(savedWorkflow.steps).toHaveLength(1);
  });
});
```

### Service Integration Testing
```typescript
describe('Workflow-TaskScheduler Integration', () => {
  let workflowService: WorkflowService;
  let taskScheduler: TaskScheduler;
  let testRedis: Redis;

  beforeAll(async () => {
    testRedis = new Redis({ db: 1 }); // Use test database
    taskScheduler = new BullTaskScheduler(testRedis);
    workflowService = new WorkflowService(
      new MongoWorkflowRepository(),
      taskScheduler,
      new TestLogger()
    );
  });

  afterAll(async () => {
    await testRedis.flushdb();
    await testRedis.quit();
  });

  it('should schedule workflow execution', async () => {
    const workflow = await workflowService.create({
      name: 'Scheduled Workflow',
      steps: [{ type: 'email-processing', config: {}, order: 0 }]
    });

    await workflowService.scheduleExecution(workflow.id, {
      delay: 1000,
      priority: 'high'
    });

    // Verify task was queued
    const queuedJobs = await taskScheduler.getWaitingJobs();
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0].data.workflowId).toBe(workflow.id);
  });
});
```

## End-to-End Testing

### Cypress E2E Tests
```typescript
// cypress/integration/workflow-management.spec.ts
describe('Workflow Management E2E', () => {
  beforeEach(() => {
    cy.login('admin@test.com', 'password');
    cy.visit('/workflows');
  });

  it('should create and execute workflow end-to-end', () => {
    // Create workflow
    cy.get('[data-testid="create-workflow-btn"]').click();
    cy.get('[data-testid="workflow-name"]').type('E2E Test Workflow');
    cy.get('[data-testid="workflow-description"]').type('End-to-end test workflow');

    // Add workflow steps
    cy.get('[data-testid="add-step-btn"]').click();
    cy.get('[data-testid="step-type-select"]').select('email-classification');
    cy.get('[data-testid="step-config-input"]').type('{"model": "priority-classifier"}');
    cy.get('[data-testid="save-step-btn"]').click();

    // Save workflow
    cy.get('[data-testid="save-workflow-btn"]').click();
    cy.get('[data-testid="success-message"]').should('be.visible');

    // Execute workflow
    cy.get('[data-testid="execute-workflow-btn"]').click();
    cy.get('[data-testid="execution-status"]').should('contain', 'Running');

    // Wait for completion
    cy.get('[data-testid="execution-status"]', { timeout: 30000 })
      .should('contain', 'Completed');

    // Verify results
    cy.get('[data-testid="execution-results"]').should('be.visible');
    cy.get('[data-testid="execution-logs"]').should('contain', 'Step completed successfully');
  });

  it('should handle workflow execution errors gracefully', () => {
    // Create workflow with invalid configuration
    cy.createWorkflowViaAPI({
      name: 'Error Test Workflow',
      steps: [{ type: 'invalid-step-type', config: {}, order: 0 }]
    }).then((workflow) => {
      cy.visit(`/workflows/${workflow.id}`);
      cy.get('[data-testid="execute-workflow-btn"]').click();

      // Verify error handling
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="error-details"]').should('contain', 'Invalid step type');
      cy.get('[data-testid="retry-btn"]').should('be.enabled');
    });
  });
});
```

## Performance Testing

### Load Testing with k6
```javascript
// testing/performance/workflow-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const workflowExecutionTime = new Trend('workflow_execution_time');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.1'],              // Error rate under 10%
  },
};

export function setup() {
  // Login and get auth token
  const loginResponse = http.post(`${__ENV.BASE_URL}/api/auth/login`, {
    email: 'load-test@example.com',
    password: 'LoadTestPassword123!'
  });
  
  return { authToken: loginResponse.json('token') };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.authToken}`,
    'Content-Type': 'application/json'
  };

  // Create workflow
  const workflowPayload = {
    name: `Load Test Workflow ${Math.random()}`,
    steps: [
      { type: 'data-validation', config: { rules: ['required'] }, order: 0 }
    ]
  };

  const createResponse = http.post(
    `${__ENV.BASE_URL}/api/workflows`,
    JSON.stringify(workflowPayload),
    { headers }
  );

  check(createResponse, {
    'workflow created': (r) => r.status === 201,
    'response time OK': (r) => r.timings.duration < 2000,
  });

  if (createResponse.status === 201) {
    const workflowId = createResponse.json('data.id');
    
    // Execute workflow
    const executeResponse = http.post(
      `${__ENV.BASE_URL}/api/workflows/${workflowId}/execute`,
      '{}',
      { headers }
    );

    const executionTime = executeResponse.timings.duration;
    workflowExecutionTime.add(executionTime);

    check(executeResponse, {
      'workflow executed': (r) => r.status === 200,
      'execution time acceptable': (r) => r.timings.duration < 5000,
    });

    errorRate.add(executeResponse.status !== 200);
  }

  sleep(1);
}
```

## AI/ML Model Testing

### Model Accuracy Testing
```python
# testing/data-quality/model-accuracy-test.py
import pytest
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score
from services.src.ai_ml_engine.text_classifier import TextClassifier

class TestTextClassifierAccuracy:
    @pytest.fixture
    def classifier(self):
        return TextClassifier(model_path='models/email_classifier.pkl')
    
    @pytest.fixture
    def test_dataset(self):
        return pd.read_csv('testing/data/email_classification_test.csv')
    
    def test_email_classification_accuracy(self, classifier, test_dataset):
        """Test that email classification meets accuracy requirements."""
        predictions = []
        actual_labels = []
        
        for _, row in test_dataset.iterrows():
            prediction = classifier.classify(row['email_text'])
            predictions.append(prediction['category'])
            actual_labels.append(row['actual_category'])
        
        accuracy = accuracy_score(actual_labels, predictions)
        precision = precision_score(actual_labels, predictions, average='weighted')
        recall = recall_score(actual_labels, predictions, average='weighted')
        
        # Assert accuracy requirements
        assert accuracy >= 0.85, f"Accuracy {accuracy:.3f} below required 0.85"
        assert precision >= 0.80, f"Precision {precision:.3f} below required 0.80"
        assert recall >= 0.80, f"Recall {recall:.3f} below required 0.80"
        
        # Log detailed results
        print(f"Model Performance:")
        print(f"  Accuracy: {accuracy:.3f}")
        print(f"  Precision: {precision:.3f}")
        print(f"  Recall: {recall:.3f}")
    
    def test_classification_confidence_scores(self, classifier):
        """Test that confidence scores are within expected ranges."""
        test_emails = [
            "URGENT: Please review this immediately!",
            "Meeting scheduled for tomorrow at 2 PM",
            "Invoice #12345 attached for payment"
        ]
        
        for email in test_emails:
            result = classifier.classify(email)
            
            assert 'confidence' in result
            assert 0.0 <= result['confidence'] <= 1.0
            assert result['confidence'] > 0.5  # Minimum confidence threshold
```

## Test Data Management

### Test Data Factories
```typescript
// testing/factories/workflow-factory.ts
export class WorkflowFactory {
  static create(overrides: Partial<Workflow> = {}): Workflow {
    return {
      id: faker.datatype.uuid(),
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
      status: 'draft',
      steps: [this.createStep()],
      createdBy: faker.datatype.uuid(),
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
      tags: [faker.random.word()],
      metadata: {},
      ...overrides
    };
  }

  static createStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
    return {
      id: faker.datatype.uuid(),
      type: faker.random.arrayElement(['data-validation', 'email-processing', 'ai-classification']),
      name: faker.hacker.phrase(),
      config: { timeout: 30000 },
      order: faker.datatype.number({ min: 0, max: 10 }),
      dependencies: [],
      retryPolicy: { maxAttempts: 3, backoffMs: 1000 },
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<Workflow> = {}): Workflow[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
```

### Database Seeding
```typescript
// testing/seeds/test-data-seeder.ts
export class TestDataSeeder {
  async seedTestData(): Promise<void> {
    // Create test users
    const adminUser = await UserModel.create({
      email: 'admin@test.com',
      name: 'Test Admin',
      role: 'admin',
      password: await bcrypt.hash('password', 10)
    });

    const regularUser = await UserModel.create({
      email: 'user@test.com',
      name: 'Test User',
      role: 'user',
      password: await bcrypt.hash('password', 10)
    });

    // Create test workflows
    const workflows = WorkflowFactory.createMany(5, { createdBy: adminUser.id });
    await WorkflowModel.insertMany(workflows);

    // Create test executions
    const executions = workflows.map(workflow => ({
      workflowId: workflow.id,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        output: { result: 'success' }
      }))
    }));
    
    await ExecutionModel.insertMany(executions);
  }

  async clearTestData(): Promise<void> {
    await Promise.all([
      UserModel.deleteMany({ email: { $regex: '@test.com$' } }),
      WorkflowModel.deleteMany({}),
      ExecutionModel.deleteMany({})
    ]);
  }
}
```

## Test Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/testing/setup/jest.setup.ts'],
  testTimeout: 10000,
  maxWorkers: '50%'
};
```

### Test Environment Setup
```typescript
// testing/setup/jest.setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Redis from 'ioredis';

let mongoServer: MongoMemoryServer;
let redisClient: Redis;

beforeAll(async () => {
  // Setup in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Setup test Redis
  redisClient = new Redis({ db: 1 });
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.LOG_LEVEL = 'error';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await redisClient.quit();
});

beforeEach(async () => {
  // Clear database between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  
  // Clear Redis
  await redisClient.flushdb();
});
```

## Continuous Integration

### GitHub Actions Test Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:5.0
        ports:
          - 27017:27017
      redis:
        image: redis:6.2
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd services && npm ci
          cd ../client && npm ci
      
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Start application
        run: |
          docker-compose up -d
          npm run wait-for-services
      
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload E2E artifacts
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: client/cypress/screenshots
```

## File References

#[[file:../../services/src/shared/types/workflow.ts]]
#[[file:../../testing/unit/workflow-service.test.ts]]
#[[file:../../testing/integration/workflow-api.test.ts]]
#[[file:../../testing/e2e/cypress/integration/workflow-management.spec.ts]]
#[[file:../../testing/performance/k6-load-tests.js]]