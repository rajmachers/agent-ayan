import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../utils/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';

// Rate limiter configuration
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ayan_rate_limit',
  points: config.rateLimit.maxRequests, // Number of requests
  duration: Math.floor(config.rateLimit.windowMs / 1000), // Per window in seconds
  blockDuration: 60, // Block for 1 minute if limit exceeded
});

// More strict rate limiting for unauthenticated requests
const unauthenticatedRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ayan_rate_limit_unauth',
  points: 100, // Lower limit for unauthenticated
  duration: 900, // 15 minutes
  blockDuration: 300, // Block for 5 minutes
});

// Super admin rate limiter (more generous)
const superAdminRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ayan_rate_limit_admin',
  points: config.rateLimit.maxRequests * 5, // 5x more requests
  duration: Math.floor(config.rateLimit.windowMs / 1000),
  blockDuration: 30, // Shorter block time
});

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Determine rate limiter and key based on authentication status
    let limiter = rateLimiter;
    let key = clientIp;
    
    if (user) {
      // Authenticated user - use user ID as key
      key = `user:${user.id}`;
      
      // Super admin gets higher limits
      if (user.isSuperAdmin) {
        limiter = superAdminRateLimiter;
      }
    } else {
      // Unauthenticated - use IP with stricter limits
      limiter = unauthenticatedRateLimiter;
      key = `ip:${clientIp}`;
    }
    
    // Apply rate limiting
    const rateLimitResult = await limiter.consume(key);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter.points);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remainingPoints || 0);
    res.setHeader('X-RateLimit-Reset', Math.floor((Date.now() + rateLimitResult.msBeforeNext) / 1000));
    
    next();
  } catch (rateLimitError) {
    // Rate limit exceeded
    const user = (req as AuthenticatedRequest).user;
    
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      user: user ? {
        id: user.id,
        orgId: user.orgId,
        isSuperAdmin: user.isSuperAdmin,
      } : null,
      endpoint: `${req.method} ${req.path}`,
    });
    
    // Return rate limit error
    if (rateLimitError instanceof Error) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.round((rateLimitError as any).msBeforeNext / 1000) || 60,
        timestamp: new Date().toISOString(),
      });
    } else {
      // rateLimitError contains rate limit info
      const msBeforeNext = rateLimitError.msBeforeNext || 60000;
      
      res.setHeader('Retry-After', Math.round(msBeforeNext / 1000));
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.round(msBeforeNext / 1000),
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Endpoint-specific rate limiting
 */
export function createEndpointRateLimiter(options: {
  points: number;
  duration: number;
  keyPrefix: string;
}) {
  const endpointLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: options.keyPrefix,
    points: options.points,
    duration: options.duration,
    blockDuration: options.duration,
  });
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const key = user ? `user:${user.id}` : `ip:${req.ip}`;
      
      await endpointLimiter.consume(key);
      next();
    } catch (rateLimitError) {
      logger.warn('Endpoint rate limit exceeded', {
        endpoint: options.keyPrefix,
        ip: req.ip,
        user: user ? user.id : null,
      });
      
      const msBeforeNext = (rateLimitError as any).msBeforeNext || options.duration * 1000;
      
      res.setHeader('Retry-After', Math.round(msBeforeNext / 1000));
      res.status(429).json({
        error: 'Endpoint rate limit exceeded',
        code: 'ENDPOINT_RATE_LIMIT_EXCEEDED',
        message: `Too many requests to this endpoint`,
        retryAfter: Math.round(msBeforeNext / 1000),
        timestamp: new Date().toISOString(),
      });
    }
  };
}