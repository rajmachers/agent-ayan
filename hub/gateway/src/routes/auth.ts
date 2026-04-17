import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { executeQuery } from '../utils/database';
import { cache } from '../utils/redis';
import { asyncHandler, createApiError } from '../middleware/error';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Get current user profile
 * GET /api/v1/auth/profile
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  // Get organization details if user is not super admin
  let organization = null;
  if (user.orgId && !user.isSuperAdmin) {
    const orgResult = await executeQuery(
      'SELECT id, name, slug, theme FROM organisations WHERE id = $1',
      [user.orgId],
      user.orgId,
      user.isSuperAdmin
    );
    
    if (orgResult.rows.length > 0) {
      organization = orgResult.rows[0];
    }
  }
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles,
      isSuperAdmin: user.isSuperAdmin,
      issuer: user.issuer,
    },
    organization,
    permissions: {
      canAccessAdminDashboard: user.roles.includes('admin') || user.isSuperAdmin,
      canManageExams: user.roles.includes('examiner') || user.roles.includes('admin') || user.isSuperAdmin,
      canViewSessions: user.roles.includes('proctor') || user.roles.includes('admin') || user.isSuperAdmin,
      canProctorLive: user.roles.includes('proctor') || user.isSuperAdmin,
    }
  });
}));

/**
 * Generate internal JWT token (for development/testing)
 * POST /api/v1/auth/token
 */
router.post('/token', asyncHandler(async (req, res) => {
  if (config.environment === 'production') {
    throw createApiError('Token generation not available in production', 403, 'TOKEN_GENERATION_DISABLED');
  }
  
  const { 
    userId = 'dev-user',
    orgId,
    roles = ['viewer'],
    isSuperAdmin = false,
    email = 'dev@example.com'
  } = req.body;
  
  // Validate required fields for non-super admin
  if (!isSuperAdmin && !orgId) {
    throw createApiError('orgId is required for non-super admin users', 400, 'ORG_ID_REQUIRED');
  }
  
  const payload = {
    sub: userId,
    email,
    org_id: orgId,
    roles: Array.isArray(roles) ? roles : [roles],
    is_super_admin: isSuperAdmin,
    iss: config.jwt.issuer,
    aud: config.jwt.audience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };
  
  const token = jwt.sign(payload, config.jwt.secret!, {
    algorithm: config.jwt.algorithm,
  });
  
  res.json({
    token,
    type: 'Bearer',
    expiresIn: 24 * 60 * 60,
    user: {
      id: userId,
      email,
      orgId,
      roles: payload.roles,
      isSuperAdmin,
    }
  });
}));

/**
 * Refresh token endpoint
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  // Check if token is close to expiry (within 1 hour)
  const currentTime = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = (user.exp || 0) - currentTime;
  
  if (timeUntilExpiry > 3600) { // More than 1 hour remaining
    throw createApiError('Token refresh not needed yet', 400, 'REFRESH_NOT_NEEDED');
  }
  
  // For external tokens, we cannot refresh them here
  if (user.issuer !== config.jwt.issuer) {
    throw createApiError('External tokens must be refreshed by their issuer', 400, 'EXTERNAL_TOKEN_REFRESH');
  }
  
  // Generate new token with same claims
  const payload = {
    sub: user.id,
    email: user.email,
    org_id: user.orgId,
    roles: user.roles,
    is_super_admin: user.isSuperAdmin,
    iss: config.jwt.issuer,
    aud: config.jwt.audience,
    iat: currentTime,
    exp: currentTime + (24 * 60 * 60), // 24 hours
  };
  
  const token = jwt.sign(payload, config.jwt.secret!, {
    algorithm: config.jwt.algorithm,
  });
  
  res.json({
    token,
    type: 'Bearer',
    expiresIn: 24 * 60 * 60,
  });
}));

/**
 * Validate token endpoint
 * POST /api/v1/auth/validate
 */
router.post('/validate', asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  res.json({
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      roles: user.roles,
      isSuperAdmin: user.isSuperAdmin,
      issuer: user.issuer,
    },
    expiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null,
  });
}));

/**
 * Logout endpoint (blacklist token if internal)
 * POST /api/v1/auth/logout
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  // For internal tokens, add to blacklist
  if (user.issuer === config.jwt.issuer && user.exp) {
    const tokenId = `${user.id}:${user.iat}`;
    const ttl = user.exp - Math.floor(Date.now() / 1000);
    
    if (ttl > 0) {
      await cache.set(`blacklist:${tokenId}`, 'true', ttl);
    }
  }
  
  logger.info('User logged out', {
    userId: user.id,
    orgId: user.orgId,
    issuer: user.issuer,
  });
  
  res.json({
    message: 'Logged out successfully'
  });
}));

export { router as authRoutes };