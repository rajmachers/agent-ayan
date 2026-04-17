/**
 * Rate limiting middleware using Redis
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { config } from '../config';
import { RateLimitError } from './error-handler';

class RateLimiter {
  private redisClient: RedisClientType | null = null;
  private isConnected = false;

  async initialize(): Promise<void> {
    try {
      this.redisClient = createClient({ url: config.redisUrl });
      
      this.redisClient.on('error', (error) => {
        logger.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('Rate limiter Redis connection failed, falling back to memory:', error);
      // Fallback to in-memory rate limiting
    }
  }

  async checkLimit(
    identifier: string,
    windowMs: number = config.rateLimitWindowMs,
    maxRequests: number = config.rateLimitMaxRequests
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `rate_limit:${identifier}`;

    try {
      if (this.redisClient && this.isConnected) {
        // Redis-based rate limiting (sliding window)
        const multi = this.redisClient.multi();
        
        // Remove expired entries
        multi.zRemRangeByScore(key, '-inf', windowStart);
        
        // Add current request
        multi.zAdd(key, { score: now, value: now.toString() });
        
        // Count requests in window
        multi.zCard(key);
        
        // Set expiration
        multi.expire(key, Math.ceil(windowMs / 1000));
        
        const results = await multi.exec();
        const requestCount = results ? results[2] as number : maxRequests;
        
        const allowed = requestCount <= maxRequests;
        const remaining = Math.max(0, maxRequests - requestCount);
        const resetTime = now + windowMs;
        
        return { allowed, remaining, resetTime };
      } else {
        // Fallback to memory-based rate limiting
        return this.memoryBasedRateLimit(identifier, windowMs, maxRequests);
      }
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Allow request on error to avoid blocking legitimate users
      return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
    }
  }

  private memoryBasedRateLimit(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    // Simple in-memory rate limiting (not persistent across restarts)
    // This is a basic implementation - in production, consider using a more robust solution
    const now = Date.now();
    
    if (!this.memoryStore) {
      this.memoryStore = new Map();
    }

    const record = this.memoryStore.get(identifier) || { requests: [], resetTime: now + windowMs };
    
    // Remove expired requests
    record.requests = record.requests.filter((time: number) => time > now - windowMs);
    
    // Add current request
    record.requests.push(now);
    
    // Update reset time if needed
    if (record.resetTime <= now) {
      record.resetTime = now + windowMs;
    }
    
    // Update store
    this.memoryStore.set(identifier, record);
    
    const allowed = record.requests.length <= maxRequests;
    const remaining = Math.max(0, maxRequests - record.requests.length);
    
    return { allowed, remaining, resetTime: record.resetTime };
  }

  private memoryStore?: Map<string, any>;

  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.disconnect();
      this.isConnected = false;
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Initialize rate limiter
rateLimiter.initialize().catch((error) => {
  logger.warn('Failed to initialize rate limiter:', error);
});

// Rate limiting middleware
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Generate identifier based on IP and optionally user ID
    const identifier = req.ip || 'unknown';
    
    const { allowed, remaining, resetTime } = await rateLimiter.checkLimit(identifier);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.rateLimitMaxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    });
    
    if (!allowed) {
      throw new RateLimitError('Rate limit exceeded');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Export rate limiter for use in routes
export { rateLimiter };

// Cleanup on process exit
process.on('SIGTERM', () => rateLimiter.close());
process.on('SIGINT', () => rateLimiter.close());