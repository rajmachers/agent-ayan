/**
 * Authentication middleware for Playbook & Audit Service
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from './error-handler';
import { logger } from '../utils/logger';
import { config } from '../config';

// Extend Express Request type to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

// Mock JWT verification - in production, use proper JWT library and verification
const verifyToken = (token: string): any => {
  try {
    // This is a mock implementation
    // In production, use jsonwebtoken library to verify tokens
    if (token === 'invalid') {
      throw new Error('Invalid token');
    }
    
    // Mock user data
    return {
      id: 'user123',
      tenantId: 'tenant123',
      role: 'admin',
      permissions: ['read:recordings', 'write:recordings', 'admin:audit']
    };
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
};

// Extract token from Authorization header
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  
  return null;
};

// Main authentication middleware
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Skip authentication for health checks
    if (req.path.startsWith('/health')) {
      return next();
    }
    
    // Extract token
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication token required');
    }
    
    // Verify token
    const user = verifyToken(token);
    if (!user) {
      throw new UnauthorizedError('Invalid authentication token');
    }
    
    // Attach user to request
    req.user = user;
    
    logger.debug('User authenticated:', {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

// Permission checking middleware factory
export const requirePermissions = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      
      const userPermissions = req.user.permissions || [];
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission) || req.user?.role === 'admin'
      );
      
      if (!hasAllPermissions) {
        throw new ForbiddenError(
          `Insufficient permissions. Required: ${permissions.join(', ')}`
        );
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Role-based access control middleware
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      
      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Insufficient role. Required: ${roles.join(', ')}, Current: ${req.user.role}`
        );
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Tenant isolation middleware
export const requireTenantAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    
    // Get tenant ID from request parameters or route
    const requestedTenantId = req.params.tenantId || req.query.tenantId;
    
    // Admin role can access any tenant
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Regular users can only access their own tenant
    if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
      throw new ForbiddenError('Access denied to this tenant');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication (for public endpoints with optional user context)
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const user = verifyToken(token);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};