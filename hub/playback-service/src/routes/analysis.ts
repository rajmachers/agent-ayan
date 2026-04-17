/**
 * AI analysis and violation detection routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error-handler';
import { requirePermissions, requireTenantAccess } from '../middleware/auth';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/database';

const router = Router();

// Apply tenant access control
router.use(requireTenantAccess);

const getDb = (req: Request): DatabaseService => req.app.locals.db;

// Analyze session recording
router.post('/session/:sessionId',
  requirePermissions('write:analysis'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { priority = 'normal', options = {} } = req.body;
    
    logger.info('Starting session analysis:', { sessionId, priority, options });
    
    const db = getDb(req);
    const result = await db.query(
      `INSERT INTO analysis_jobs (session_id, tenant_id, job_type, status, priority, options)
       VALUES ($1, $2, 'full_analysis', 'queued', $3, $4)
       RETURNING *`,
      [sessionId, req.user!.tenantId, priority, JSON.stringify(options)]
    );
    
    const row = result.rows[0];
    res.status(202).json({
      success: true,
      analysisJob: {
        id: row.id,
        sessionId: row.session_id,
        jobType: row.job_type,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at
      },
      message: 'Analysis started'
    });
  })
);

// Get session violations
router.get('/:sessionId/violations',
  requirePermissions('read:violations'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { 
      type,
      severity,
      confidence,
      startTime,
      endTime,
      page = 1,
      limit = 50
    } = req.query;
    
    logger.info('Fetching violations:', { sessionId, filters: req.query });
    
    const db = getDb(req);
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = 'WHERE v.session_id = $1 AND v.tenant_id = $2';
    const params: any[] = [sessionId, req.user!.tenantId];
    let paramIdx = 3;
    
    if (type) { whereClause += ` AND v.violation_type = $${paramIdx++}`; params.push(type); }
    if (severity) { whereClause += ` AND v.severity = $${paramIdx++}`; params.push(severity); }
    if (confidence) { whereClause += ` AND v.confidence >= $${paramIdx++}`; params.push(Number(confidence)); }
    if (startTime) { whereClause += ` AND v.timestamp_ms >= $${paramIdx++}`; params.push(Number(startTime)); }
    if (endTime) { whereClause += ` AND v.timestamp_ms <= $${paramIdx++}`; params.push(Number(endTime)); }
    
    const countResult = await db.query(`SELECT COUNT(*) FROM violations v ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    
    const dataResult = await db.query(
      `SELECT * FROM violations v ${whereClause} ORDER BY v.timestamp_ms ASC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, Number(limit), offset]
    );
    
    const violations = dataResult.rows;
    
    // Compute summary
    const summaryResult = await db.query(
      `SELECT severity, violation_type, COUNT(*) as cnt FROM violations v ${whereClause} GROUP BY severity, violation_type`,
      params
    );
    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<string, number> = { object: 0, audio: 0, behavior: 0 };
    for (const r of summaryResult.rows) {
      if (bySeverity[r.severity] !== undefined) bySeverity[r.severity] = parseInt(r.cnt, 10);
      if (byType[r.violation_type] !== undefined) byType[r.violation_type] = parseInt(r.cnt, 10);
    }
    
    res.json({
      success: true,
      violations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      summary: {
        totalViolations: total,
        bySeverity,
        byType
      }
    });
  })
);

// Get violation timeline
router.get('/:sessionId/timeline',
  requirePermissions('read:violations'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { resolution = 1000 } = req.query;
    
    const db = getDb(req);
    
    const eventsResult = await db.query(
      `SELECT violation_code, violation_type, severity, confidence, timestamp_ms
       FROM violations
       WHERE session_id = $1 AND tenant_id = $2
       ORDER BY timestamp_ms ASC`,
      [sessionId, req.user!.tenantId]
    );
    
    const recResult = await db.query(
      `SELECT metadata FROM recordings WHERE session_id = $1 AND tenant_id = $2 LIMIT 1`,
      [sessionId, req.user!.tenantId]
    );
    const duration = recResult.rows[0]?.metadata?.duration_ms || 3600000;
    
    const events = eventsResult.rows.map((r: any) => ({
      timestamp: r.timestamp_ms,
      type: 'violation',
      severity: r.severity,
      count: 1,
      details: { codes: [r.violation_code], confidence: r.confidence }
    }));
    
    const totalEvents = events.length;
    const peakTimes = events.map((e: any) => Math.floor(e.timestamp / 1000));
    
    res.json({
      success: true,
      timeline: {
        sessionId,
        resolution: Number(resolution),
        duration,
        events,
        statistics: {
          totalEvents,
          violationDensity: duration > 0 ? totalEvents / (duration / 1000) : 0,
          peakTimes
        }
      }
    });
  })
);

// Real-time analysis webhook
router.post('/realtime',
  requirePermissions('write:analysis'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, timestamp, analysisData } = req.body;
    
    if (!sessionId || !timestamp || !analysisData) {
      throw new ValidationError('sessionId, timestamp, and analysisData are required');
    }
    
    logger.info('Real-time analysis received:', { sessionId, timestamp });
    
    const db = getDb(req);
    let violationsDetected = 0;
    
    if (analysisData.violations && Array.isArray(analysisData.violations)) {
      for (const v of analysisData.violations) {
        await db.query(
          `INSERT INTO violations (session_id, tenant_id, participant_id, violation_code, violation_type, severity, confidence, description, timestamp_ms, duration_ms, ai_service, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [sessionId, req.user!.tenantId, v.participantId, v.code, v.type, v.severity, v.confidence, v.description, v.timestampMs, v.durationMs || 0, v.aiService, JSON.stringify(v.metadata || {})]
        );
        violationsDetected++;
      }
    }
    
    res.json({
      success: true,
      processed: true,
      violationsDetected,
      timestamp: new Date().toISOString()
    });
  })
);

// Get analysis job status
router.get('/job/:jobId',
  requirePermissions('read:analysis'),
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    
    const db = getDb(req);
    const result = await db.query(
      `SELECT * FROM analysis_jobs WHERE id = $1 AND tenant_id = $2`,
      [jobId, req.user!.tenantId]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError(`Analysis job ${jobId} not found`);
    }
    
    const row = result.rows[0];
    res.json({
      success: true,
      job: {
        id: row.id,
        sessionId: row.session_id,
        jobType: row.job_type,
        status: row.status,
        progress: row.progress || 0,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        result: row.result
      }
    });
  })
);

export default router;