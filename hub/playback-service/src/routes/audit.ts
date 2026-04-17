/**
 * Audit report generation and management routes
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

// Generate audit report
router.get('/:sessionId/report',
  requirePermissions('read:audit'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { format = 'json', includeEvidence = true } = req.query;
    
    logger.info('Generating audit report:', { sessionId, format, includeEvidence });
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    
    // Fetch recording info
    const recResult = await db.query(
      `SELECT * FROM recordings WHERE session_id = $1 AND tenant_id = $2 LIMIT 1`,
      [sessionId, tenantId]
    );
    if (recResult.rows.length === 0) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }
    const recording = recResult.rows[0];
    
    // Fetch violations
    const violResult = await db.query(
      `SELECT * FROM violations WHERE session_id = $1 AND tenant_id = $2 ORDER BY timestamp_ms ASC`,
      [sessionId, tenantId]
    );
    const violations = violResult.rows;
    
    // Compute severity/type breakdown
    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<string, number> = { object: 0, audio: 0, behavior: 0 };
    for (const v of violations) {
      if (bySeverity[v.severity] !== undefined) bySeverity[v.severity]++;
      if (byType[v.violation_type] !== undefined) byType[v.violation_type]++;
    }
    
    // Check for existing report or create
    let reportRow;
    const existingReport = await db.query(
      `SELECT * FROM audit_reports WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [sessionId, tenantId]
    );
    
    if (existingReport.rows.length > 0) {
      reportRow = existingReport.rows[0];
    } else {
      const avgConfidence = violations.length > 0
        ? violations.reduce((sum: number, v: any) => sum + (v.confidence || 0), 0) / violations.length
        : 1;
      const overallScore = Math.max(0, Math.round(100 - violations.length * 12.5));
      const riskLevel = overallScore >= 80 ? 'low' : overallScore >= 60 ? 'medium' : 'high';
      
      const insertResult = await db.query(
        `INSERT INTO audit_reports (session_id, tenant_id, report_type, overall_score, risk_level, confidence, violations_summary, metadata)
         VALUES ($1, $2, 'comprehensive', $3, $4, $5, $6, $7)
         RETURNING *`,
        [sessionId, tenantId, overallScore, riskLevel, avgConfidence,
         JSON.stringify({ total: violations.length, bySeverity, byType }),
         JSON.stringify({ reportVersion: '1.0', generatedBy: 'playback-service' })]
      );
      reportRow = insertResult.rows[0];
    }
    
    const auditReport = {
      id: reportRow.id,
      sessionId,
      tenantId,
      reportType: reportRow.report_type,
      generatedAt: reportRow.created_at,
      session: {
        id: sessionId,
        participant: recording.participant_id,
        metadata: recording.metadata
      },
      violations: {
        total: violations.length,
        bySeverity,
        byType,
        details: violations.map((v: any) => ({
          id: v.id,
          code: v.violation_code,
          type: v.violation_type,
          severity: v.severity,
          confidence: v.confidence,
          description: v.description,
          timestamp: v.timestamp_ms,
          duration: v.duration_ms,
          evidence: includeEvidence ? v.metadata?.evidence || null : null
        }))
      },
      analysis: {
        overallScore: reportRow.overall_score,
        riskLevel: reportRow.risk_level,
        confidence: reportRow.confidence
      },
      metadata: reportRow.metadata
    };
    
    res.json({
      success: true,
      report: auditReport
    });
  })
);

// Export audit report in different formats
router.get('/:sessionId/export/:format',
  requirePermissions('read:audit'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, format } = req.params;
    
    if (!['pdf', 'json', 'csv', 'xlsx'].includes(format)) {
      throw new ValidationError('Supported formats: pdf, json, csv, xlsx');
    }
    
    logger.info('Exporting audit report:', { sessionId, format });
    
    const db = getDb(req);
    const reportResult = await db.query(
      `SELECT * FROM audit_reports WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [sessionId, req.user!.tenantId]
    );
    
    if (reportResult.rows.length === 0) {
      throw new NotFoundError(`No audit report found for session ${sessionId}`);
    }
    
    const exportedReport = {
      id: 'export_' + Date.now(),
      sessionId,
      format,
      reportId: reportResult.rows[0].id,
      downloadUrl: `/downloads/audit_${sessionId}.${format}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      export: exportedReport
    });
  })
);

// Bulk session summary
router.get('/sessions/summary',
  requirePermissions('read:audit'),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      startDate,
      endDate,
      participantId,
      minViolations,
      maxViolations,
      page = 1,
      limit = 20
    } = req.query;
    
    logger.info('Generating bulk session summary:', req.query);
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = 'WHERE r.tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIdx = 2;
    
    if (startDate) { whereClause += ` AND r.created_at >= $${paramIdx++}`; params.push(startDate); }
    if (endDate) { whereClause += ` AND r.created_at <= $${paramIdx++}`; params.push(endDate); }
    if (participantId) { whereClause += ` AND r.participant_id = $${paramIdx++}`; params.push(participantId); }
    
    const sessionsResult = await db.query(
      `SELECT r.session_id, r.participant_id, r.created_at, r.metadata,
              COUNT(v.id) as violation_count,
              ar.overall_score, ar.risk_level
       FROM recordings r
       LEFT JOIN violations v ON v.session_id = r.session_id AND v.tenant_id = r.tenant_id
       LEFT JOIN audit_reports ar ON ar.session_id = r.session_id AND ar.tenant_id = r.tenant_id
       ${whereClause}
       GROUP BY r.session_id, r.participant_id, r.created_at, r.metadata, ar.overall_score, ar.risk_level
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, Number(limit), offset]
    );
    
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT r.session_id) FROM recordings r ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    const sessions = sessionsResult.rows.map((r: any) => ({
      sessionId: r.session_id,
      participantId: r.participant_id,
      startTime: r.created_at,
      violationCount: parseInt(r.violation_count, 10),
      overallScore: r.overall_score || null,
      riskLevel: r.risk_level || null,
      status: 'completed'
    }));
    
    const totalViolations = sessions.reduce((sum: number, s: any) => sum + s.violationCount, 0);
    const scoresAvailable = sessions.filter((s: any) => s.overallScore !== null);
    const averageScore = scoresAvailable.length > 0
      ? scoresAvailable.reduce((sum: number, s: any) => sum + s.overallScore, 0) / scoresAvailable.length
      : null;
    
    res.json({
      success: true,
      sessions,
      summary: {
        totalSessions: total,
        averageScore,
        totalViolations
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  })
);

// Generate compliance report
router.get('/compliance',
  requirePermissions('admin:audit'),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, format = 'json' } = req.query;
    
    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }
    
    const db = getDb(req);
    const tenantId = req.user!.tenantId;
    
    const sessionsResult = await db.query(
      `SELECT COUNT(DISTINCT r.session_id) as total_sessions,
              COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN r.session_id END) as sessions_with_violations,
              AVG(ar.overall_score) as avg_score
       FROM recordings r
       LEFT JOIN violations v ON v.session_id = r.session_id AND v.tenant_id = r.tenant_id
       LEFT JOIN audit_reports ar ON ar.session_id = r.session_id AND ar.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 AND r.created_at >= $2 AND r.created_at <= $3`,
      [tenantId, startDate, endDate]
    );
    
    const violationsByType = await db.query(
      `SELECT v.violation_type, COUNT(*) as cnt
       FROM violations v
       JOIN recordings r ON r.session_id = v.session_id AND r.tenant_id = v.tenant_id
       WHERE v.tenant_id = $1 AND r.created_at >= $2 AND r.created_at <= $3
       GROUP BY v.violation_type`,
      [tenantId, startDate, endDate]
    );
    
    const stats = sessionsResult.rows[0];
    const totalSessions = parseInt(stats.total_sessions, 10);
    const sessionsWithViolations = parseInt(stats.sessions_with_violations, 10);
    
    const typeBreakdown: Record<string, number> = {};
    for (const r of violationsByType.rows) {
      typeBreakdown[r.violation_type] = parseInt(r.cnt, 10);
    }
    
    const complianceReport = {
      period: { start: startDate, end: endDate },
      tenantId,
      summary: {
        totalSessions,
        violationRate: totalSessions > 0 ? sessionsWithViolations / totalSessions : 0,
        averageScore: stats.avg_score ? Math.round(parseFloat(stats.avg_score)) : null,
        complianceScore: stats.avg_score ? Math.round(parseFloat(stats.avg_score)) : null
      },
      trends: {
        violationsByType: typeBreakdown
      },
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      report: complianceReport
    });
  })
);

export default router;