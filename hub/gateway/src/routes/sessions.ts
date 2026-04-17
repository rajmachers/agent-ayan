import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../utils/database';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';
import { asyncHandler, createApiError } from '../middleware/error';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth';

const router = Router();

// Validation schemas
const createSessionSchema = Joi.object({
  delivery_id: Joi.string().uuid().required(),
  candidate_id: Joi.string().required(),
  external_id: Joi.string().optional(),
});

const updateSessionSchema = Joi.object({
  status: Joi.string().valid('created', 'active', 'completed', 'interrupted', 'failed'),
  credibility_score: Joi.number().min(0).max(100),
  risk_level: Joi.string().valid('low', 'medium', 'high'),
  notes: Joi.string().optional(),
}).min(1);

const logViolationSchema = Joi.object({
  code: Joi.string().required().pattern(/^[a-z]\d+$/), // e.g., b1, c2, a1
  type: Joi.string().required().valid('browser', 'camera', 'audio', 'behavior', 'screen'),
  severity: Joi.number().min(0).max(1).default(0.5),
  confidence: Joi.number().min(0).max(1).default(0.5),
  weight: Joi.number().min(0).max(1).default(0.5),
  metadata: Joi.object().default({}),
});

/**
 * Get all sessions with filtering
 * GET /api/v1/sessions
 */
