---
inclusion: fileMatch
fileMatchPattern: "**/*.{ts,js,py}"
---

# Security Practices and Guidelines

## Overview
This document outlines security best practices, standards, and requirements for the Business Task Automation Platform. All code must adhere to these security guidelines to ensure the protection of user data and system integrity.

## Authentication and Authorization

### JWT Token Management
```typescript
// Secure JWT implementation
export class JWTService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    this.secret = process.env.JWT_SECRET!;
    this.issuer = process.env.JWT_ISSUER || 'business-automation';
    this.audience = process.env.JWT_AUDIENCE || 'business-automation-users';
    
    if (!this.secret || this.secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      iss: this.issuer,
      aud: this.audience
    };

    return jwt.sign(payload, this.secret, { algorithm: 'HS256' });
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      }) as JWTPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }
}
```

### Password Security
```typescript
// Secure password handling
export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;
  private static readonly PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

  static async hashPassword(password: string): Promise<string> {
    this.validatePassword(password);
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validatePassword(password: string): void {
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (!this.PASSWORD_REGEX.test(password)) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      throw new ValidationError('Password is too common, please choose a stronger password');
    }
  }

  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }
}
```

### Role-Based Access Control
```typescript
// RBAC implementation
export enum Permission {
  // Workflow permissions
  WORKFLOW_CREATE = 'workflow:create',
  WORKFLOW_READ = 'workflow:read',
  WORKFLOW_UPDATE = 'workflow:update',
  WORKFLOW_DELETE = 'workflow:delete',
  WORKFLOW_EXECUTE = 'workflow:execute',
  
  // User management permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // System administration
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_BACKUP = 'system:backup'
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    Permission.WORKFLOW_CREATE, Permission.WORKFLOW_READ, Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_DELETE, Permission.WORKFLOW_EXECUTE,
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE,
    Permission.SYSTEM_CONFIG, Permission.SYSTEM_MONITOR, Permission.SYSTEM_BACKUP
  ],
  manager: [
    Permission.WORKFLOW_CREATE, Permission.WORKFLOW_READ, Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_EXECUTE, Permission.USER_READ, Permission.SYSTEM_MONITOR
  ],
  user: [
    Permission.WORKFLOW_CREATE, Permission.WORKFLOW_READ, Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_EXECUTE
  ],
  viewer: [
    Permission.WORKFLOW_READ
  ]
};

export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthenticatedUser;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const userPermissions = RolePermissions[user.role] || [];
    
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }

    next();
  };
};
```

## Input Validation and Sanitization

### Request Validation
```typescript
// Comprehensive input validation
export class ValidationService {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, maxLength);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validateWorkflowName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Workflow name is required');
    }

    if (name.length > 100) {
      throw new ValidationError('Workflow name must be 100 characters or less');
    }

    // Check for potentially malicious patterns
    const maliciousPatterns = [
      /<script/i, /javascript:/i, /on\w+=/i, /data:/i, /vbscript:/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(name)) {
        throw new ValidationError('Workflow name contains invalid characters');
      }
    }
  }

  static validateJSON(jsonString: string): any {
    try {
      const parsed = JSON.parse(jsonString);
      
      // Prevent prototype pollution
      if (this.hasPrototypePollution(parsed)) {
        throw new ValidationError('Invalid JSON structure detected');
      }
      
      return parsed;
    } catch (error) {
      throw new ValidationError('Invalid JSON format');
    }
  }

  private static hasPrototypePollution(obj: any): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (dangerousKeys.includes(key)) {
          return true;
        }
        
        if (typeof obj[key] === 'object' && this.hasPrototypePollution(obj[key])) {
          return true;
        }
      }
    }
    
    return false;
  }
}
```

### SQL Injection Prevention
```typescript
// Safe database queries
export class DatabaseSecurity {
  // Use parameterized queries for raw SQL (if needed)
  static async executeQuery(query: string, params: any[]): Promise<any> {
    // Validate query doesn't contain dangerous patterns
    const dangerousPatterns = [
      /;\s*(drop|delete|truncate|alter)\s+/i,
      /union\s+select/i,
      /exec\s*\(/i,
      /script\s*>/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new SecurityError('Potentially dangerous SQL query detected');
      }
    }

    // Execute with parameterized query (example with MongoDB)
    return MongoClient.db().collection('workflows').find(query, { params });
  }

  // Safe MongoDB aggregation
  static buildSafeAggregation(userInput: any): any[] {
    // Sanitize aggregation pipeline
    const sanitized = this.sanitizeAggregationStage(userInput);
    
    return [
      { $match: sanitized.match || {} },
      { $sort: sanitized.sort || { createdAt: -1 } },
      { $limit: Math.min(sanitized.limit || 20, 100) }, // Cap at 100
      { $project: sanitized.project || { password: 0, __v: 0 } } // Exclude sensitive fields
    ];
  }

  private static sanitizeAggregationStage(stage: any): any {
    // Remove potentially dangerous operators
    const dangerousOperators = ['$where', '$function', '$accumulator', '$expr'];
    
    const sanitized = { ...stage };
    
    for (const op of dangerousOperators) {
      delete sanitized[op];
    }
    
    return sanitized;
  }
}
```

