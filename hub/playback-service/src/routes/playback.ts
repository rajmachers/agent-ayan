/**
 * Smart playback and video navigation routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error-handler';
import { requirePermissions, requireTenantAccess } from '../middleware/auth';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/database';
import { StorageService } from '../services/storage';

const router = Router();

// Apply tenant access control
router.use(requireTenantAccess);

const getDb = (req: Request): DatabaseService => req.app.locals.db;
const getStorage = (req: Request): StorageService => req.app.locals.storage;

// Get playback configuration for session
router.get('/:sessionId/config',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    logger.info('Fetching playback config:', { sessionId });
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    
    const recResult = await db.query(
      `SELECT * FROM recordings WHERE session_id = $1 AND tenant_id = $2 LIMIT 1`,
      [sessionId, tenantId]
    );
    if (recResult.rows.length === 0) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }
    const recording = recResult.rows[0];
    
    const violResult = await db.query(
      `SELECT id, timestamp_ms, violation_type, severity, description
       FROM violations WHERE session_id = $1 AND tenant_id = $2 ORDER BY timestamp_ms ASC`,
      [sessionId, tenantId]
    );
    
    const duration = recording.metadata?.duration_ms || recording.metadata?.duration || 3600;
    
    const playbackConfig = {
      sessionId,
      video: {
        url: `/api/recordings/${sessionId}/stream`,
        format: recording.metadata?.format || 'webm',
        resolution: recording.metadata?.resolution || '1920x1080',
        duration,
        frameRate: recording.metadata?.frame_rate || 30,
        seekable: true
      },
      audio: {
        enabled: true,
        codec: 'opus',
        channels: 1,
        sampleRate: 44100
      },
      violations: {
        markers: violResult.rows.map((v: any) => ({
          id: v.id,
          timestamp: v.timestamp_ms,
          type: v.violation_type,
          severity: v.severity,
          description: v.description
        })),
        timeline: {
          enabled: true,
          resolution: 1000,
          heatmap: true
        }
      },
      features: {
        thumbnails: true,
        chapters: true,
        violationJump: true,
        speedControl: true,
        annotations: true
      },
      thumbnails: {
        enabled: true,
        count: 120,
        baseUrl: `/api/playback/${sessionId}/thumbnails`
      }
    };
    
    res.json({
      success: true,
      config: playbackConfig
    });
  })
);

// Get frame at specific timestamp
router.get('/:sessionId/seek/:timestamp',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, timestamp } = req.params;
    const timestampMs = parseInt(timestamp);
    
    if (isNaN(timestampMs)) {
      throw new ValidationError('Invalid timestamp format');
    }
    
    logger.info('Seeking to timestamp:', { sessionId, timestamp: timestampMs });
    
    const db = getDb(req);
    const storage = getStorage(req);
    
    const frameKey = `frames/${sessionId}/frame_${timestampMs}.jpg`;
    const thumbKey = `thumbnails/${sessionId}/thumb_${timestampMs}.jpg`;
    
    let imageUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    try {
      imageUrl = await storage.presignedUrl('recordings', frameKey, 3600);
      thumbnailUrl = await storage.presignedUrl('recordings', thumbKey, 3600);
    } catch {
      // Frame may not exist; return computed URLs
      imageUrl = `/frames/${sessionId}/frame_${timestampMs}.jpg`;
      thumbnailUrl = `/thumbnails/${sessionId}/thumb_${timestampMs}.jpg`;
    }
    
    // Look up any violations near this timestamp
    const violResult = await db.query(
      `SELECT * FROM violations
       WHERE session_id = $1 AND tenant_id = $2
         AND timestamp_ms <= $3 AND timestamp_ms + COALESCE(duration_ms, 0) >= $3`,
      [sessionId, req.user!.tenantId, timestampMs]
    );
    
    const frame = {
      sessionId,
      timestamp: timestampMs,
      frameNumber: Math.floor(timestampMs / 33.33),
      imageUrl,
      thumbnailUrl,
      metadata: {
        resolution: '1920x1080',
        quality: 'high',
        format: 'jpeg'
      },
      annotations: {
        violations: violResult.rows.map((v: any) => ({
          id: v.id,
          code: v.violation_code,
          type: v.violation_type,
          severity: v.severity,
          confidence: v.confidence
        })),
        objects: []
      }
    };
    
    res.json({
      success: true,
      frame
    });
  })
);

// Get video thumbnails
router.get('/:sessionId/thumbnails',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { count = 120, width = 160, height = 90 } = req.query;
    
    logger.info('Fetching thumbnails:', { sessionId, count, width, height });
    
    const storage = getStorage(req);
    const numThumbs = Number(count);
    
    // Try to list existing thumbnails from storage
    let existingThumbs: string[] = [];
    try {
      existingThumbs = await storage.listFiles('recordings', `thumbnails/${sessionId}/`);
    } catch {
      // Storage may not be available, generate computed URLs
    }
    
    const thumbnails = Array.from({ length: numThumbs }, (_, index) => {
      const timestamp = (index * 3600000) / numThumbs;
      return {
        index,
        timestamp,
        url: existingThumbs[index] || `/thumbnails/${sessionId}/thumb_${index}.jpg`,
        width: Number(width),
        height: Number(height)
      };
    });
    
    res.json({
      success: true,
      thumbnails: {
        sessionId,
        count: thumbnails.length,
        items: thumbnails
      }
    });
  })
);

// Get violation clips
router.get('/:sessionId/clips',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { violationId, buffer = 5000 } = req.query;
    const bufferMs = Number(buffer);
    
    logger.info('Fetching violation clips:', { sessionId, violationId, buffer: bufferMs });
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    
    let whereClause = 'WHERE v.session_id = $1 AND v.tenant_id = $2';
    const params: any[] = [sessionId, tenantId];
    if (violationId) {
      whereClause += ' AND v.id = $3';
      params.push(violationId);
    }
    
    const violResult = await db.query(
      `SELECT * FROM violations v ${whereClause} ORDER BY v.timestamp_ms ASC`,
      params
    );
    
    const clips = violResult.rows.map((v: any) => ({
      id: `clip_${v.id}`,
      violationId: v.id,
      sessionId,
      startTime: Math.max(0, v.timestamp_ms - bufferMs),
      endTime: v.timestamp_ms + (v.duration_ms || 0) + bufferMs,
      duration: (v.duration_ms || 0) + bufferMs * 2,
      url: `/clips/${sessionId}/violation_${v.id}.mp4`,
      thumbnailUrl: `/clips/${sessionId}/violation_${v.id}_thumb.jpg`,
      violation: {
        id: v.id,
        type: v.violation_type,
        severity: v.severity,
        description: v.description,
        timestamp: v.timestamp_ms
      }
    }));
    
    res.json({
      success: true,
      clips
    });
  })
);

// Get playback analytics
router.get('/:sessionId/analytics',
  requirePermissions('read:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    
    const recResult = await db.query(
      `SELECT metadata FROM recordings WHERE session_id = $1 AND tenant_id = $2 LIMIT 1`,
      [sessionId, tenantId]
    );
    const totalDuration = recResult.rows[0]?.metadata?.duration_ms || 3600000;
    
    const violResult = await db.query(
      `SELECT timestamp_ms, duration_ms, severity, violation_type, description
       FROM violations WHERE session_id = $1 AND tenant_id = $2 ORDER BY timestamp_ms ASC`,
      [sessionId, tenantId]
    );
    
    const violations = violResult.rows;
    const violationTime = violations.reduce((sum: number, v: any) => sum + (v.duration_ms || 0), 0);
    
    // Build key moments
    const keyMoments = violations.map((v: any) => ({
      timestamp: v.timestamp_ms,
      type: 'violation_start',
      severity: v.severity,
      description: v.description
    }));
    
    // Build 1-minute segment timeline
    const segmentDuration = 60000;
    const segmentCount = Math.ceil(totalDuration / segmentDuration);
    const segments = Array.from({ length: segmentCount }, (_, i) => {
      const startTime = i * segmentDuration;
      const endTime = Math.min(startTime + segmentDuration, totalDuration);
      const segViolations = violations.filter(
        (v: any) => v.timestamp_ms >= startTime && v.timestamp_ms < endTime
      ).length;
      const riskLevel = segViolations === 0 ? 'low' : segViolations === 1 ? 'medium' : 'high';
      return { startTime, endTime, violations: segViolations, riskLevel };
    });
    
    // Build heatmap (8 buckets)
    const bucketSize = totalDuration / 8;
    const heatmap = Array.from({ length: 8 }, (_, i) => {
      const start = i * bucketSize;
      const end = start + bucketSize;
      const count = violations.filter(
        (v: any) => v.timestamp_ms >= start && v.timestamp_ms < end
      ).length;
      return Math.min(1, count / 3); // Normalize to 0-1
    });
    
    res.json({
      success: true,
      analytics: {
        sessionId,
        overview: {
          totalDuration,
          violationTime,
          cleanTime: totalDuration - violationTime,
          violationPercentage: totalDuration > 0 ? (violationTime / totalDuration) * 100 : 0
        },
        timeline: {
          resolution: segmentDuration,
          segments
        },
        heatmap: { data: heatmap },
        keyMoments
      }
    });
  })
);

// Generate violation summary clips
router.post('/:sessionId/summary-clip',
  requirePermissions('write:recordings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { includeViolations = true, maxDuration = 300 } = req.body;
    
    logger.info('Generating summary clip:', { sessionId, includeViolations, maxDuration });
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    
    // Fetch violations for the session to build segments
    const violResult = await db.query(
      `SELECT id, timestamp_ms, duration_ms, violation_type, severity, description
       FROM violations WHERE session_id = $1 AND tenant_id = $2 ORDER BY timestamp_ms ASC`,
      [sessionId, tenantId]
    );
    
    const bufferMs = 2000;
    let clipOffset = 0;
    const segments = violResult.rows.map((v: any) => {
      const start = Math.max(0, v.timestamp_ms - bufferMs);
      const end = v.timestamp_ms + (v.duration_ms || 0) + bufferMs;
      const segDuration = end - start;
      const seg = {
        originalStart: start,
        originalEnd: end,
        clipStart: clipOffset,
        clipEnd: clipOffset + segDuration,
        reason: 'violation_highlight',
        description: v.description
      };
      clipOffset += segDuration;
      return seg;
    });
    
    const totalClipDuration = Math.min(maxDuration * 1000, clipOffset);
    
    const summaryClip = {
      id: 'summary_' + Date.now(),
      sessionId,
      type: 'highlights',
      duration: totalClipDuration,
      url: `/clips/${sessionId}/summary.mp4`,
      thumbnailUrl: `/clips/${sessionId}/summary_thumb.jpg`,
      segments,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    res.status(202).json({
      success: true,
      summaryClip,
      message: 'Summary clip generation started'
    });
  })
);

export default router;