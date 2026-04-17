import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Log request start
  logger.debug('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(this: Response, chunk?: any, encoding?: any, cb?: any): Response {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0,
    });
    
    return originalEnd(chunk, encoding, cb) as Response;
  };

  next();
};