## Data Encryption

### Encryption Service
```typescript
// AES-256 encryption for sensitive data
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly key: Buffer;

  constructor() {
    const keyString = process.env.ENCRYPTION_KEY;
    
    if (!keyString || keyString.length !== 64) { // 32 bytes = 64 hex chars
      throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
    }
    
    this.key = Buffer.from(keyString, 'hex');
  }

  encrypt(plaintext: string): EncryptedData {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipher(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Hash sensitive data for storage (one-way)
  hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}
```

### Secure Configuration Management
```typescript
// Secure handling of configuration and secrets
export class ConfigService {
  private static instance: ConfigService;
  private config: Map<string, string> = new Map();

  private constructor() {
    this.loadConfiguration();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfiguration(): void {
    // Load from environment variables
    const requiredVars = [
      'JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL', 'REDIS_URL'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Required environment variable ${varName} is not set`);
      }
      this.config.set(varName, value);
    }

    // Validate configuration
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    const jwtSecret = this.config.get('JWT_SECRET')!;
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    const encryptionKey = this.config.get('ENCRYPTION_KEY')!;
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters');
    }
  }

  get(key: string): string {
    const value = this.config.get(key);
    if (!value) {
      throw new Error(`Configuration key ${key} not found`);
    }
    return value;
  }

  // Never log sensitive configuration
  getSafeConfig(): Record<string, string> {
    const safeKeys = ['NODE_ENV', 'PORT', 'LOG_LEVEL'];
    const safeConfig: Record<string, string> = {};
    
    for (const key of safeKeys) {
      const value = process.env[key];
      if (value) {
        safeConfig[key] = value;
      }
    }
    
    return safeConfig;
  }
}
```

## API Security

### Rate Limiting
```typescript
// Advanced rate limiting
export class RateLimitService {
  private redis: Redis;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  createRateLimit(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.generateKey(req, options.keyGenerator);
      const current = await this.getCurrentCount(key);
      
      if (current >= options.max) {
        const resetTime = await this.getResetTime(key);
        
        res.set({
          'X-RateLimit-Limit': options.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString()
        });
        
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
          }
        });
      }
      
      await this.incrementCount(key, options.windowMs);
      
      res.set({
        'X-RateLimit-Limit': options.max.toString(),
        'X-RateLimit-Remaining': (options.max - current - 1).toString()
      });
      
      next();
    };
  }

  private generateKey(req: Request, keyGenerator?: (req: Request) => string): string {
    if (keyGenerator) {
      return keyGenerator(req);
    }
    
    // Default: IP + User ID (if authenticated)
    const ip = req.ip || req.connection.remoteAddress;
    const userId = (req.user as AuthenticatedUser)?.id || 'anonymous';
    
    return `rate_limit:${ip}:${userId}`;
  }

  private async getCurrentCount(key: string): Promise<number> {
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  private async incrementCount(key: string, windowMs: number): Promise<void> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, Math.ceil(windowMs / 1000));
    await multi.exec();
  }

  private async getResetTime(key: string): Promise<number> {
    const ttl = await this.redis.ttl(key);
    return Date.now() + (ttl * 1000);
  }
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

// Usage examples
export const createAuthRateLimit = (rateLimitService: RateLimitService) =>
  rateLimitService.createRateLimit({
    max: 5, // 5 attempts
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyGenerator: (req) => `auth:${req.ip}:${req.body.email || 'unknown'}`
  });

export const createAPIRateLimit = (rateLimitService: RateLimitService) =>
  rateLimitService.createRateLimit({
    max: 100, // 100 requests
    windowMs: 60 * 1000, // 1 minute
  });
```

### CORS Configuration
```typescript
// Secure CORS configuration
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
};
```

## Security Headers

### Helmet Configuration
```typescript
// Security headers with Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable if using third-party embeds
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});
```

## Audit Logging

### Security Event Logging
```typescript
// Comprehensive audit logging
export class AuditLogger {
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }

  logAuthenticationEvent(event: AuthEvent): void {
    this.logger.info('Authentication event', {
      type: 'AUTHENTICATION',
      event: event.type,
      userId: event.userId,
      email: event.email,
      ip: event.ip,
      userAgent: event.userAgent,
      success: event.success,
      timestamp: new Date().toISOString(),
      sessionId: event.sessionId
    });
  }

  logAuthorizationEvent(event: AuthzEvent): void {
    this.logger.warn('Authorization event', {
      type: 'AUTHORIZATION',
      userId: event.userId,
      resource: event.resource,
      action: event.action,
      granted: event.granted,
      ip: event.ip,
      timestamp: new Date().toISOString()
    });
  }

  logDataAccess(event: DataAccessEvent): void {
    this.logger.info('Data access event', {
      type: 'DATA_ACCESS',
      userId: event.userId,
      resource: event.resource,
      action: event.action,
      recordId: event.recordId,
      ip: event.ip,
      timestamp: new Date().toISOString()
    });
  }

  logSecurityIncident(event: SecurityIncident): void {
    this.logger.error('Security incident', {
      type: 'SECURITY_INCIDENT',
      severity: event.severity,
      category: event.category,
      description: event.description,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      timestamp: new Date().toISOString(),
      additionalData: event.additionalData
    });
  }
}

