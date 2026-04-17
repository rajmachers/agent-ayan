/**
 * Supervisory Access Routes - Phase 7 Ghost Proctor Service
 * REQ-042: "Ghost" proctor assigned during exam scheduling, can access any session of any proctor
 */
import express, { Request, Response } from 'express';

const router = express.Router();

// Get all active sessions for supervisory oversight
router.get('/sessions', async (req: any, res: Response) => {
  try {
    const { proctorId, status, limit = 50, offset = 0 } = req.query;

    // Build query for active sessions
    let query = `
      SELECT 
        es.session_id,
        es.candidate_id,
        es.proctor_id,
        es.status,
        es.model,
        es.created_at,
        es.updated_at,
        es.violations_count,
        pr.name as proctor_name,
        pr.email as proctor_email
      FROM exam_sessions es
      LEFT JOIN proctors pr ON es.proctor_id = pr.proctor_id
      WHERE es.status IN ('active', 'paused', 'under_review')
    `;

    const queryParams = [];
    let paramCount = 0;

    if (proctorId) {
      paramCount++;
      query += ` AND es.proctor_id = $${paramCount}`;
      queryParams.push(proctorId);
    }

    if (status) {
      paramCount++;
      query += ` AND es.status = $${paramCount}`;
      queryParams.push(status);
    }

    query += ` ORDER BY es.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit as string), parseInt(offset as string));

    const sessionsResult = await req.db.query(query, queryParams);

    // Enhance session data with real-time information from Redis
    const sessions = [];
    for (const session of sessionsResult.rows) {
      // Get session state from Gatekeeper service
      const gatekeeperState = await req.redis.hgetall(`gatekeeper:session:${session.session_id}`);
      
      // Get current violations from Redis
      const violationsCount = await req.redis.get(`session:${session.session_id}:violations:count`) || '0';
      
      // Get proctor performance data
      const proctorPerf = await req.redis.hgetall(`proctor:${session.proctor_id}:performance`);

      sessions.push({
        sessionId: session.session_id,
        candidateId: session.candidate_id,
        proctorId: session.proctor_id,
        proctorName: session.proctor_name,
        proctorEmail: session.proctor_email,
        status: session.status,
        model: session.model,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        realTime: {
          entryState: gatekeeperState.entryState,
          verificationFlag: gatekeeperState.verificationFlag,
          violationsCount: parseInt(violationsCount),
          streamStatus: gatekeeperState.streamStatus
        },
        proctorPerformance: proctorPerf.classification ? {
          classification: proctorPerf.classification,
          efficiencyRank: parseFloat(proctorPerf.efficiencyRank) || 0,
          averageApprovalTime: parseFloat(proctorPerf.averageApprovalTime) || 0
        } : null
      });
    }

    res.json({
      sessions,
      pagination: {
        total: sessions.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      supervisory: {
        accessLevel: 'ghost',
        accessTime: new Date().toISOString()
      }
    });

  } catch (error) {
    req.logger.error('Supervisory session access error:', error);
    res.status(500).json({
      error: 'Failed to get supervisory session data',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get detailed session information for ghost proctor access
router.get('/session/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { ghostProctorId } = req.query;

    // Get session details from database
    const sessionQuery = await req.db.query(`
      SELECT 
        es.*,
        pr.name as proctor_name,
        pr.email as proctor_email,
        c.name as candidate_name,
        c.email as candidate_email
      FROM exam_sessions es
      LEFT JOIN proctors pr ON es.proctor_id = pr.proctor_id
      LEFT JOIN candidates c ON es.candidate_id = c.candidate_id
      WHERE es.session_id = $1
    `, [sessionId]);

    if (sessionQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId,
        service: 'ghost-proctor-service-p7'
      });
    }

    const session = sessionQuery.rows[0];

    // Get comprehensive real-time data
    const gatekeeperState = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    const [
      violationsData,
      streamData,
      credibilityData,
      proctorPerformance
    ] = await Promise.all([
      req.redis.lrange(`session:${sessionId}:violations`, 0, -1),
      req.redis.hgetall(`stream:${(gatekeeperState as any)?.streamId || 'unknown'}`),
      req.redis.hgetall(`candidate:${session.candidate_id}:credibility`),
      req.redis.hgetall(`proctor:${session.proctor_id}:performance`)
    ]);

    // Parse violations data
    const violations = violationsData.map(v => {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Log ghost proctor access
    await req.redis.lpush(`ghost:access:${sessionId}`, JSON.stringify({
      ghostProctorId,
      timestamp: new Date().toISOString(),
      action: 'session_access',
      sessionId,
      originalProctorId: session.proctor_id
    }));
    await req.redis.expire(`ghost:access:${sessionId}`, 7200); // 2 hours

    res.json({
      session: {
        sessionId: session.session_id,
        candidateId: session.candidate_id,
        candidateName: session.candidate_name,
        candidateEmail: session.candidate_email,
        proctorId: session.proctor_id,
        proctorName: session.proctor_name,
        proctorEmail: session.proctor_email,
        status: session.status,
        model: session.model,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        violationsCount: session.violations_count
      },
      realTimeData: {
        gatekeeper: {
          entryState: gatekeeperState.entryState,
          verificationFlag: gatekeeperState.verificationFlag,
          approvedBy: gatekeeperState.approvedBy,
          approvedAt: gatekeeperState.approvedAt
        },
        stream: streamData.streamId ? {
          streamId: streamData.streamId,
          status: streamData.status,
          streamUrl: streamData.streamUrl,
          viewUrl: streamData.viewUrl,
          quality: streamData.quality ? JSON.parse(streamData.quality) : null
        } : null,
        violations: violations.slice(-10), // Last 10 violations
        credibility: credibilityData.overallScore ? {
          overallScore: parseFloat(credibilityData.overallScore),
          riskLevel: credibilityData.riskLevel,
          factors: JSON.parse(credibilityData.factors || '{}'),
          detectionReasons: JSON.parse(credibilityData.detectionReasons || '[]')
        } : null
      },
      proctorPerformance: proctorPerformance.classification ? {
        classification: proctorPerformance.classification,
        efficiencyRank: parseFloat(proctorPerformance.efficiencyRank) || 0,
        averageApprovalTime: parseFloat(proctorPerformance.averageApprovalTime) || 0,
        accuracyScore: parseFloat(proctorPerformance.accuracyScore) || 0,
        sessionCount: parseInt(proctorPerformance.sessionCount) || 0
      } : null,
      supervisoryAccess: {
        ghostProctorId,
        accessTime: new Date().toISOString(),
        accessType: 'detailed_review'
      }
    });

  } catch (error) {
    req.logger.error('Ghost proctor session access error:', error);
    res.status(500).json({
      error: 'Failed to access session details',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get all proctors and their current workload for oversight
router.get('/proctors', async (req: any, res: Response) => {
  try {
    // Get all proctors from database
    const proctorsQuery = await req.db.query(`
      SELECT 
        proctor_id,
        name,
        email,
        phone,
        status,
        created_at,
        last_login_at
      FROM proctors
      WHERE status IN ('active', 'available')
      ORDER BY name
    `);

    const proctors = [];
    for (const proctor of proctorsQuery.rows) {
      // Get real-time capacity and performance data
      const [capacityData, performanceData] = await Promise.all([
        req.redis.hgetall(`proctor:${proctor.proctor_id}:capacity`),
        req.redis.hgetall(`proctor:${proctor.proctor_id}:performance`)
      ]);

      // Get current active sessions
      const activeSessionsQuery = await req.db.query(`
        SELECT session_id, candidate_id, created_at, status
        FROM exam_sessions 
        WHERE proctor_id = $1 AND status IN ('active', 'paused')
        ORDER BY created_at DESC
      `, [proctor.proctor_id]);

      const maxConcurrent = parseInt(capacityData.max_concurrent) || 5;
      const currentLoad = parseInt(capacityData.current_load) || 0;
      const utilizationRate = maxConcurrent > 0 ? (currentLoad / maxConcurrent * 100).toFixed(1) : '0.0';

      proctors.push({
        proctorId: proctor.proctor_id,
        name: proctor.name,
        email: proctor.email,
        phone: proctor.phone,
        status: proctor.status,
        createdAt: proctor.created_at,
        lastLoginAt: proctor.last_login_at,
        capacity: {
          maxConcurrent,
          currentLoad,
          utilizationRate: `${utilizationRate}%`,
          available: maxConcurrent - currentLoad > 0
        },
        performance: performanceData.classification ? {
          classification: performanceData.classification,
          efficiencyRank: parseFloat(performanceData.efficiencyRank) || 0,
          averageApprovalTime: parseFloat(performanceData.averageApprovalTime) || 0,
          accuracyScore: parseFloat(performanceData.accuracyScore) || 0,
          sessionCount: parseInt(performanceData.sessionCount) || 0,
          throughputRate: parseFloat(performanceData.throughputRate) || 0
        } : null,
        activeSessions: activeSessionsQuery.rows.map(s => ({
          sessionId: s.session_id,
          candidateId: s.candidate_id,
          createdAt: s.created_at,
          status: s.status
        }))
      });
    }

    // Sort by efficiency rank (Super proctors first)
    proctors.sort((a, b) => {
      const aRank = a.performance?.efficiencyRank || 0;
      const bRank = b.performance?.efficiencyRank || 0;
      return bRank - aRank;
    });

    res.json({
      proctors,
      summary: {
        totalProctors: proctors.length,
        superProctors: proctors.filter(p => p.performance?.classification === 'super').length,
        standardProctors: proctors.filter(p => p.performance?.classification === 'standard').length,
        slowProctors: proctors.filter(p => p.performance?.classification === 'slow').length,
        totalCapacity: proctors.reduce((sum, p) => sum + p.capacity.maxConcurrent, 0),
        totalLoad: proctors.reduce((sum, p) => sum + p.capacity.currentLoad, 0)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Proctor oversight error:', error);
    res.status(500).json({
      error: 'Failed to get proctor oversight data',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Take supervisory action on a session (ghost proctor intervention)
router.post('/intervention/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { ghostProctorId, action, reason, notes } = req.body;

    if (!ghostProctorId || !action) {
      return res.status(400).json({
        error: 'ghostProctorId and action are required',
        service: 'ghost-proctor-service-p7'
      });
    }

    // Validate session exists and is active
    const sessionQuery = await req.db.query(`
      SELECT * FROM exam_sessions WHERE session_id = $1
    `, [sessionId]);

    if (sessionQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId,
        service: 'ghost-proctor-service-p7'
      });
    }

    const session = sessionQuery.rows[0];
    const interventionId = require('uuid').v4();

    // Record the intervention
    const intervention = {
      interventionId,
      sessionId,
      ghostProctorId,
      originalProctorId: session.proctor_id,
      action,
      reason: reason || 'Ghost proctor supervisory action',
      notes: notes || '',
      timestamp: new Date().toISOString()
    };

    // Store intervention record
    await req.redis.hset(`intervention:${interventionId}`, intervention);
    await req.redis.expire(`intervention:${interventionId}`, 86400); // 24 hours

    // Add to intervention log for session
    await req.redis.lpush(`session:${sessionId}:interventions`, JSON.stringify(intervention));
    await req.redis.expire(`session:${sessionId}:interventions`, 86400);

    // Notify via WebSocket
    req.io.to(`session_${sessionId}`).emit('ghost_intervention', {
      type: 'supervisory_action',
      intervention,
      timestamp: new Date().toISOString()
    });

    // Update session if needed based on action
    if (action === 'pause') {
      await req.db.query(`
        UPDATE exam_sessions 
        SET status = 'paused', updated_at = NOW()
        WHERE session_id = $1
      `, [sessionId]);
    } else if (action === 'reassign') {
      await req.db.query(`
        UPDATE exam_sessions 
        SET proctor_id = $1, updated_at = NOW()
        WHERE session_id = $2
      `, [ghostProctorId, sessionId]);
    }

    req.logger.info('Ghost proctor intervention recorded', {
      sessionId,
      ghostProctorId,
      action,
      originalProctorId: session.proctor_id
    });

    res.json({
      message: 'Supervisory intervention recorded successfully',
      intervention: {
        interventionId,
        sessionId,
        ghostProctorId,
        action,
        timestamp: intervention.timestamp
      }
    });

  } catch (error) {
    req.logger.error('Ghost proctor intervention error:', error);
    res.status(500).json({
      error: 'Failed to record supervisory intervention',
      service: 'ghost-proctor-service-p7'
    });
  }
});

export default router;