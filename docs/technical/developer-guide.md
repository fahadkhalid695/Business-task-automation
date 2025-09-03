# Developer Guide

## Overview

This guide provides comprehensive information for developers working on the Business Task Automation Platform. It covers system architecture, development setup, coding standards, and contribution guidelines.

## System Architecture

### High-Level Architecture

The platform follows a microservices architecture with the following core components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile Apps    │    │  External APIs  │
│   (React)       │    │   (Future)      │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │     API Gateway         │
                    │   (Express.js + Auth)   │
                    └─────────────┬───────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐    ┌──────────▼──────────┐    ┌─────────▼────────┐
│ Task Orchestrator│    │   AI/ML Engine      │    │  Service Layer   │
│  (Workflow Mgmt) │    │ (Model Management)  │    │ (Business Logic) │
└───────┬────────┘    └──────────┬──────────┘    └─────────┬────────┘
        │                        │                         │
        └────────────────────────┼─────────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │    Data Layer           │
                    │  MongoDB + Redis        │
                    └─────────────────────────┘
```

### Service Components

#### API Gateway
- **Technology**: Express.js, TypeScript
- **Responsibilities**: Request routing, authentication, rate limiting, CORS
- **Port**: 3000
- **Health Check**: `/api/health`

#### Task Orchestrator
- **Technology**: Node.js, Bull Queue, TypeScript
- **Responsibilities**: Workflow execution, task scheduling, step processing
- **Port**: 3001
- **Key Classes**: `WorkflowEngine`, `TaskScheduler`, `StepProcessor`

#### AI/ML Engine
- **Technology**: Python, TensorFlow, OpenAI API
- **Responsibilities**: Model management, inference, training pipelines
- **Port**: 3002
- **Key Classes**: `ModelManager`, `InferenceEngine`, `TrainingPipeline`

#### Service Layer
- **Administrative Service**: Email processing, calendar management, document generation
- **Data Analytics Service**: Data cleaning, report generation, trend analysis
- **Communication Service**: Chatbots, transcription, translation
- **Project Management Service**: Task assignment, progress tracking
- **Finance/HR Service**: Expense processing, payroll, recruitment
- **Creative Service**: Content generation, design assistance

### Data Architecture

#### MongoDB Collections
- `users`: User accounts and preferences
- `workflows`: Workflow definitions and templates
- `tasks`: Individual task instances
- `executions`: Workflow execution history
- `documents`: File metadata and references
- `integrations`: External service configurations
- `audit_logs`: System activity tracking

#### Redis Usage
- **Caching**: Frequently accessed data, session storage
- **Message Queue**: Task processing, inter-service communication
- **Pub/Sub**: Real-time notifications, event broadcasting

## Development Setup

### Prerequisites

**Required Software:**
- Node.js 18+ and npm
- Python 3.9+ and pip
- Docker and Docker Compose
- MongoDB 6+
- Redis 7+
- Git

**Development Tools:**
- VS Code (recommended) with extensions:
  - TypeScript and JavaScript Language Features
  - Python
  - Docker
  - MongoDB for VS Code
  - GitLens

### Local Environment Setup

1. **Clone Repository**
```bash
git clone https://github.com/company/business-automation-platform.git
cd business-automation-platform
```

2. **Install Dependencies**
```bash
# Root dependencies
npm install

# Service dependencies
cd services && npm install && cd ..

# Client dependencies
cd client && npm install && cd ..

# Python dependencies
pip install -r services/ai-ml-engine/requirements.txt
```

3. **Environment Configuration**
```bash
# Copy environment templates
cp services/.env.example services/.env
cp client/.env.example client/.env

# Configure database connections and API keys
# Edit .env files with your local settings
```

4. **Start Development Environment**
```bash
# Start databases
docker-compose up -d mongodb redis

# Start all services
npm run dev

# Or start individual services
npm run dev:api-gateway
npm run dev:task-orchestrator
npm run dev:ai-engine
npm run dev:client
```

5. **Verify Setup**
```bash
# Check service health
curl http://localhost:3000/api/health
curl http://localhost:3001/health
curl http://localhost:3002/health

