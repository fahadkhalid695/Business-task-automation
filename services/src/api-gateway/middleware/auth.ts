import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel as User } from '../../shared/models/User';
import { createError } from '../../shared/middleware/errorHandler';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('AuthMiddleware');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('Access token required', 401, 'MISSING_TOKEN');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw createError('Access token required', 401, 'MISSING_TOKEN');
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable not set');
      throw createError('Authentication configuration error', 500, 'CONFIG_ERROR');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (!decoded.userId) {
      throw createError('Invalid token format', 401, 'INVALID_TOKEN');
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw createError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw createError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      permissions: user.permissions || []
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: error.message });
      next(createError('Invalid token', 401, 'INVALID_TOKEN'));
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token');
      next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else {
      logger.error('Authentication error', error);
      next(error);
    }
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      logger.warn('Insufficient role', { 
        userId: req.user.id, 
        userRole: req.user.role, 
        requiredRole 
      });
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_ROLE'));
    }

    next();
  };
};

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (requiredPermission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
    }

    // Admin role has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      logger.warn('Insufficient permissions', { 
        userId: req.user.id, 
        userPermissions: req.user.permissions, 
        requiredPermission 
      });
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSION'));
    }

    next();
  };
};

/**
 * Middleware to check if user has any of the required permissions
 */
export const requireAnyPermission = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
    }

    // Admin role has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    const hasPermission = requiredPermissions.some(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Insufficient permissions', { 
        userId: req.user.id, 
        userPermissions: req.user.permissions, 
        requiredPermissions 
      });
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSION'));
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Continue without authentication
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(); // Continue without authentication
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          permissions: user.permissions || []
        };
      }
    }

    next();
  } catch (error) {
    // Log error but continue without authentication
    logger.debug('Optional auth failed', error);
    next();
  }
};