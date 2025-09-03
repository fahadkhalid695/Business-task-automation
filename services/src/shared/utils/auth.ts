import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserDocument } from '../models/User';
import { Permission } from '../types';
import { AuthenticationError, AuthorizationError } from './errors';
import { Logger } from './logger';

const logger = new Logger('Auth');

export interface AuthRequest extends Request {
  user?: UserDocument;
  requestId?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: Permission[];
  iat: number;
  exp: number;
}

export const generateToken = (user: UserDocument): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  };

  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // In a real application, you might want to fetch the user from database
    // to ensure they still exist and are active
    const { UserModel } = await import('../models/User');
    const user = await UserModel.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    req.user = user;
    req.requestId = generateRequestId();
    
    logger.info('User authenticated', { 
      userId: user.id, 
      email: user.email,
      requestId: req.requestId 
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (requiredPermissions: Permission | Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      const hasPermission = permissions.every(permission => 
        req.user!.hasPermission(permission)
      );

      if (!hasPermission) {
        logger.warn('Access denied', { 
          userId: req.user.id,
          requiredPermissions: permissions,
          userPermissions: req.user.permissions,
          requestId: req.requestId
        });
        throw new AuthorizationError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const authorizeRole = (allowedRoles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      if (!roles.includes(req.user.role)) {
        logger.warn('Role access denied', { 
          userId: req.user.id,
          userRole: req.user.role,
          allowedRoles: roles,
          requestId: req.requestId
        });
        throw new AuthorizationError('Insufficient role permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const generateRequestId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

export const hashPassword = async (password: string): Promise<string> => {
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
};

// Rate limiting helper
export const createRateLimiter = (windowMs: number, max: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < windowStart) {
        requests.delete(ip);
      }
    }
    
    const current = requests.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (current.count >= max && current.resetTime > now) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          timestamp: new Date(),
          requestId: generateRequestId()
        }
      });
    }
    
    current.count++;
    requests.set(key, current);
    
    next();
  };
};