# Access web interface
open http://localhost:3000
```

### Development Workflow

#### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature development
- `hotfix/*`: Critical production fixes
- `release/*`: Release preparation

#### Commit Convention
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Scope: api, ui, workflow, ai, data, auth, etc.

Examples:
feat(workflow): add conditional branching support
fix(auth): resolve JWT token expiration issue
docs(api): update OpenAPI specification
```

#### Pull Request Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Update documentation if needed
4. Run full test suite
5. Create PR with detailed description
6. Address code review feedback
7. Merge after approval and CI passes

## Coding Standards

### TypeScript/JavaScript

**Code Style:**
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Use meaningful variable and function names
- Prefer `const` over `let`, avoid `var`
- Use async/await over Promises when possible

**Example:**
```typescript
// Good
interface WorkflowStep {
  id: string;
  type: StepType;
  config: StepConfig;
  status: StepStatus;
}

class WorkflowEngine {
  async executeWorkflow(workflow: Workflow): Promise<ExecutionResult> {
    try {
      const steps = await this.validateSteps(workflow.steps);
      return await this.processSteps(steps);
    } catch (error) {
      this.logger.error('Workflow execution failed', { error, workflowId: workflow.id });
      throw new WorkflowExecutionError(error.message);
    }
  }
}
```

**Error Handling:**
```typescript
// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Consistent error responses
export const handleError = (error: Error, res: Response) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      field: error.field
    });
  }
  
  logger.error('Unexpected error', error);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
};
```

### Python

**Code Style:**
- Follow PEP 8 style guide
- Use type hints for function parameters and returns
- Use docstrings for classes and functions
- Prefer f-strings for string formatting

**Example:**
```python
from typing import List, Optional, Dict, Any
import logging

class ModelManager:
    """Manages AI model lifecycle and deployment."""
    
    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.models: Dict[str, Any] = {}
    
    async def load_model(self, model_name: str, model_path: str) -> bool:
        """
        Load a model from the specified path.
        
        Args:
            model_name: Unique identifier for the model
            model_path: Path to the model file
            
        Returns:
            True if model loaded successfully, False otherwise
        """
        try:
            model = await self._load_model_from_path(model_path)
            self.models[model_name] = model
            self.logger.info(f"Model {model_name} loaded successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load model {model_name}: {e}")
            return False
```

### Database Patterns

**MongoDB Schema Design:**
```typescript
// Use Mongoose schemas with validation
const WorkflowSchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  type: { type: String, required: true, enum: WORKFLOW_TYPES },
  steps: [{
    id: { type: String, required: true },
    type: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    order: { type: Number, required: true }
  }],
  status: { type: String, enum: WORKFLOW_STATUSES, default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for performance
WorkflowSchema.index({ createdBy: 1, status: 1 });
WorkflowSchema.index({ type: 1, createdAt: -1 });
```

**Repository Pattern:**
```typescript
export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor() {
    super(WorkflowModel);
  }
  
  async findByUserAndStatus(userId: string, status: WorkflowStatus): Promise<Workflow[]> {
    return this.model.find({ createdBy: userId, status }).exec();
  }
  
  async findActiveWorkflows(): Promise<Workflow[]> {
    return this.model.find({ 
      status: { $in: ['running', 'pending'] } 
    }).populate('createdBy').exec();
  }
}
```

## Testing Guidelines

### Unit Testing

**Jest Configuration:**
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

**Test Structure:**
```typescript
describe('WorkflowEngine', () => {
  let workflowEngine: WorkflowEngine;
  let mockRepository: jest.Mocked<WorkflowRepository>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    workflowEngine = new WorkflowEngine(mockRepository);
  });
  
  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      // Arrange
      const workflow = createTestWorkflow();
      mockRepository.findById.mockResolvedValue(workflow);
      
      // Act
      const result = await workflowEngine.executeWorkflow(workflow.id);
      
      // Assert
      expect(result.status).toBe('completed');
      expect(mockRepository.update).toHaveBeenCalledWith(
        workflow.id,
        expect.objectContaining({ status: 'completed' })
      );
    });
    
    it('should handle workflow execution errors', async () => {
      // Arrange
      const workflow = createTestWorkflow();
      mockRepository.findById.mockRejectedValue(new Error('Database error'));
      
      // Act & Assert
      await expect(workflowEngine.executeWorkflow(workflow.id))
        .rejects.toThrow('Database error');
    });
  });
});
```

### Integration Testing

**API Testing:**
```typescript
describe('Workflow API', () => {
  let app: Express;
  let testDb: MongoMemoryServer;
  
  beforeAll(async () => {
    testDb = await MongoMemoryServer.create();
    app = createTestApp(testDb.getUri());
  });
  
  afterAll(async () => {
    await testDb.stop();
  });
  
  it('POST /api/workflows should create workflow', async () => {
    const workflowData = {
      name: 'Test Workflow',
      type: 'data-processing',
      steps: [{ type: 'data-validation', config: {} }]
    };
    
    const response = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${testToken}`)
      .send(workflowData)
      .expect(201);
    
    expect(response.body).toMatchObject({
      name: workflowData.name,
      type: workflowData.type,
      status: 'draft'
    });
  });
});
```

## API Development

### RESTful API Design

**Resource Naming:**
- Use nouns for resources: `/api/workflows`, `/api/tasks`
- Use HTTP methods appropriately: GET, POST, PUT, DELETE
- Use plural nouns for collections
- Use nested resources for relationships: `/api/workflows/{id}/executions`

**Response Format:**
```typescript
// Success Response
{
  "data": { /* resource data */ },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}

