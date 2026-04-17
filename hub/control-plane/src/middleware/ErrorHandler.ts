import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/Logger';

const logger = Logger.getInstance();

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function ErrorHandler(error: ApiError, req: Request, res: Response, next: NextFunction): void {
  // Log the error
  logger.error('API Error:', {
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || 'INTERNAL_ERROR';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized access';
    code = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Access forbidden';
    code = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Resource conflict';
    code = 'CONFLICT';
  }

  // Database connection errors
  if (error.message.includes('connect ECONNREFUSED') || error.message.includes('database')) {
    statusCode = 503;
    message = 'Database service unavailable';
    code = 'DATABASE_ERROR';
  }

  // Redis connection errors
  if (error.message.includes('Redis') || error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Cache service unavailable';
    code = 'CACHE_ERROR';
  }

  // Rate limiting errors
  if (error.message.includes('Too Many Requests')) {
    statusCode = 429;
    message = 'Rate limit exceeded';
    code = 'RATE_LIMIT_ERROR';
  }

  // Construct error response
  const errorResponse: any = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  };

  // Include details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      stack: error.stack,
      originalMessage: error.message
    };
  }

  // Include validation details if available
  if (error.details) {
    errorResponse.error.details = error.details;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = 'FORBIDDEN';
  
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends Error {
  statusCode = 503;
  code = 'DATABASE_ERROR';
  
  constructor(message: string = 'Database service unavailable') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class CacheError extends Error {
  statusCode = 503;
  code = 'CACHE_ERROR';
  
  constructor(message: string = 'Cache service unavailable') {
    super(message);
    this.name = 'CacheError';
  }
}