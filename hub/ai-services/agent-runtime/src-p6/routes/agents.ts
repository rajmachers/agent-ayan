import { Router, Request } from 'express';
import { AgentRequest } from '../types';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router: Router = Router();

// Start agent for a session
router.post('/start', asyncHandler(async (req: Request & { agentManager: any }, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    throw createError('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  logger.info('Starting agent for session', { sessionId });
  
  try {
    const agentId = await req.agentManager.startAgent(sessionId);
    
    res.status(201).json({
      success: true,
      data: {
        agentId,
        sessionId,
        status: 'starting',
      },
    });
  } catch (error) {
    logger.error('Failed to start agent', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    
    throw createError('Failed to start agent', 500, 'AGENT_START_FAILED');
  }
}));

// Stop agent for a session
router.post('/stop', asyncHandler(async (req: AgentRequest, res) => {
  const { sessionId, reason } = req.body;
  
  if (!sessionId) {
    throw createError('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  logger.info('Stopping agent for session', { sessionId, reason });
  
  try {
    await req.agentManager.stopAgent(sessionId, reason);
    
    res.json({
      success: true,
      data: {
        sessionId,
        status: 'stopped',
      },
    });
  } catch (error) {
    logger.error('Failed to stop agent', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw createError('Failed to stop agent', 500, 'AGENT_STOP_FAILED');
  }
}));

// Get agent status for a session
router.get('/status/:sessionId', asyncHandler(async (req: AgentRequest, res) => {
  const { sessionId } = req.params;
  
  const status = await req.agentManager.getAgentStatus(sessionId);
  
  if (!status) {
    throw createError('Agent not found for session', 404, 'AGENT_NOT_FOUND');
  }

  res.json({
    success: true,
    data: status,
  });
}));

// Get agent by ID
router.get('/:agentId', asyncHandler(async (req: AgentRequest, res) => {
  const { agentId } = req.params;
  
  const agent = req.agentManager.getAgentById(agentId);
  
  if (!agent) {
    throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
  }

  const status = agent.getStatus();
  const sessionData = agent.getSessionData();

  res.json({
    success: true,
    data: {
      agent: {
        id: agentId,
        sessionId: sessionData.id,
        roomId: sessionData.room_id,
        status: status.status,
        uptime: status.uptime_seconds,
        lastHeartbeat: status.last_heartbeat,
      },
      session: {
        id: sessionData.id,
        externalId: sessionData.external_id,
        candidateId: sessionData.candidate_id,
        status: sessionData.status,
        credibilityScore: sessionData.credibility_score,
        riskLevel: sessionData.risk_level,
        startedAt: sessionData.started_at,
      },
      processing: status.processing_status,
      metrics: status.metrics,
    },
  });
}));

// List all agents
router.get('/', asyncHandler(async (req: AgentRequest, res) => {
  const agents = req.agentManager.getAllAgents();
  
  const agentList = agents.map(agent => {
    const status = agent.getStatus();
    const sessionData = agent.getSessionData();
    
    return {
      id: agent.getId(),
      sessionId: sessionData.id,
      roomId: sessionData.room_id,
      status: status.status,
      participantCount: status.participant_count,
      uptime: status.uptime_seconds,
      violationsDetected: status.metrics.violations_detected,
      lastHeartbeat: status.last_heartbeat,
    };
  });

  res.json({
    success: true,
    data: {
      agents: agentList,
      total: agentList.length,
      active: req.agentManager.getActiveAgentCount(),
    },
  });
}));

// Force restart agent
router.post('/:agentId/restart', asyncHandler(async (req: AgentRequest, res) => {
  const { agentId } = req.params;
  const { reason } = req.body;
  
  const agent = req.agentManager.getAgentById(agentId);
  
  if (!agent) {
    throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
  }

  const sessionData = agent.getSessionData();
  const sessionId = sessionData.id;
  
  logger.info('Restarting agent', { agentId, sessionId, reason });
  
  try {
    // Stop existing agent
    await req.agentManager.stopAgent(sessionId, reason || 'Manual restart');
    
    // Start new agent
    const newAgentId = await req.agentManager.startAgent(sessionId);
    
    res.json({
      success: true,
      data: {
        oldAgentId: agentId,
        newAgentId,
        sessionId,
        status: 'restarting',
      },
    });
  } catch (error) {
    logger.error('Failed to restart agent', {
      agentId,
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw createError('Failed to restart agent', 500, 'AGENT_RESTART_FAILED');
  }
}));

export default router;