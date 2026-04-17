/**
 * Entry Management Routes - Phase 7 Gatekeeper Service
 * REQ-025: Multi-Stage Entry Protocol with candidate waiting room
 */
import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router();

// Initiate candidate entry into waiting room
router.post('/initiate', async (req: any, res: Response) => {
  try {
    const { candidateId, examId, tenantId } = req.body;

    if (!candidateId || !examId || !tenantId) {
      return res.status(400).json({ 
        error: 'candidateId, examId, and tenantId are required',
        service: 'gatekeeper-service-p7'
      });
    }

    // Check if candidate already has an active session
    const existingSession = await req.redis.get(`candidate:${candidateId}:active_session`);
    if (existingSession) {
      return res.status(409).json({
        error: 'Candidate already has an active session',
        sessionId: existingSession,
        service: 'gatekeeper-service-p7'
      });
    }

    // Create new session via service
    const session = await req.gatekeeperService.initiateCandidateEntry(candidateId, examId);
    
    // Mark candidate as having active session
    await req.redis.set(`candidate:${candidateId}:active_session`, session.sessionId, 'EX', 3600); // 1 hour expiry

    res.status(201).json({
      message: 'Candidate entry initiated successfully',
      session: {
        sessionId: session.sessionId,
        candidateId: session.candidateId,
        entryState: session.entryState,
        verificationFlag: session.verificationFlag,
        createdAt: session.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Entry initiation error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate candidate entry',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Get waiting room status
router.get('/waiting-room', async (req: any, res: Response) => {
  try {
    const sessionIds = await req.redis.lrange('gatekeeper:waiting_room', 0, -1);
    const sessions = [];

    for (const sessionId of sessionIds) {
      const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
      if (sessionData && sessionData.candidateId) {
        sessions.push({
          sessionId,
          candidateId: sessionData.candidateId,
          entryState: sessionData.entryState,
          verificationFlag: sessionData.verificationFlag,
          createdAt: sessionData.createdAt,
          examId: sessionData.examId
        });
      }
    }

    res.json({
      waitingRoom: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Waiting room status error:', error);
    res.status(500).json({ 
      error: 'Failed to get waiting room status',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Get session status
router.get('/session/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    if (!sessionData || !sessionData.candidateId) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    res.json({
      session: {
        sessionId,
        candidateId: sessionData.candidateId,
        entryState: sessionData.entryState,
        verificationFlag: sessionData.verificationFlag,
        proctorId: sessionData.proctorId,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        examId: sessionData.examId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Session status error:', error);
    res.status(500).json({ 
      error: 'Failed to get session status',
      service: 'gatekeeper-service-p7'
    });
  }
});

export default router;