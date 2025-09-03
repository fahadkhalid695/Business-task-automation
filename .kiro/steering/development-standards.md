---
inclusion: always
---

# Development Standards and Guidelines

## Overview
This document defines the development standards, coding conventions, and best practices for the Business Task Automation Platform. All contributors must follow these guidelines to ensure code quality, maintainability, and consistency across the project.

## Code Style and Formatting

### TypeScript/JavaScript Standards

#### Naming Conventions
```typescript
// Use PascalCase for classes, interfaces, types, and enums
class WorkflowEngine { }
interface WorkflowConfig { }
type ExecutionStatus = 'pending' | 'running' | 'completed';
enum TaskPriority { LOW, MEDIUM, HIGH, CRITICAL }

// Use camelCase for variables, functions, and methods
const workflowId = 'workflow-123';
function executeWorkflow(workflow: Workflow): Promise<ExecutionResult> { }

// Use SCREAMING_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 30000;

// Use kebab-case for file names
// workflow-engine.ts, task-scheduler.ts, user-service.ts
```

#### Function and Method Guidelines
```typescript
// Prefer explicit return types
function calculateExecutionTime(startTime: Date, endTime: Date): number {
  return endTime.getTime() - startTime.getTime();
}

// Use async/await over Promises
async function processWorkflow(workflow: Workflow): Promise<ExecutionResult> {
  try {
    const result = await workflowEngine.execute(workflow);
    return result;
  } catch (error) {
    logger.error('Workflow execution failed', { workflowId: workflow.id, error });
    throw new WorkflowExecutionError(error.message);
  }
}

// Prefer arrow functions for short operations
const isCompleted = (status: ExecutionStatus) => status === 'completed';
const filterActiveWorkflows = (workflows: Workflow[]) => 
  workflows.filter(w => w.status === 'active');
```

#### Error Handling
```typescript
// Use custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Consistent error handling pattern
export const handleApiError = (error: Error, res: Response) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      field: error.field,
      timestamp: new Date().toISOString()
    });
  }
  
  logger.error('Unexpected error', { error: error.message, stack: error.stack });
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
};
```

### Python Standards

#### Code Style
```python
# Follow PEP 8 style guide
# Use snake_case for variables and functions
workflow_id = "workflow-123"
def execute_workflow(workflow: Workflow) -> ExecutionResult:
    pass

# Use PascalCase for classes
class ModelManager:
    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
    
    def load_model(self, model_path: str) -> bool:
        """Load a model from the specified path."""
        try:
            # Implementation here
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False

# Use SCREAMING_SNAKE_CASE for constants
MAX_MODEL_SIZE = 1024 * 1024 * 1024  # 1GB
DEFAULT_CONFIDENCE_THRESHOLD = 0.8
```

#### Type Hints
```python
from typing import List, Dict, Optional, Union, Any
from dataclasses import dataclass

@dataclass
class ModelConfig:
    name: str
    version: str
    parameters: Dict[str, Any]
    confidence_threshold: float = 0.8

def classify_text(
    text: str, 
    model: str, 
    config: Optional[ModelConfig] = None
) -> Dict[str, Union[str, float]]:
    """Classify text using the specified model."""
    # Implementation here
    pass
```

## Architecture Patterns

### Microservices Design

#### Service Structure
```
services/src/service-name/
├── controllers/          # HTTP request handlers
├── services/            # Business logic
├── repositories/        # Data access layer
├── models/             # Data models and schemas
├── middleware/         # Custom middleware
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── __tests__/          # Unit tests
└── index.ts            # Service entry point
```

#### Dependency Injection
```typescript
// Use dependency injection for testability
export class WorkflowService {
  constructor(
    private workflowRepository: WorkflowRepository,
    private taskScheduler: TaskScheduler,
    private logger: Logger
  ) {}
  
  async createWorkflow(data: CreateWorkflowDto): Promise<Workflow> {
    // Implementation
  }
}

// Container configuration
export const container = new Container();
container.bind<WorkflowRepository>('WorkflowRepository').to(MongoWorkflowRepository);
container.bind<TaskScheduler>('TaskScheduler').to(BullTaskScheduler);
container.bind<Logger>('Logger').to(WinstonLogger);
```

#### Error Handling Strategy
```typescript
// Centralized error handling
export class ErrorHandler {
  static handle(error: Error, context: string): void {
    if (error instanceof ValidationError) {
      logger.warn('Validation error', { context, error: error.message });
    } else if (error instanceof BusinessLogicError) {
      logger.error('Business logic error', { context, error: error.message });
    } else {
      logger.error('Unexpected error', { context, error: error.message, stack: error.stack });
    }
  }
}

// Circuit breaker pattern for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

## Database Design

### MongoDB Schema Design
```typescript
// Use Mongoose schemas with validation
const WorkflowSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true 
  },
  description: { 
    type: String, 
    maxlength: 500 
  },
  steps: [{
    id: { type: String, required: true },
    type: { type: String, required: true, enum: STEP_TYPES },
    config: { type: Schema.Types.Mixed, required: true },
    order: { type: Number, required: true }
  }],
  status: { 
    type: String, 
    enum: ['draft', 'active', 'inactive', 'archived'], 
    default: 'draft' 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  tags: [{ type: String, maxlength: 50 }],
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  versionKey: false
});

// Add indexes for performance
WorkflowSchema.index({ createdBy: 1, status: 1 });
WorkflowSchema.index({ name: 'text', description: 'text' });
WorkflowSchema.index({ 'tags': 1 });
WorkflowSchema.index({ createdAt: -1 });
```

### Repository Pattern
```typescript
export abstract class BaseRepository<T> {
  constructor(protected model: Model<T>) {}
  
  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }
  
  async create(data: Partial<T>): Promise<T> {
    const entity = new this.model(data);
    return entity.save();
  }
  
  async update(id: string, data: Partial<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  
  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}

