import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? (error as any).path : 'unknown',
          message: error.msg,
          value: error.type === 'field' ? (error as any).value : undefined
        }))
      }
    });
  }
  
  next();
};