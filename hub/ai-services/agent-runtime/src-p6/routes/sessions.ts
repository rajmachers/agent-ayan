import { Router } from 'express';
import { AgentRequest } from '../types';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { executeQuery } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Get session details with agent status
router.get('/:sessionId', asyncHandler(async (req: AgentRequest, res) => {
  const { sessionId } = req.params;
  
  // Get session data from database
  const sessionQuery = `
    SELECT 
      s.id, s.external_id, s.delivery_id, s.candidate_id, s.room_id, 
      s.status, s.credibility_score, s.risk_level, s.started_at, s.ended_at,
      e.id as exam_id, e.title as exam_title, e.duration_min,
      c.id as candidate_user_id, c.first_name, c.last_name, c.email,
      COUNT(v.id) as violations_count
    FROM sessions s
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    JOIN candidates c ON s.candidate_id = c.id
    LEFT JOIN violations v ON s.id = v.session_id
    WHERE s.id = $1
    GROUP BY s.id, e.id, c.id
  `;
  
  const result = await executeQuery(sessionQuery, [sessionId]);
  
  if (result.rows.length === 0) {
    throw createError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  const sessionRow = result.rows[0];
  
  // Get agent status if exists
  const agentStatus = await req.agentManager.getAgentStatus(sessionId);
  
  // Get recent violations
  const violationsQuery = `
    SELECT 
      id, violation_code, violation_type, severity, confidence,
      description, created_at, metadata
    FROM violations
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `;
  
  const violationsResult = await executeQuery(violationsQuery, [sessionId]);
  
  res.json({
    success: true,
    data: {
      session: {
        id: sessionRow.id,
        externalId: sessionRow.external_id,
        deliveryId: sessionRow.delivery_id,
        candidateId: sessionRow.candidate_id,
        roomId: sessionRow.room_id,
        status: sessionRow.status,
        credibilityScore: sessionRow.credibility_score,
        riskLevel: sessionRow.risk_level,
        startedAt: sessionRow.started_at,
        endedAt: sessionRow.ended_at,
        exam: {
          id: sessionRow.exam_id,
          title: sessionRow.exam_title,
          durationMin: sessionRow.duration_min,
        },
        candidate: {
          id: sessionRow.candidate_user_id,
          firstName: sessionRow.first_name,
          lastName: sessionRow.last_name,
          email: sessionRow.email,
        },
        violationsCount: parseInt(sessionRow.violations_count),
      },
      agent: agentStatus,
      violations: violationsResult.rows.map(v => ({
        id: v.id,
        code: v.violation_code,
        type: v.violation_type,
        severity: v.severity,
        confidence: v.confidence,
        description: v.description,
        createdAt: v.created_at,
        metadata: v.metadata,
      })),
    },
  });
}));

// Get session analytics/statistics
router.get('/:sessionId/analytics', asyncHandler(async (req: AgentRequest, res) => {
  const { sessionId } = req.params;
  
  // Get violation statistics
  const violationStatsQuery = `
    SELECT 
      violation_type,
      COUNT(*) as count,
      AVG(confidence) as avg_confidence,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
      COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
      COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
      COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count
    FROM violations
    WHERE session_id = $1
    GROUP BY violation_type
  `;
  
  const violationStats = await executeQuery(violationStatsQuery, [sessionId]);
  
  // Get timeline data (violations per hour)
  const timelineQuery = `
    SELECT 
      DATE_TRUNC('hour', created_at) as hour,
      COUNT(*) as violations_count
    FROM violations
    WHERE session_id = $1
    GROUP BY hour
    ORDER BY hour
  `;
  
  const timelineData = await executeQuery(timelineQuery, [sessionId]);
  
  // Get agent performance data if agent exists
  const agent = req.agentManager.getAgent(sessionId);
  const agentMetrics = agent ? agent.getStatus().metrics : null;
  
  res.json({
    success: true,
    data: {
      sessionId,
      violationStatistics: violationStats.rows,
      timeline: timelineData.rows,
      agentMetrics,
      summary: {
        totalViolations: violationStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        violationTypes: violationStats.rows.length,
        avgConfidence: violationStats.rows.length > 0 
          ? violationStats.rows.reduce((sum, row) => sum + parseFloat(row.avg_confidence), 0) / violationStats.rows.length
          : 0,
        criticalViolations: violationStats.rows.reduce((sum, row) => sum + parseInt(row.critical_count), 0),
      },
    },
  });
}));

// Get session violations with filtering and pagination
router.get('/:sessionId/violations', asyncHandler(async (req: AgentRequest, res) => {
  const { sessionId } = req.params;
  const {
    type,
    severity,
    confidence,
    page = '1',
    limit = '25',
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = req.query;
  
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  
  let whereClause = 'WHERE session_id = $1';
  const params = [sessionId];
  let paramIndex = 2;
  
  if (type) {
    whereClause += ` AND violation_type = $${paramIndex}`;
    params.push(type as string);
    paramIndex++;
  }
  
  if (severity) {
    whereClause += ` AND severity = $${paramIndex}`;
    params.push(severity as string);
    paramIndex++;
  }
  
  if (confidence) {
    const minConfidence = parseFloat(confidence as string);
    whereClause += ` AND confidence >= $${paramIndex}`;
    params.push(minConfidence.toString());
    paramIndex++;
  }
  
  const query = `
    SELECT 
      id, violation_code, violation_type, severity, confidence,
      description, created_at, metadata, score_impact
    FROM violations
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  
  params.push(limit as string, offset.toString());
  
  const result = await executeQuery(query, params);
  
  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM violations ${whereClause}`;
  const countResult = await executeQuery(countQuery, params.slice(0, paramIndex - 2));
  const total = parseInt(countResult.rows[0].total);
  
  res.json({
    success: true,
    data: {
      violations: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    },
  });
}));

export default router;