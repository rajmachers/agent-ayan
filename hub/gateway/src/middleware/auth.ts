import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';

// Extended Request interface to include user context
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
    orgId?: string;
    orgSlug?: string;
    roles: string[];
    isSuperAdmin: boolean;
    issuer: string;
    candidateId?: string;
    examId?: string;
    sessionId?: string;
    aud?: string;
    exp?: number;
    iat?: number;
    sub?: string;
  };
}

// JWKS client for external issuers
const jwksClients = new Map<string, any>();

// Initialize JWKS clients for trusted issuers
config.jwks.trustedIssuers.forEach((issuerUrl: string) => {
  if (issuerUrl) {
    try {
      const jwksUri = `${issuerUrl}/.well-known/jwks.json`;
      jwksClients.set(issuerUrl, jwksClient({
        jwksUri,
        requestHeaders: {},
        timeout: 30000,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 3600000, // 1 hour
      }));
      logger.info('Initialized JWKS client for issuer', { issuer: issuerUrl, jwksUri });
    } catch (error) {
      logger.error('Failed to initialize JWKS client', { issuer: issuerUrl, error });
    }
  }
});

/**
 * Get signing key for external JWT validation
 */
async function getSigningKey(issuer: string, kid: string): Promise<string> {
  const cacheKey = `jwks:${issuer}:${kid}`;
  
  // Try cache first
  const cachedKey = await cache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }
  
  const client = jwksClients.get(issuer);
  if (!client) {
    throw new Error(`No JWKS client configured for issuer: ${issuer}`);
  }
  
  try {
    const signingKey = await client.getSigningKey(kid);
    const publicKey = signingKey.getPublicKey();
    
    // Cache the key for 1 hour
    await cache.set(cacheKey, publicKey, 3600);
    
    return publicKey;
  } catch (error) {
    logger.error('Failed to get signing key', { issuer, kid, error });
    throw new Error('Unable to retrieve signing key');
  }
}

/**
 * Validate JWT token and extract claims
 */
async function validateAndDecodeToken(token: string): Promise<any> {
  // Decode token header to get issuer and kid
  const decodedHeader = jwt.decode(token, { complete: true });
  
  if (!decodedHeader || typeof decodedHeader === 'string') {
    throw new Error('Invalid JWT token format');
  }
  
  const { header, payload } = decodedHeader;
  
  if (!payload || typeof payload === 'string') {
    throw new Error('Invalid JWT payload');
  }
  
  const issuer = payload.iss;
  const audience = payload.aud;
  
  // Check if this is an internal Ayan.ai token
  if (issuer === config.jwt.issuer || !issuer) {
    // Internal token validation
    if (!config.jwt.secret) {
      throw new Error('JWT secret not configured for internal tokens');
    }
    
    return jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithms: [config.jwt.algorithm],
    });
  }
  
  // External token validation
  if (!config.jwks.trustedIssuers.includes(issuer)) {
    throw new Error(`Untrusted issuer: ${issuer}`);
  }
  
  const kid = header.kid;
  if (!kid) {
    throw new Error('Missing kid in JWT header');
  }
  
  const signingKey = await getSigningKey(issuer, kid);
  
  return jwt.verify(token, signingKey, {
    issuer,
    algorithms: ['RS256', 'ES256'], // Common algorithms for external tokens
  });
}

/**
 * Extract user context from JWT claims
 */
function extractUserContext(payload: any): AuthenticatedRequest['user'] {
  // Handle different claim structures based on issuer
  const issuer = payload.iss;
  
  // Internal Ayan.ai tokens
  if (issuer === config.jwt.issuer || !issuer) {
    return {
      id: payload.sub || payload.user_id || payload.id,
      email: payload.email,
      orgId: payload.org_id,
      orgSlug: payload.org_slug,
      roles: payload.roles || [],
      isSuperAdmin: payload.is_super_admin === true || payload.roles?.includes('super-admin'),
      issuer: issuer || config.jwt.issuer,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      sub: payload.sub,
    };
  }
  
  // External tokens (TAO, LMS, etc.)
  // Map external claims to our internal structure
  const roles = payload.roles || payload['custom:roles'] || [];
  const orgId = payload.org_id || payload['custom:org_id'] || payload.organization_id;
  const orgSlug = payload.org_slug || payload['custom:org_slug'] || payload.organization_slug;
  
  return {
    id: payload.sub || payload.user_id || payload.candidate_id,
    email: payload.email || payload.preferred_username,
    orgId,
    orgSlug,
    candidateId: payload.candidate_id || payload['custom:candidate_id'],
    examId: payload.exam_id || payload['custom:exam_id'],
    sessionId: payload.session_id || payload['custom:session_id'],
    roles: Array.isArray(roles) ? roles : [roles].filter(Boolean),
    isSuperAdmin: false, // External tokens cannot be super admin
    issuer,
    aud: payload.aud,
    exp: payload.exp,
    iat: payload.iat,
    sub: payload.sub,
  };
}

/**
 * JWT Authentication Middleware
 */
export async function jwtAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authorization header missing or invalid format',
        code: 'AUTH_HEADER_MISSING'
      });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      res.status(401).json({
        error: 'JWT token missing',
        code: 'TOKEN_MISSING'
      });
      return;
    }
    
    // Validate and decode token
    const payload = await validateAndDecodeToken(token);
    
    // Extract user context
    const userContext = extractUserContext(payload);
    
    // Validate required claims
    if (!userContext.id) {
      res.status(401).json({
        error: 'Invalid token: missing user identifier',
        code: 'INVALID_TOKEN_CLAIMS'
      });
      return;
    }
    
    // For non-super admin users, org_id is required (tenant isolation)
    if (!userContext.isSuperAdmin && !userContext.orgId) {
      res.status(401).json({
        error: 'Invalid token: missing organization context',
        code: 'MISSING_ORG_CONTEXT'
      });
      return;
    }
    
    // Attach user context to request
    (req as AuthenticatedRequest).user = userContext;
    
    // Log successful authentication
    logger.debug('JWT authentication successful', {
      userId: userContext.id,
      orgId: userContext.orgId,
      issuer: userContext.issuer,
      roles: userContext.roles,
      isSuperAdmin: userContext.isSuperAdmin,
    });
    
    next();
  } catch (error) {
    logger.warn('JWT authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    
    // Determine appropriate error response
    let errorCode = 'AUTH_FAILED';
    let statusCode = 401;
    
    if (error instanceof jwt.TokenExpiredError) {
      errorCode = 'TOKEN_EXPIRED';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorCode = 'INVALID_TOKEN';
    } else if (error instanceof Error && error.message.includes('Untrusted issuer')) {
      errorCode = 'untrusted_issuer';
      statusCode = 403;
    }
    
    res.status(statusCode).json({
      error: 'Authentication failed',
      code: errorCode,
      message: error instanceof Error ? error.message : 'Unknown authentication error'
    });
  }
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No authentication provided, continue without user context
    next();
    return;
  }
  
  // Attempt authentication, but don't fail if it doesn't work
  try {
    await jwtAuthMiddleware(req, res, next);
  } catch (error) {
    logger.debug('Optional authentication failed, continuing without auth', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next();
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRoles(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }
    
    // Super admin has access to everything
    if (user.isSuperAdmin) {
      next();
      return;
    }
    
    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some(role => user.roles.includes(role));
    
    if (!hasRequiredRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredRoles,
        current: user.roles
      });
      return;
    }
    
    next();
  };
}

/**
 * Super admin only middleware
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user?.isSuperAdmin) {
    res.status(403).json({
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
    return;
  }
  
  next();
}