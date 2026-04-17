import { Router } from 'express';
import Joi from 'joi';
import { executeQuery } from '../utils/database';
import { logger } from '../utils/logger';
import { asyncHandler, createApiError } from '../middleware/error';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth';

const router = Router();

// Validation schemas
const createExamSchema = Joi.object({
  title: Joi.string().required().min(2).max(255),
  description: Joi.string().optional(),
  duration_min: Joi.number().integer().min(1).max(480).default(60),
  instructions: Joi.string().optional(),
  exam_app_url: Joi.string().uri().required(),
  external_id: Joi.string().optional(),
  addons_config: Joi.object().default({
    face_verify: true,
    id_verify: false,
    env_scan: true,
    screen_record: true,
    browser_lock: true
  }),
  metrics_config: Joi.object().default({
    face_detection_weight: 0.25,
    browser_violation_weight: 0.30,
    audio_violation_weight: 0.20,
    motion_violation_weight: 0.25
  }),
  rules_config: Joi.object().default({
    allow_calculator: false,
    allow_notes: false,
    allow_breaks: false,
    max_violations: 5
  }),
  callback_url: Joi.string().uri().optional(),
});

const updateExamSchema = createExamSchema.fork(['title', 'exam_app_url'], (schema) => schema.optional());

/**
 * Get all exams for current organization
 * GET /api/v1/exams
 */
