import { Router } from 'express';
import Joi from 'joi';
import { executeQuery } from '../utils/database';
import { logger } from '../utils/logger';
import { asyncHandler, createApiError } from '../middleware/error';
import { AuthenticatedRequest, requireSuperAdmin, requireRoles } from '../middleware/auth';

const router = Router();

// Validation schemas
const createOrgSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  slug: Joi.string().required().pattern(/^[a-z0-9-]+$/).min(2).max(100),
  external_id: Joi.string().optional(),
  theme: Joi.object().optional(),
  default_rules_config: Joi.object().optional(),
  keycloak_realm: Joi.string().optional(),
});

const updateOrgSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  theme: Joi.object(),
  default_rules_config: Joi.object(),
  keycloak_realm: Joi.string(),
}).min(1);

/**
 * Get all organizations (super admin only)
 * GET /api/v1/organizations
 */
router.get('/', requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  
  // Count total organizations
  const countResult = await executeQuery(
    'SELECT COUNT(*) as total FROM organisations',
    [],
    user.orgId,
    user.isSuperAdmin
  );
  
  const total = parseInt(countResult.rows[0].total);
  
  // Get paginated organizations
  const result = await executeQuery(
    `SELECT 
      id, 
      external_id, 
      name, 
      slug, 
      logo_url, 
      theme, 
      default_rules_config, 
      keycloak_realm,
      created_at, 
      updated_at
    FROM organisations 
    ORDER BY created_at DESC 
    LIMIT $1 OFFSET $2`,
    [limit, offset],
    user.orgId,
    user.isSuperAdmin
  );
  
  res.json({
    organizations: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

/**
 * Get current user's organization
 * GET /api/v1/organizations/current
 */
router.get('/current', asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user.orgId) {
    throw createApiError('No organization associated with user', 404, 'NO_ORGANIZATION');
  }
  
  const result = await executeQuery(
    `SELECT 
      id, 
      external_id, 
      name, 
      slug, 
      logo_url, 
      theme, 
      default_rules_config, 
      created_at, 
      updated_at
    FROM organisations 
    WHERE id = $1`,
    [user.orgId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }
  
  res.json({
    organization: result.rows[0]
  });
}));

/**
 * Get organization by ID
 * GET /api/v1/organizations/:id
 */
router.get('/:id', requireRoles('admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const organizationId = req.params.id;
  
  // Super admin can access any org, others only their own
  if (!user.isSuperAdmin && user.orgId !== organizationId) {
    throw createApiError('Access denied to this organization', 403, 'ACCESS_DENIED');
  }
  
  const result = await executeQuery(
    `SELECT 
      id, 
      external_id, 
      name, 
      slug, 
      logo_url, 
      theme, 
      default_rules_config, 
      keycloak_realm,
      created_at, 
      updated_at
    FROM organisations 
    WHERE id = $1`,
    [organizationId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }
  
  res.json({
    organization: result.rows[0]
  });
}));

/**
 * Create new organization (super admin only)
 * POST /api/v1/organizations
 */
router.post('/', requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  // Validate request body
  const { error, value } = createOrgSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  const {
    name,
    slug,
    external_id,
    theme = {},
    default_rules_config = {},
    keycloak_realm
  } = value;
  
  try {
    const result = await executeQuery(
      `INSERT INTO organisations (
        external_id, name, slug, theme, default_rules_config, keycloak_realm
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, external_id, name, slug, logo_url, theme, 
        default_rules_config, keycloak_realm, created_at, updated_at`,
      [external_id, name, slug, JSON.stringify(theme), JSON.stringify(default_rules_config), keycloak_realm],
      user.orgId,
      user.isSuperAdmin
    );
    
    logger.info('Organization created', {
      organizationId: result.rows[0].id,
      name,
      slug,
      createdBy: user.id,
    });
    
    res.status(201).json({
      organization: result.rows[0]
    });
  } catch (dbError: any) {
    if (dbError.code === '23505') { // Unique constraint violation
      throw createApiError('Organization slug already exists', 409, 'SLUG_EXISTS');
    }
    throw dbError;
  }
}));

/**
 * Update organization
 * PUT /api/v1/organizations/:id
 */
router.put('/:id', requireRoles('admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const organizationId = req.params.id;
  
  // Super admin can update any org, others only their own
  if (!user.isSuperAdmin && user.orgId !== organizationId) {
    throw createApiError('Access denied to this organization', 403, 'ACCESS_DENIED');
  }
  
  // Validate request body
  const { error, value } = updateOrgSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  Object.entries(value).forEach(([key, val]) => {
    if (key === 'theme' || key === 'default_rules_config') {
      updates.push(`${key} = $${paramCount}`);
      values.push(JSON.stringify(val));
    } else {
      updates.push(`${key} = $${paramCount}`);
      values.push(val);
    }
    paramCount++;
  });
  
  updates.push('updated_at = NOW()');
  values.push(organizationId);
  
  const query = `
    UPDATE organisations 
    SET ${updates.join(', ')} 
    WHERE id = $${paramCount}
    RETURNING 
      id, external_id, name, slug, logo_url, theme, 
      default_rules_config, keycloak_realm, created_at, updated_at
  `;
  
  const result = await executeQuery(
    query,
    values,
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }
  
  logger.info('Organization updated', {
    organizationId,
    updatedFields: Object.keys(value),
    updatedBy: user.id,
  });
  
  res.json({
    organization: result.rows[0]
  });
}));

/**
 * Delete organization (super admin only)
 * DELETE /api/v1/organizations/:id
 */
router.delete('/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const organizationId = req.params.id;
  
  // Check if organization has active exams/sessions
  const activeDataResult = await executeQuery(
    `SELECT 
      (SELECT COUNT(*) FROM exams WHERE org_id = $1) as exam_count,
      (SELECT COUNT(*) FROM sessions s 
       JOIN deliveries d ON s.delivery_id = d.id
       JOIN batches b ON d.batch_id = b.id
       JOIN exams e ON b.exam_id = e.id
       WHERE e.org_id = $1 AND s.status IN ('created', 'active')) as active_session_count`,
    [organizationId],
    user.orgId,
    user.isSuperAdmin
  );
  
  const { exam_count, active_session_count } = activeDataResult.rows[0];
  
  if (parseInt(active_session_count) > 0) {
    throw createApiError(
      'Cannot delete organization with active sessions', 
      409, 
      'HAS_ACTIVE_SESSIONS',
      { activeSessions: active_session_count }
    );
  }
  
  const result = await executeQuery(
    'DELETE FROM organisations WHERE id = $1 RETURNING id, name',
    [organizationId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }
  
  logger.warn('Organization deleted', {
    organizationId,
    organizationName: result.rows[0].name,
    deletedBy: user.id,
    examCount: exam_count,
  });
  
  res.json({
    message: 'Organization deleted successfully',
    organizationId,
  });
}));

export { router as organizationRoutes };