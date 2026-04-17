import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const correlationId = uuidv4();
  
  // Add correlation ID to request for downstream use
  (req as any).correlationId = correlationId;
  
  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Get user context if available
  const user = (req as AuthenticatedRequest).user;
  
  // Log request start
  logger.info('HTTP Request Started', {
    correlationId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    user: user ? {
      id: user.id,
      orgId: user.orgId,
      roles: user.roles,
      isSuperAdmin: user.isSuperAdmin,
    } : null,
  });
  
  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('HTTP Request Completed', {
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0,
      user: user ? {
        id: user.id,
        orgId: user.orgId,
      } : null,
    });
    
    return originalJson(body);
  };
  
  // Override res.end to log response without JSON
  const originalEnd = res.end.bind(res);
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    // Only log if json wasn't called (to avoid double logging)
    if (res.json === originalJson) {
      logger.info('HTTP Request Completed', {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length') || 0,
        user: user ? {
          id: user.id,
          orgId: user.orgId,
        } : null,
      });
    }
    
    return originalEnd(...args);
  };
  
  next();
}

/**
 * Middleware to add request timing
 */
export function requestTiming(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = process.hrtime();
  
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1e6; // Convert to milliseconds
    
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  
  next();
}

/**
 * Middleware to log slow requests
 */
export function slowRequestLogger(thresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > thresholdMs) {
        const user = (req as AuthenticatedRequest).user;
        
        logger.warn('Slow request detected', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          threshold: `${thresholdMs}ms`,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          user: user ? {
            id: user.id,
            orgId: user.orgId,
          } : null,
        });
      }
    });
    
    next();
  };
}