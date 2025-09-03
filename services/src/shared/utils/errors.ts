import { ApiError } from '../types';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export const createApiError = (error: Error, requestId: string): ApiError => {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      timestamp: new Date(),
      requestId
    };
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
      timestamp: new Date(),
      requestId
    };
  }

  if (error.name === 'CastError') {
    return {
      code: 'INVALID_ID',
      message: 'Invalid ID format',
      timestamp: new Date(),
      requestId
    };
  }

  if (error.name === 'MongoError' && (error as any).code === 11000) {
    return {
      code: 'DUPLICATE_ENTRY',
      message: 'Duplicate entry found',
      timestamp: new Date(),
      requestId
    };
  }

  // Default error
  return {
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    timestamp: new Date(),
    requestId
  };
};

export const handleAsyncError = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};