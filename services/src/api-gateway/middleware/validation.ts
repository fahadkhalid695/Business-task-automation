import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createError } from '../../shared/middleware/errorHandler';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('ValidationMiddleware');

/**
 * Middleware to validate request data against Joi schema
 */
export const validateRequest = (schema: Joi.ObjectSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false, // Return all validation errors
        stripUnknown: true, // Remove unknown fields
        convert: true // Convert types when possible
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Validation failed', { 
          target,
          errors: validationErrors,
          originalData: dataToValidate
        });

        const errorMessage = `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`;
        
        return next(createError(errorMessage, 400, 'VALIDATION_ERROR'));
      }

      // Replace the original data with validated and sanitized data
      req[target] = value;
      
      next();
    } catch (err) {
      logger.error('Validation middleware error', err);
      next(createError('Validation error', 500, 'VALIDATION_MIDDLEWARE_ERROR'));
    }
  };
};

/**
 * Validate request body
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return validateRequest(schema, 'body');
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return validateRequest(schema, 'query');
};

/**
 * Validate route parameters
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return validateRequest(schema, 'params');
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format'),
  
  // Pagination parameters
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  // Date range validation
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  }),
  
  // Search parameters
  search: Joi.object({
    q: Joi.string().min(1).max(100).optional(),
    fields: Joi.array().items(Joi.string()).optional()
  }),
  
  // File upload validation
  fileUpload: Joi.object({
    filename: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().integer().max(10 * 1024 * 1024) // 10MB max
  }),
  
  // Email validation
  email: Joi.string().email().lowercase().trim(),
  
  // Password validation
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least 8 characters with uppercase, lowercase, number and special character'),
  
  // URL validation
  url: Joi.string().uri({ scheme: ['http', 'https'] }),
  
  // Phone number validation (basic)
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20),
  
  // Language code validation (ISO 639-1)
  languageCode: Joi.string().length(2).lowercase(),
  
  // Currency code validation (ISO 4217)
  currencyCode: Joi.string().length(3).uppercase(),
  
  // Timezone validation
  timezone: Joi.string().valid(
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland'
  ),
  
  // Priority levels
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
  
  // Status values
  status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled'),
  
  // User roles
  userRole: Joi.string().valid('admin', 'manager', 'user', 'viewer'),
  
  // Task types
  taskType: Joi.string().valid(
    'administrative', 'data_analytics', 'communication', 'project_management',
    'finance_hr', 'creative', 'integration', 'ai_processing'
  )
};

/**
 * Sanitize input data
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Recursively sanitize strings in request body
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.trim();
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error', error);
    next(createError('Input sanitization failed', 500, 'SANITIZATION_ERROR'));
  }
};

/**
 * Validate file upload
 */
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedMimeTypes?: string[];
  required?: boolean;
} = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = [],
    required = false
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const file = req.file;
      
      if (!file && required) {
        return next(createError('File upload is required', 400, 'FILE_REQUIRED'));
      }
      
      if (!file) {
        return next(); // File is optional and not provided
      }

      // Check file size
      if (file.size > maxSize) {
        return next(createError(
          `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`,
          400,
          'FILE_TOO_LARGE'
        ));
      }

      // Check MIME type
      if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
        return next(createError(
          `File type ${file.mimetype} is not allowed`,
          400,
          'INVALID_FILE_TYPE'
        ));
      }

      next();
    } catch (error) {
      logger.error('File validation error', error);
      next(createError('File validation failed', 500, 'FILE_VALIDATION_ERROR'));
    }
  };
};