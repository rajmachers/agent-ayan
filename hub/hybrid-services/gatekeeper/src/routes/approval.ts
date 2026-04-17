/**
 * Approval Management Routes - Phase 7 Gatekeeper Service
 * REQ-038: Pre-Flight controls: [Watch Live] [Capture ID] [Approve] [Reject with Reason]
 */
import express, { Request, Response, Router } from 'express';

const router: Router = express.Router();

// Get pending approval queue
router.get('/queue', async (req: any, res: Response) => {
  try {
    const sessionIds = await req.redis.lrange('gatekeeper:pending_approval', 0, -1);
    const pendingSessions = [];

    for (const sessionId of sessionIds) {
      const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
      if (sessionData && sessionData.candidateId) {
        // Get verification results if available
        const verificationResults = sessionData.verificationResults 
          ? JSON.parse(sessionData.verificationResults) 
          : null;

        pendingSessions.push({
          sessionId,
          candidateId: sessionData.candidateId,
          proctorId: sessionData.proctorId,
          entryState: sessionData.entryState,
          verificationFlag: sessionData.verificationFlag,
          documentCount: parseInt(sessionData.documentCount) || 0,
          createdAt: sessionData.createdAt,
          updatedAt: sessionData.updatedAt,
          examId: sessionData.examId,
          verificationSummary: verificationResults ? {
            totalDocuments: verificationResults.length,
            highRisk: verificationResults.filter((r: any) => r.risk === 'HIGH').length,
            mediumRisk: verificationResults.filter((r: any) => r.risk === 'MEDIUM').length,
            lowRisk: verificationResults.filter((r: any) => r.risk === 'LOW').length,
            averageConfidence: verificationResults.reduce((sum: number, r: any) => sum + r.confidence, 0) / verificationResults.length
          } : null
        });
      }
    }

    // Sort by priority (verification flag and time)
    pendingSessions.sort((a, b) => {
      const flagPriority = { 'RED': 0, 'AMBER': 1, 'GREEN': 2, 'PENDING': 3 };
      const aPriority = flagPriority[a.verificationFlag as keyof typeof flagPriority] || 9;
      const bPriority = flagPriority[b.verificationFlag as keyof typeof flagPriority] || 9;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // If same priority, sort by creation time (oldest first)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    res.json({
      pendingApprovals: pendingSessions,
      count: pendingSessions.length,
      priorityBreakdown: {
        red: pendingSessions.filter(s => s.verificationFlag === 'RED').length,
        amber: pendingSessions.filter(s => s.verificationFlag === 'AMBER').length,
        green: pendingSessions.filter(s => s.verificationFlag === 'GREEN').length,
        pending: pendingSessions.filter(s => s.verificationFlag === 'PENDING').length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Approval queue error:', error);
    res.status(500).json({ 
      error: 'Failed to get approval queue',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Approve candidate entry
router.post('/approve/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { proctorId, notes } = req.body;

    if (!proctorId) {
      return res.status(400).json({
        error: 'proctorId is required for approval',
        service: 'gatekeeper-service-p7'
      });
    }

    const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    if (!sessionData || !sessionData.candidateId) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Update session to approved state
    await req.redis.hset(`gatekeeper:session:${sessionId}`, {
      entryState: 'APPROVED',
      approvedBy: proctorId,
      approvedAt: new Date().toISOString(),
      approvalNotes: notes || '',
      updatedAt: new Date().toISOString()
    });

    // Remove from pending approval queue
    await req.redis.lrem('gatekeeper:pending_approval', 1, sessionId);
    
    // Add to approved sessions (for tracking)
    await req.redis.lpush('gatekeeper:approved_sessions', sessionId);
    await req.redis.expire('gatekeeper:approved_sessions', 86400); // 24 hours

    // Create exam session in main database
    await req.db.query(`
      INSERT INTO exam_sessions (session_id, candidate_id, proctor_id, status, model, created_at)
      VALUES ($1, $2, $3, 'active', 'advanced', NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        status = 'active',
        proctor_id = $3,
        updated_at = NOW()
    `, [sessionId, sessionData.candidateId, proctorId]);

    // Clear candidate's active session marker (they're now in exam)
    await req.redis.del(`candidate:${sessionData.candidateId}:active_session`);

    req.logger.info('Candidate entry approved', {
      sessionId,
      candidateId: sessionData.candidateId,
      proctorId,
      verificationFlag: sessionData.verificationFlag
    });

    res.json({
      message: 'Candidate entry approved successfully',
      approval: {
        sessionId,
        candidateId: sessionData.candidateId,
        proctorId,
        approvedAt: new Date().toISOString(),
        notes
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Approval error:', error);
    res.status(500).json({ 
      error: 'Failed to approve candidate entry',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Reject candidate entry
router.post('/reject/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { proctorId, reason, notes } = req.body;

    if (!proctorId || !reason) {
      return res.status(400).json({
        error: 'proctorId and reason are required for rejection',
        service: 'gatekeeper-service-p7'
      });
    }

    const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    if (!sessionData || !sessionData.candidateId) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Update session to rejected state
    await req.redis.hset(`gatekeeper:session:${sessionId}`, {
      entryState: 'REJECTED',
      rejectedBy: proctorId,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      rejectionNotes: notes || '',
      updatedAt: new Date().toISOString()
    });

    // Remove from pending approval queue
    await req.redis.lrem('gatekeeper:pending_approval', 1, sessionId);
    
    // Add to rejected sessions (for audit)
    await req.redis.lpush('gatekeeper:rejected_sessions', sessionId);
    await req.redis.expire('gatekeeper:rejected_sessions', 604800); // 7 days

    // Clear candidate's active session marker
    await req.redis.del(`candidate:${sessionData.candidateId}:active_session`);

    req.logger.info('Candidate entry rejected', {
      sessionId,
      candidateId: sessionData.candidateId,
      proctorId,
      reason,
      verificationFlag: sessionData.verificationFlag
    });

    res.json({
      message: 'Candidate entry rejected',
      rejection: {
        sessionId,
        candidateId: sessionData.candidateId,
        proctorId,
        reason,
        rejectedAt: new Date().toISOString(),
        notes
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Rejection error:', error);
    res.status(500).json({ 
      error: 'Failed to reject candidate entry',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Assign proctor to session
router.post('/assign/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { proctorId } = req.body;

    if (!proctorId) {
      return res.status(400).json({
        error: 'proctorId is required',
        service: 'gatekeeper-service-p7'
      });
    }

    // Transition session to approval queue
    const success = await req.gatekeeperService.transitionToApprovalQueue(sessionId, proctorId);
    
    if (!success) {
      return res.status(404).json({ 
        error: 'Session not found or cannot be assigned',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    res.json({
      message: 'Proctor assigned to session successfully',
      assignment: {
        sessionId,
        proctorId,
        assignedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Proctor assignment error:', error);
    res.status(500).json({ 
      error: 'Failed to assign proctor',
      service: 'gatekeeper-service-p7'
    });
  }
});

export default router;