interface AuthEvent {
  type: 'LOGIN' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'ACCOUNT_LOCKED';
  userId?: string;
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  sessionId?: string;
}

interface AuthzEvent {
  userId: string;
  resource: string;
  action: string;
  granted: boolean;
  ip: string;
}

interface DataAccessEvent {
  userId: string;
  resource: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  recordId?: string;
  ip: string;
}

interface SecurityIncident {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'INJECTION' | 'XSS' | 'CSRF' | 'BRUTE_FORCE' | 'DATA_BREACH' | 'OTHER';
  description: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  additionalData?: any;
}
```

## Security Testing

### Security Test Cases
```typescript
// Security-focused test cases
describe('Security Tests', () => {
  describe('Authentication Security', () => {
    it('should reject weak passwords', async () => {
      const weakPasswords = ['123456', 'password', 'qwerty', 'abc123'];
      
      for (const password of weakPasswords) {
        await expect(
          authService.register({
            email: 'test@example.com',
            password,
            name: 'Test User'
          })
        ).rejects.toThrow(ValidationError);
      }
    });

    it('should implement account lockout after failed attempts', async () => {
      const email = 'test@example.com';
      
      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login(email, 'wrongpassword')
        ).rejects.toThrow(AuthenticationError);
      }
      
      // 6th attempt should result in account lockout
      await expect(
        authService.login(email, 'wrongpassword')
      ).rejects.toThrow('Account temporarily locked');
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent XSS in workflow names', async () => {
      const maliciousNames = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        'onload="alert(\'xss\')"'
      ];
      
      for (const name of maliciousNames) {
        await expect(
          workflowService.create({ name, steps: [] })
        ).rejects.toThrow(ValidationError);
      }
    });

    it('should prevent prototype pollution', async () => {
      const maliciousPayload = {
        name: 'Test Workflow',
        '__proto__': { isAdmin: true },
        steps: []
      };
      
      await expect(
        workflowService.create(maliciousPayload)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Authorization Security', () => {
    it('should prevent privilege escalation', async () => {
      const regularUser = await createTestUser({ role: 'user' });
      const token = generateTestToken(regularUser);
      
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@example.com', role: 'admin' })
        .expect(403);
      
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});
```

## Security Monitoring

### Real-time Security Monitoring
```typescript
// Security monitoring service
export class SecurityMonitor {
  private auditLogger: AuditLogger;
  private alertService: AlertService;
  
  constructor(auditLogger: AuditLogger, alertService: AlertService) {
    this.auditLogger = auditLogger;
    this.alertService = alertService;
  }

  async monitorFailedLogins(userId: string, ip: string): Promise<void> {
    const key = `failed_logins:${ip}:${userId}`;
    const count = await redis.incr(key);
    await redis.expire(key, 900); // 15 minutes
    
    if (count >= 5) {
      await this.alertService.sendSecurityAlert({
        type: 'BRUTE_FORCE_ATTEMPT',
        severity: 'HIGH',
        details: { userId, ip, attemptCount: count }
      });
      
      this.auditLogger.logSecurityIncident({
        severity: 'HIGH',
        category: 'BRUTE_FORCE',
        description: `Multiple failed login attempts detected`,
        userId,
        ip,
        additionalData: { attemptCount: count }
      });
    }
  }

  async detectAnomalousActivity(userId: string, activity: UserActivity): Promise<void> {
    // Check for unusual patterns
    const patterns = await this.analyzeUserPatterns(userId, activity);
    
    if (patterns.isAnomalous) {
      this.auditLogger.logSecurityIncident({
        severity: 'MEDIUM',
        category: 'OTHER',
        description: 'Anomalous user activity detected',
        userId,
        ip: activity.ip,
        additionalData: { patterns, activity }
      });
    }
  }

  private async analyzeUserPatterns(userId: string, activity: UserActivity): Promise<any> {
    // Implement anomaly detection logic
    // Check for unusual login times, locations, etc.
    return { isAnomalous: false };
  }
}
```

## File References

#[[file:../../services/src/shared/middleware/auth.ts]]
#[[file:../../services/src/shared/utils/encryption.ts]]
#[[file:../../services/src/shared/utils/validation.ts]]
#[[file:../../testing/security/owasp-zap-tests.py]]