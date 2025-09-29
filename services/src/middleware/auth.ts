import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { AuditLogger } from '../utils/auditLogger';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

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
  
  // AI Provider permissions
  AI_PROVIDER_SWITCH = 'ai:provider:switch',
  AI_PROVIDER_CONFIG = 'ai:provider:config',
  
  // System administration
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_BACKUP = 'system:backup'
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.WORKFLOW_CREATE, Permission.WORKFLOW_READ, Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_DELETE, Permission.WORKFLOW_EXECUTE,
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE,
    Permission.AI_PROVIDER_SWITCH, Permission.AI_PROVIDER_CONFIG,
    Permission.SYSTEM_CONFIG, Permission.SYSTEM_MONITOR, Permission.SYSTEM_BACKUP
  ],
  [UserRole.MANAGER]: [
    Permission.WORKFLOW_CREATE, Permission.WORKFLOW_READ, Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_EXECUTE, Permission.USER_READ, Permission.AI_PROVIDER_SWITCH,
    Permission.SYSTEM_MONITOR
  ],
  [UserRole.USER]: [
    Permission.WORKFLOW_CREATE, Permission.WORKFLOW_READ, Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_EXECUTE
  ],
  [UserRole.VIEWER]: [
    Permission.WORKFLOW_READ
  ]
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

class JWTService {
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

  verifyToken(token: string): AuthenticatedUser {
    try {
      return jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      }) as AuthenticatedUser;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  generateToken(user: { id: string; email: string; role: UserRole }): string {
    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      iss: this.issuer,
      aud: this.audience
    };

    return jwt.sign(payload, this.secret, { algorithm: 'HS256' });
  }
}

const jwtService = new JWTService();
const auditLogger = new AuditLogger();

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const auth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      auditLogger.logAuthenticationEvent({
        type: 'LOGIN',
        email: 'unknown',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false
      });

      return res.status(401).json({
        success: false,
        error: { 
          code: 'MISSING_TOKEN', 
          message: 'Access token required' 
        }
      });
    }

    try {
      const decoded = jwtService.verifyToken(token);
      req.user = decoded;
      
      auditLogger.logAuthenticationEvent({
        type: 'LOGIN',
        userId: decoded.id,
        email: decoded.email,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: true
      });

      next();
    } catch (error) {
      auditLogger.logAuthenticationEvent({
        type: 'LOGIN',
        email: 'unknown',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false
      });

      return res.status(403).json({
        success: false,
        error: { 
          code: 'INVALID_TOKEN', 
          message: 'Invalid or expired token' 
        }
      });
    }
  } catch (error) {
    auditLogger.logSecurityIncident({
      severity: 'MEDIUM',
      category: 'OTHER',
      description: 'Authentication middleware error',
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      additionalData: { error: error instanceof Error ? error.message : 'Unknown error' }
    });

    return res.status(500).json({
      success: false,
      error: { 
        code: 'AUTH_ERROR', 
        message: 'Authentication error' 
      }
    });
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    if (!roles.includes(user.role)) {
      auditLogger.logAuthorizationEvent({
        userId: user.id,
        resource: req.path,
        action: req.method,
        granted: false,
        ip: req.ip || 'unknown'
      });

      return res.status(403).json({
        success: false,
        error: { 
          code: 'INSUFFICIENT_PERMISSIONS', 
          message: 'Access denied' 
        }
      });
    }

    auditLogger.logAuthorizationEvent({
      userId: user.id,
      resource: req.path,
      action: req.method,
      granted: true,
      ip: req.ip || 'unknown'
    });

    next();
  };
};

export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const userPermissions = RolePermissions[user.role] || [];
    
    if (!userPermissions.includes(permission)) {
      auditLogger.logAuthorizationEvent({
        userId: user.id,
        resource: req.path,
        action: req.method,
        granted: false,
        ip: req.ip || 'unknown'
      });

      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }

    auditLogger.logAuthorizationEvent({
      userId: user.id,
      resource: req.path,
      action: req.method,
      granted: true,
      ip: req.ip || 'unknown'
    });

    next();
  };
};

export { jwtService };