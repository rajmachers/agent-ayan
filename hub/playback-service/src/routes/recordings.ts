/**
 * Recording management routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error-handler';
import { requirePermissions, requireTenantAccess } from '../middleware/auth';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/database';
import { StorageService } from '../services/storage';

const router = Router();

// Apply tenant access control to all routes
router.use(requireTenantAccess);

const getDb = (req: Request): DatabaseService => req.app.locals.db;
const getStorage = (req: Request): StorageService => req.app.locals.storage;

// Ingest new recording
router.post('/ingest',
  requirePermissions('write:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, participantId, filePath, metadata } = req.body;
    
    if (!sessionId || !participantId || !filePath) {
      throw new ValidationError('sessionId, participantId, and filePath are required');
    }
    
    logger.info('Ingesting recording:', { sessionId, participantId, filePath });
    
    const db = getDb(req);
    const result = await db.query(
      `INSERT INTO recordings (session_id, participant_id, tenant_id, file_path, status, metadata)
       VALUES ($1, $2, $3, $4, 'processing', $5)
       RETURNING *`,
      [sessionId, participantId, req.user!.tenantId, filePath, JSON.stringify(metadata || {})]
    );
    
    res.status(201).json({
      success: true,
      recording: result.rows[0],
      message: 'Recording ingestion started'
    });
  })
);

// Get session recording
router.get('/:sessionId',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    logger.info('Fetching recording:', { sessionId });
    
    const db = getDb(req);
    const result = await db.query(
      'SELECT * FROM recordings WHERE session_id = $1 AND tenant_id = $2',
      [sessionId, req.user!.tenantId]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError(`Recording not found for session ${sessionId}`);
    }
    
    res.json({
      success: true,
      recording: result.rows[0]
    });
  })
);

// Get recording metadata
router.get('/:sessionId/metadata',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const db = getDb(req);
    const result = await db.query(
      'SELECT * FROM recordings WHERE session_id = $1 AND tenant_id = $2',
      [sessionId, req.user!.tenantId]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError(`Recording not found for session ${sessionId}`);
    }
    
    const rec = result.rows[0];
    res.json({
      success: true,
      metadata: {
        sessionId: rec.session_id,
        duration: rec.duration_seconds,
        fileSize: rec.file_size,
        resolution: rec.resolution,
        format: rec.format,
        processing: rec.metadata || {}
      }
    });
  })
);

// Delete recording
router.delete('/:sessionId',
  requirePermissions('write:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    logger.info('Deleting recording:', { sessionId });
    
    const db = getDb(req);
    const storage = getStorage(req);
    
    const rec = await db.query(
      'SELECT * FROM recordings WHERE session_id = $1 AND tenant_id = $2',
      [sessionId, req.user!.tenantId]
    );
    
    if (rec.rows.length > 0 && rec.rows[0].file_path) {
      await storage.deleteFile(rec.rows[0].file_path).catch((err: Error) =>
        logger.warn('Failed to delete storage file:', err.message)
      );
    }
    
    await db.query(
      'DELETE FROM recordings WHERE session_id = $1 AND tenant_id = $2',
      [sessionId, req.user!.tenantId]
    );
    
    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  })
);

// List recordings for tenant
router.get('/',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status, participantId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const db = getDb(req);
    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [req.user!.tenantId];
    let paramIdx = 2;
    
    if (status) {
      whereClause += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (participantId) {
      whereClause += ` AND participant_id = $${paramIdx++}`;
      params.push(participantId);
    }
    
    const countResult = await db.query(
      `SELECT COUNT(*) FROM recordings ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    params.push(Number(limit), offset);
    const result = await db.query(
      `SELECT * FROM recordings ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );
    
    res.json({
      success: true,
      recordings: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  })
);

export default router;