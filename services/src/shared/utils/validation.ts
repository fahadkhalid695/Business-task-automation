import Joi from 'joi';
import { ApiError } from '../types';

export class ValidationError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateSchema = <T>(schema: Joi.Schema, data: any): T => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }
  
  return value;
};

// Common validation schemas
export const schemas = {
  user: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('admin', 'manager', 'user', 'viewer').required(),
    preferences: Joi.object().optional()
  }),

  task: Joi.object({
    type: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    assignedTo: Joi.string().optional(),
    dueDate: Joi.date().optional(),
    data: Joi.object().required()
  }),

  workflow: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    steps: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      configuration: Joi.object().required(),
      dependencies: Joi.array().items(Joi.string()).default([]),
      order: Joi.number().required()
    })).required(),
    triggers: Joi.array().items(Joi.object({
      type: Joi.string().required(),
      configuration: Joi.object().required()
    })).default([])
  }),

  integration: Joi.object({
    service: Joi.string().required(),
    configuration: Joi.object().required(),
    credentials: Joi.object().optional()
  }),

  pagination: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 1000); // Limit length
};

export const validateObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};