// Error Response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

**Pagination:**
```typescript
// Request
GET /api/workflows?page=2&limit=20&sort=createdAt&order=desc

// Response
{
  "data": [ /* workflow objects */ ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Authentication & Authorization

**JWT Implementation:**
```typescript
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user as User;
    next();
  });
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

## Deployment

### Docker Configuration

**Multi-stage Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 3000
CMD ["npm", "start"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  api-gateway:
    build: 
      context: .
      dockerfile: services/Dockerfile.api-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mongodb://mongodb:27017/business_automation
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    
  mongodb:
    image: mongo:6
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

### Kubernetes Deployment

**Deployment Configuration:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: business-automation/api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Monitoring and Observability

### Logging

**Structured Logging:**
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage
logger.info('Workflow executed successfully', {
  workflowId: workflow.id,
  userId: user.id,
  duration: executionTime,
  steps: workflow.steps.length
});
```

### Metrics

**Prometheus Metrics:**
```typescript
import client from 'prom-client';

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const workflowExecutions = new client.Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['type', 'status']
});

// Middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
};
```

## Contributing Guidelines

### Code Review Checklist

**Functionality:**
- [ ] Code works as intended
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed

**Code Quality:**
- [ ] Code follows style guidelines
- [ ] Functions are focused and single-purpose
- [ ] Variable names are descriptive
- [ ] Comments explain why, not what

**Testing:**
- [ ] Unit tests cover new functionality
- [ ] Integration tests updated if needed
- [ ] Test coverage meets requirements
- [ ] Tests are reliable and fast

**Documentation:**
- [ ] API documentation updated
- [ ] README updated if needed
- [ ] Code comments added where necessary
- [ ] Breaking changes documented

### Release Process

1. **Feature Freeze**: Stop adding new features
2. **Testing**: Run comprehensive test suite
3. **Documentation**: Update all documentation
4. **Version Bump**: Update version numbers
5. **Release Notes**: Document changes and fixes
6. **Deployment**: Deploy to staging, then production
7. **Monitoring**: Watch for issues post-deployment

### Getting Help

**Internal Resources:**
- Architecture documentation
- Code examples and patterns
- Development team Slack channels
- Weekly developer meetings

**External Resources:**
- Technology documentation (Node.js, MongoDB, etc.)
- Best practices guides
- Community forums and Stack Overflow
- Training materials and courses

---

*This developer guide is a living document. Please keep it updated as the system evolves and new patterns emerge.*