router.get('/', requireRoles('examiner', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  
  // Count total exams
  let countQuery = 'SELECT COUNT(*) as total FROM exams';
  let countParams: any[] = [];
  
  // Super admin can see all exams, others only their org's
  if (!user.isSuperAdmin) {
    countQuery += ' WHERE org_id = $1';
    countParams.push(user.orgId);
  }
  
  const countResult = await executeQuery(
    countQuery,
    countParams,
    user.orgId,
    user.isSuperAdmin
  );
  
  const total = parseInt(countResult.rows[0].total);
  
  // Get paginated exams with organization info
  let examsQuery = `
    SELECT 
      e.id, 
      e.external_id, 
      e.title, 
      e.description, 
      e.duration_min, 
      e.instructions,
      e.exam_app_url,
      e.addons_config, 
      e.metrics_config, 
      e.rules_config,
      e.callback_url,
      e.created_by, 
      e.created_at, 
      e.updated_at,
      o.name as org_name,
      o.slug as org_slug
    FROM exams e 
    JOIN organisations o ON e.org_id = o.id
  `;
  
  let examsParams: any[] = [];
  let paramCount = 1;
  
  if (!user.isSuperAdmin) {
    examsQuery += ' WHERE e.org_id = $' + paramCount;
    examsParams.push(user.orgId);
    paramCount++;
  }
  
  examsQuery += ' ORDER BY e.created_at DESC';
  examsQuery += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  examsParams.push(limit, offset);
  
  const result = await executeQuery(
    examsQuery,
    examsParams,
    user.orgId,
    user.isSuperAdmin
  );
  
  res.json({
    exams: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

/**
 * Get exam by ID
 * GET /api/v1/exams/:id
 */
router.get('/:id', requireRoles('examiner', 'admin', 'proctor', 'viewer'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const examId = req.params.id;
  
  const result = await executeQuery(
    `SELECT 
      e.*, 
      o.name as org_name,
      o.slug as org_slug,
      o.theme as org_theme
    FROM exams e 
    JOIN organisations o ON e.org_id = o.id 
    WHERE e.id = $1`,
    [examId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Exam not found', 404, 'EXAM_NOT_FOUND');
  }
  
  res.json({
    exam: result.rows[0]
  });
}));

/**
 * Create new exam
 * POST /api/v1/exams
 */
router.post('/', requireRoles('examiner', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user.orgId && !user.isSuperAdmin) {
    throw createApiError('Organization context required', 400, 'ORG_CONTEXT_REQUIRED');
  }
  
  // Validate request body
  const { error, value } = createExamSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  // Super admin must specify org_id in request, others use their own
  const orgId = user.isSuperAdmin ? (req.body.org_id || user.orgId) : user.orgId;
  
  if (!orgId) {
    throw createApiError('Organization ID is required', 400, 'ORG_ID_REQUIRED');
  }
  
  const {
    title,
    description,
    duration_min,
    instructions,
    exam_app_url,
    external_id,
    addons_config,
    metrics_config,
    rules_config,
    callback_url
  } = value;
  
  try {
    const result = await executeQuery(
      `INSERT INTO exams (
        external_id, org_id, title, description, duration_min, instructions,
        exam_app_url, addons_config, metrics_config, rules_config, 
        callback_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING 
        id, external_id, org_id, title, description, duration_min, instructions,
        exam_app_url, addons_config, metrics_config, rules_config,
        callback_url, created_by, created_at, updated_at`,
      [
        external_id, orgId, title, description, duration_min, instructions,
        exam_app_url, JSON.stringify(addons_config), JSON.stringify(metrics_config),
        JSON.stringify(rules_config), callback_url, user.id
      ],
      user.orgId,
      user.isSuperAdmin
    );
    
    logger.info('Exam created', {
      examId: result.rows[0].id,
      title,
      orgId,
      createdBy: user.id,
    });
    
    res.status(201).json({
      exam: result.rows[0]
    });
  } catch (dbError: any) {
    if (dbError.code === '23505') { // Unique constraint violation
      throw createApiError('Exam with this external ID already exists', 409, 'EXAM_EXISTS');
    }
    throw dbError;
  }
}));

/**
 * Update exam
 * PUT /api/v1/exams/:id
 */
router.put('/:id', requireRoles('examiner', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const examId = req.params.id;
  
  // Validate request body
  const { error, value } = updateExamSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  Object.entries(value).forEach(([key, val]) => {
    if (['addons_config', 'metrics_config', 'rules_config'].includes(key)) {
      updates.push(`${key} = $${paramCount}`);
      values.push(JSON.stringify(val));
    } else {
      updates.push(`${key} = $${paramCount}`);
      values.push(val);
    }
    paramCount++;
  });
  
  if (updates.length === 0) {
    throw createApiError('No valid fields to update', 400, 'NO_UPDATES');
  }
  
  updates.push('updated_at = NOW()');
  values.push(examId);
  
  const query = `
    UPDATE exams 
    SET ${updates.join(', ')} 
    WHERE id = $${paramCount}
    RETURNING 
      id, external_id, org_id, title, description, duration_min, instructions,
      exam_app_url, addons_config, metrics_config, rules_config,
      callback_url, created_by, created_at, updated_at
  `;
  
  const result = await executeQuery(
    query,
    values,
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Exam not found', 404, 'EXAM_NOT_FOUND');
  }
  
  logger.info('Exam updated', {
    examId,
    updatedFields: Object.keys(value),
    updatedBy: user.id,
  });
  
  res.json({
    exam: result.rows[0]
  });
}));

/**
 * Delete exam
 * DELETE /api/v1/exams/:id
 */
router.delete('/:id', requireRoles('examiner', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const examId = req.params.id;
  
  // Check if exam has active sessions
  const activeSessionsResult = await executeQuery(
    `SELECT COUNT(*) as active_count 
     FROM sessions s
     JOIN deliveries d ON s.delivery_id = d.id
     JOIN batches b ON d.batch_id = b.id
     WHERE b.exam_id = $1 AND s.status IN ('created', 'active')`,
    [examId],
    user.orgId,
    user.isSuperAdmin
  );
  
  const activeCount = parseInt(activeSessionsResult.rows[0].active_count);
  
  if (activeCount > 0) {
    throw createApiError(
      'Cannot delete exam with active sessions',
      409,
      'HAS_ACTIVE_SESSIONS',
      { activeSessions: activeCount }
    );
  }
  
  const result = await executeQuery(
    'DELETE FROM exams WHERE id = $1 RETURNING id, title',
    [examId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Exam not found', 404, 'EXAM_NOT_FOUND');
  }
  
  logger.warn('Exam deleted', {
    examId,
    title: result.rows[0].title,
    deletedBy: user.id,
  });
  
  res.json({
    message: 'Exam deleted successfully',
    examId,
  });
}));

export { router as examRoutes };