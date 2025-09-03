import { Request, Response, NextFunction } from 'express';
import { AppError, createApiError } from '../../shared/utils/errors';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('ErrorHandler');

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  
  // Log the error
  logger.error('Request error', error, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Create API error response
  const apiError = createApiError(error, requestId);
  
  // Determine status code
  let statusCode = 500;
  if (error instanceof AppError) {
    statusCode = error.statusCode;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'CastError') {
    statusCode = 400;
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = 409;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: apiError,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack
    })
  });
};