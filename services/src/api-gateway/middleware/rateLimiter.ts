import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../../shared/utils/errors';

interface RateLimitData {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests = new Map<string, RateLimitData>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) { // 15 minutes, 100 requests
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (data.resetTime < now) {
        this.requests.delete(key);
      }
    }
  }

  private getKey(req: Request): string {
    // Use IP address as the key, but could be enhanced with user ID for authenticated requests
    return req.ip || 'unknown';
  }

  public middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = this.getKey(req);
    const now = Date.now();
    
    let rateLimitData = this.requests.get(key);
    
    if (!rateLimitData || rateLimitData.resetTime < now) {
      // First request or window has reset
      rateLimitData = {
        count: 1,
        resetTime: now + this.windowMs
      };
    } else {
      // Increment count
      rateLimitData.count++;
    }
    
    this.requests.set(key, rateLimitData);
    
    // Set rate limit headers
    const remaining = Math.max(0, this.maxRequests - rateLimitData.count);
    const resetTime = Math.ceil(rateLimitData.resetTime / 1000);
    
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);
    
    if (rateLimitData.count > this.maxRequests) {
      throw new RateLimitError(`Rate limit exceeded. Try again in ${Math.ceil((rateLimitData.resetTime - now) / 1000)} seconds`);
    }
    
    next();
  };
}

// Create different rate limiters for different endpoints
const generalLimiter = new RateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
const authLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 auth attempts per 15 minutes
const apiLimiter = new RateLimiter(60 * 1000, 60); // 60 requests per minute for API calls

export const rateLimiter = generalLimiter.middleware;

export const createRateLimiter = (windowMs: number, maxRequests: number) => {
  return new RateLimiter(windowMs, maxRequests).middleware;
};

// Specific limiters for different routes
export const authRateLimiter = authLimiter.middleware;
export const apiRateLimiter = apiLimiter.middleware;