export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor() {
    super(WorkflowModel);
  }
  
  async findByUser(userId: string, status?: WorkflowStatus): Promise<Workflow[]> {
    const query: any = { createdBy: userId };
    if (status) query.status = status;
    
    return this.model.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .exec();
  }
}
```

## API Design

### RESTful API Standards
```typescript
// Use consistent URL patterns
// GET    /api/workflows           - List workflows
// POST   /api/workflows           - Create workflow
// GET    /api/workflows/:id       - Get workflow by ID
// PUT    /api/workflows/:id       - Update workflow
// DELETE /api/workflows/:id       - Delete workflow
// POST   /api/workflows/:id/execute - Execute workflow

// Consistent response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// Pagination format
interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### Input Validation
```typescript
// Use Joi for request validation
const createWorkflowSchema = Joi.object({
  name: Joi.string().required().max(100).trim(),
  description: Joi.string().max(500).optional(),
  steps: Joi.array().items(
    Joi.object({
      type: Joi.string().required().valid(...STEP_TYPES),
      config: Joi.object().required(),
      order: Joi.number().integer().min(0).required()
    })
  ).min(1).required(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});

// Validation middleware
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        }
      });
    }
    req.body = value;
    next();
  };
};
```

## Testing Standards

### Unit Testing
```typescript
// Use Jest for unit testing
describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let mockRepository: jest.Mocked<WorkflowRepository>;
  let mockScheduler: jest.Mocked<TaskScheduler>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    mockScheduler = createMockScheduler();
    workflowService = new WorkflowService(mockRepository, mockScheduler, mockLogger);
  });
  
  describe('createWorkflow', () => {
    it('should create workflow successfully', async () => {
      // Arrange
      const workflowData = createTestWorkflowData();
      mockRepository.create.mockResolvedValue(createTestWorkflow());
      
      // Act
      const result = await workflowService.createWorkflow(workflowData);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(workflowData.name);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(workflowData)
      );
    });
    
    it('should handle validation errors', async () => {
      // Arrange
      const invalidData = { name: '' }; // Invalid workflow data
      
      // Act & Assert
      await expect(workflowService.createWorkflow(invalidData))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Testing
```typescript
// Test API endpoints with supertest
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
      steps: [{ type: 'data-validation', config: {}, order: 0 }]
    };
    
    const response = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${testToken}`)
      .send(workflowData)
      .expect(201);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(workflowData.name);
  });
});
```

## Security Standards

### Authentication and Authorization
```typescript
// JWT token validation
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Access token required' }
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
      });
    }
    req.user = user as AuthenticatedUser;
    next();
  });
};

// Role-based authorization
export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Access denied' }
      });
    }
    next();
  };
};
```

### Data Validation and Sanitization
```typescript
// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

// SQL injection prevention (for raw queries)
export const escapeSQL = (value: string): string => {
  return value.replace(/'/g, "''");
};

// XSS prevention
export const escapeHTML = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};
```

## Performance Guidelines

### Database Optimization
```typescript
// Use proper indexing
// Create compound indexes for common query patterns
db.workflows.createIndex({ "createdBy": 1, "status": 1, "createdAt": -1 });

// Use aggregation pipelines for complex queries
const getWorkflowStats = async (userId: string) => {
  return WorkflowModel.aggregate([
    { $match: { createdBy: new ObjectId(userId) } },
    { $group: {
        _id: "$status",
        count: { $sum: 1 },
        avgExecutionTime: { $avg: "$executionTime" }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Use lean queries for read-only operations
const workflows = await WorkflowModel
  .find({ status: 'active' })
  .lean()
  .select('name status createdAt')
  .exec();
```

### Caching Strategy
```typescript
// Redis caching for frequently accessed data
export class CacheService {
  private redis: Redis;
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Cache workflow templates
const getCachedWorkflowTemplate = async (templateId: string): Promise<WorkflowTemplate> => {
  const cacheKey = `workflow:template:${templateId}`;
  let template = await cacheService.get<WorkflowTemplate>(cacheKey);
  
  if (!template) {
    template = await WorkflowTemplateModel.findById(templateId).lean().exec();
    if (template) {
      await cacheService.set(cacheKey, template, 3600); // 1 hour TTL
    }
  }
  
  return template;
};
```

## Documentation Standards

### Code Documentation
```typescript
/**
 * Executes a workflow with the specified configuration.
 * 
 * @param workflow - The workflow to execute
 * @param context - Execution context with variables and settings
 * @returns Promise that resolves to the execution result
 * 
 * @throws {ValidationError} When workflow configuration is invalid
 * @throws {ExecutionError} When workflow execution fails
 * 
 * @example
 * ```typescript
 * const workflow = await workflowService.getById('workflow-123');
 * const result = await workflowEngine.execute(workflow, { userId: 'user-456' });
 * console.log(`Workflow completed in ${result.duration}ms`);
 * ```
 */
async execute(workflow: Workflow, context: ExecutionContext): Promise<ExecutionResult> {
  // Implementation
}
```

### API Documentation
```yaml
# OpenAPI specification example
/api/workflows:
  post:
    summary: Create a new workflow
    description: Creates a new workflow with the specified configuration
    tags:
      - Workflows
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateWorkflowRequest'
    responses:
      '201':
        description: Workflow created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WorkflowResponse'
      '400':
        description: Invalid request data
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ErrorResponse'
```

## File References

#[[file:../../services/src/shared/types/workflow.ts]]
#[[file:../../services/src/shared/utils/validation.ts]]
#[[file:../../services/src/shared/middleware/auth.ts]]
#[[file:../../testing/unit/workflow-service.test.ts]]