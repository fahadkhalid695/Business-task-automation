import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../shared/utils/logger';
import { generateRequestId } from '../../shared/utils/auth';

const logger = new Logger('RequestLogger');

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Add request ID to headers
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentLength: req.get('Content-Length') || 0
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    });
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};