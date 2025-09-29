import crypto from 'crypto';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class ValidationService {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string');
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .substring(0, maxLength);
  }

  static validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validateWorkflowName(name: string): void {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Workflow name is required', 'name');
    }

    if (name.length > 100) {
      throw new ValidationError('Workflow name must be 100 characters or less', 'name');
    }

    // Check for potentially malicious patterns
    const maliciousPatterns = [
      /<script/i, /javascript:/i, /on\w+=/i, /data:/i, /vbscript:/i,
      /<iframe/i, /<object/i, /<embed/i, /<link/i, /<meta/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(name)) {
        throw new ValidationError('Workflow name contains invalid characters', 'name');
      }
    }
  }

  static validateJSON(jsonString: string): any {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new ValidationError('Invalid JSON input');
    }

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

  static validatePrompt(prompt: string): void {
    if (!prompt || typeof prompt !== 'string') {
      throw new ValidationError('Prompt is required', 'prompt');
    }

    if (prompt.length > 10000) {
      throw new ValidationError('Prompt is too long (max 10000 characters)', 'prompt');
    }

    // Check for potential injection attempts
    const suspiciousPatterns = [
      /system\s*:/i,
      /ignore\s+previous\s+instructions/i,
      /forget\s+everything/i,
      /act\s+as\s+if/i,
      /pretend\s+to\s+be/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(prompt)) {
        throw new ValidationError('Prompt contains potentially harmful content', 'prompt');
      }
    }
  }

  static validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic API key format validation
    return apiKey.length >= 20 && /^[A-Za-z0-9\-_]+$/.test(apiKey);
  }

  static validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  private static hasPrototypePollution(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return true;
      }
      
      if (typeof obj[key] === 'object' && this.hasPrototypePollution(obj[key])) {
        return true;
      }
    }
    
    return false;
  }

  static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  static generateSecureId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}

export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;
  private static readonly PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

  static validatePassword(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required', 'password');
    }

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new ValidationError('Password must be at least 8 characters long', 'password');
    }

    if (!this.PASSWORD_REGEX.test(password)) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'password'
      );
    }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      throw new ValidationError('Password is too common, please choose a stronger password', 'password');
    }
  }

  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890', '12345678',
      'abc123', 'Password1', 'password1', '123456789'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }
}