router.get('/', requireRoles('proctor', 'admin', 'viewer'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  
  // Filters
  const status = req.query.status as string;
  const examId = req.query.exam_id as string;
  const riskLevel = req.query.risk_level as string;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  
  // Build where clause
  const whereConditions: string[] = [];
  const queryParams: any[] = [];
  let paramCount = 1;
  
  // Base condition for tenant isolation (handled by RLS, but explicit for clarity)
  if (!user.isSuperAdmin && user.orgId) {
    whereConditions.push(`e.org_id = $${paramCount}`);
    queryParams.push(user.orgId);
    paramCount++;
  }
  
  if (status) {
    whereConditions.push(`s.status = $${paramCount}`);
    queryParams.push(status);
    paramCount++;
  }
  
  if (examId) {
    whereConditions.push(`e.id = $${paramCount}`);
    queryParams.push(examId);
    paramCount++;
  }
  
  if (riskLevel) {
    whereConditions.push(`s.risk_level = $${paramCount}`);
    queryParams.push(riskLevel);
    paramCount++;
  }
  
  if (startDate) {
    whereConditions.push(`s.started_at >= $${paramCount}`);
    queryParams.push(startDate);
    paramCount++;
  }
  
  if (endDate) {
    whereConditions.push(`s.started_at <= $${paramCount}`);
    queryParams.push(endDate);
    paramCount++;
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Count total sessions
  const countQuery = `
    SELECT COUNT(*) as total
    FROM sessions s
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    ${whereClause}
  `;
  
  const countResult = await executeQuery(
    countQuery,
    queryParams,
    user.orgId,
    user.isSuperAdmin
  );
  
  const total = parseInt(countResult.rows[0].total);
  
  // Get paginated sessions
  const sessionsQuery = `
    SELECT 
      s.id,
      s.external_id,
      s.candidate_id,
      s.room_id,
      s.agent_id,
      s.status,
      s.credibility_score,
      s.risk_level,
      s.started_at,
      s.ended_at,
      s.created_at,
      s.updated_at,
      e.id as exam_id,
      e.title as exam_title,
      e.duration_min as exam_duration,
      b.id as batch_id,
      b.name as batch_name,
      d.id as delivery_id,
      d.scheduled_at as delivery_scheduled_at,
      o.id as org_id,
      o.name as org_name
    FROM sessions s
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    JOIN organisations o ON e.org_id = o.id
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;
  
  queryParams.push(limit, offset);
  
  const result = await executeQuery(
    sessionsQuery,
    queryParams,
    user.orgId,
    user.isSuperAdmin
  );
  
  res.json({
    sessions: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    filters: {
      status,
      examId,
      riskLevel,
      startDate,
      endDate,
    },
  });
}));

/**
 * Get session by ID with full details
 * GET /api/v1/sessions/:id
 */
router.get('/:id', requireRoles('proctor', 'admin', 'viewer'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const sessionId = req.params.id;
  
  // Get session details
  const sessionResult = await executeQuery(
    `SELECT 
      s.*,
      e.id as exam_id,
      e.title as exam_title,
      e.duration_min,
      e.addons_config,
      e.metrics_config,
      e.rules_config,
      b.id as batch_id,
      b.name as batch_name,
      d.id as delivery_id,
      d.scheduled_at,
      d.end_at,
      o.id as org_id,
      o.name as org_name,
      o.theme as org_theme
    FROM sessions s
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    JOIN organisations o ON e.org_id = o.id
    WHERE s.id = $1`,
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (sessionResult.rows.length === 0) {
    throw createApiError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  const session = sessionResult.rows[0];
  
  // Get violations for this session
  const violationsResult = await executeQuery(
    `SELECT 
      id, code, type, severity, confidence, weight, metadata, timestamp
    FROM violations 
    WHERE session_id = $1 
    ORDER BY timestamp ASC`,
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  // Get recordings for this session
  const recordingsResult = await executeQuery(
    `SELECT 
      id, type, storage_url, duration_sec, size_bytes, created_at
    FROM recordings 
    WHERE session_id = $1 
    ORDER BY created_at ASC`,
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  // Get score history
  const scoresResult = await executeQuery(
    `SELECT 
      score, breakdown, timestamp
    FROM score_history 
    WHERE session_id = $1 
    ORDER BY timestamp ASC`,
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  res.json({
    session,
    violations: violationsResult.rows,
    recordings: recordingsResult.rows,
    scoreHistory: scoresResult.rows,
  });
}));

/**
 * Create new session
 * POST /api/v1/sessions
 */
router.post('/', requireRoles('proctor', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  // Validate request body
  const { error, value } = createSessionSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  const { delivery_id, candidate_id, external_id } = value;
  
  // Verify delivery exists and get exam info
  const deliveryResult = await executeQuery(
    `SELECT 
      d.id, d.batch_id, d.scheduled_at, d.end_at, d.status,
      b.exam_id,
      e.title as exam_title,
      e.org_id
    FROM deliveries d
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    WHERE d.id = $1`,
    [delivery_id],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (deliveryResult.rows.length === 0) {
    throw createApiError('Delivery not found', 404, 'DELIVERY_NOT_FOUND');
  }
  
  const delivery = deliveryResult.rows[0];
  
  // Check if candidate already has an active session for this delivery
  const existingSessionResult = await executeQuery(
    `SELECT id, status FROM sessions 
     WHERE delivery_id = $1 AND candidate_id = $2 AND status IN ('created', 'active')`,
    [delivery_id, candidate_id],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (existingSessionResult.rows.length > 0) {
    throw createApiError(
      'Candidate already has an active session for this delivery',
      409,
      'SESSION_EXISTS',
      { existingSessionId: existingSessionResult.rows[0].id }
    );
  }
  
  // Generate room ID for LiveKit
  const roomId = `session_${delivery.exam_id}_${candidate_id}_${Date.now()}`;
  
  try {
    const result = await executeQuery(
      `INSERT INTO sessions (
        external_id, delivery_id, batch_id, exam_id, candidate_id, room_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'created')
      RETURNING 
        id, external_id, delivery_id, batch_id, exam_id, candidate_id, 
        room_id, status, created_at, updated_at`,
      [
        external_id, 
        delivery_id, 
        delivery.batch_id, 
        delivery.exam_id, 
        candidate_id, 
        roomId
      ],
      user.orgId,
      user.isSuperAdmin
    );
    
    logger.info('Session created', {
      sessionId: result.rows[0].id,
      candidateId: candidate_id,
      examId: delivery.exam_id,
      deliveryId: delivery_id,
      createdBy: user.id,
    });
    
    res.status(201).json({
      session: result.rows[0]
    });
  } catch (dbError: any) {
    if (dbError.code === '23505') { // Unique constraint violation
      throw createApiError('Session with this external ID already exists', 409, 'SESSION_EXISTS');
    }
    throw dbError;
  }
}));

/**
 * Update session status and properties
 * PUT /api/v1/sessions/:id
 */
router.put('/:id', requireRoles('proctor', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const sessionId = req.params.id;
  
  // Validate request body
  const { error, value } = updateSessionSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  Object.entries(value).forEach(([key, val]) => {
    updates.push(`${key} = $${paramCount}`);
    values.push(val);
    
    // Set started_at when status changes to active
    if (key === 'status' && val === 'active') {
      updates.push('started_at = NOW()');
    }
    
    // Set ended_at when status changes to completed, interrupted, or failed
    if (key === 'status' && ['completed', 'interrupted', 'failed'].includes(val as string)) {
      updates.push('ended_at = NOW()');
    }
    
    paramCount++;
  });
  
  if (updates.length === 0) {
    throw createApiError('No valid fields to update', 400, 'NO_UPDATES');
  }
  
  updates.push('updated_at = NOW()');
  values.push(sessionId);
  
  const query = `
    UPDATE sessions 
    SET ${updates.join(', ')} 
    WHERE id = $${paramCount}
    RETURNING 
      id, external_id, delivery_id, batch_id, exam_id, candidate_id,
      room_id, status, credibility_score, risk_level, started_at, ended_at,
      created_at, updated_at
  `;
  
  const result = await executeQuery(
    query,
    values,
    user.orgId,
    user.isSuperAdmin
  );
  
  if (result.rows.length === 0) {
    throw createApiError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  logger.info('Session updated', {
    sessionId,
    updatedFields: Object.keys(value),
    updatedBy: user.id,
  });
  
  res.json({
    session: result.rows[0]
  });
}));

/**
 * Log violation for a session
 * POST /api/v1/sessions/:id/violations
 */
router.post('/:id/violations', requireRoles('proctor', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const sessionId = req.params.id;
  
  // Validate request body
  const { error, value } = logViolationSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  const { code, type, severity, confidence, weight, metadata } = value;
  
  // Verify session exists and is active
  const sessionResult = await executeQuery(
    'SELECT id, status FROM sessions WHERE id = $1',
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (sessionResult.rows.length === 0) {
    throw createApiError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  const session = sessionResult.rows[0];
  
  if (session.status !== 'active') {
    throw createApiError('Can only log violations for active sessions', 400, 'SESSION_NOT_ACTIVE');
  }
  
  // Insert violation
  const result = await executeQuery(
    `INSERT INTO violations (
      session_id, code, type, severity, confidence, weight, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, session_id, code, type, severity, confidence, weight, metadata, timestamp, created_at`,
    [sessionId, code, type, severity, confidence, weight, JSON.stringify(metadata)],
    user.orgId,
    user.isSuperAdmin
  );
  
  // Cache the violation for real-time updates
  const violationData = {
    ...result.rows[0],
    sessionId: sessionId,
  };
  
  await cache.setJSON(`violation:${sessionId}:${result.rows[0].id}`, violationData, 3600); // 1 hour cache
  
  logger.info('Violation logged', {
    violationId: result.rows[0].id,
    sessionId,
    code,
    type,
    severity,
    loggedBy: user.id,
  });
  
  res.status(201).json({
    violation: result.rows[0]
  });
}));

/**
 * Get violations for a session
 * GET /api/v1/sessions/:id/violations
 */
router.get('/:id/violations', requireRoles('proctor', 'admin', 'viewer'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const sessionId = req.params.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const type = req.query.type as string;
  
  // Build query with optional type filter
  let query = `
    SELECT id, code, type, severity, confidence, weight, metadata, timestamp
    FROM violations 
    WHERE session_id = $1
  `;
  
  const params: any[] = [sessionId];
  
  if (type) {
    query += ' AND type = $2';
    params.push(type);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const result = await executeQuery(
    query,
    params,
    user.orgId,
    user.isSuperAdmin
  );
  
  res.json({
    violations: result.rows,
    sessionId,
    count: result.rows.length,
  });
}));

export { router as sessionRoutes };