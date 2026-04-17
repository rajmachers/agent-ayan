import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';

// Basic configuration
const config = {
  server: {
    port: process.env['PORT'] || 4101,
    host: process.env['HOST'] || '0.0.0.0'
  },
  env: process.env['NODE_ENV'] || 'development',
  cors: {
    origins: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3103', 'http://localhost:3105', 'http://localhost:4000']
  },
  services: {
    apiGateway: 'http://localhost:4000',
    tenantService: 'http://localhost:3002',
    aiVision: 'http://localhost:5000',
    aiAudio: 'http://localhost:5001', 
    aiBehavior: 'http://localhost:5002',
    ruleEngine: 'http://localhost:5003',
    scoringEngine: 'http://localhost:5004'
  }
};

// Basic logger
const logger = {
  info: (msg: string, meta?: any) => console.log(`[CONTROL-PLANE] ${msg}`, meta || ''),
  error: (msg: string, error?: any) => console.error(`[CONTROL-PLANE] ERROR: ${msg}`, error || ''),
  warn: (msg: string, meta?: any) => console.warn(`[CONTROL-PLANE] WARN: ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.debug(`[CONTROL-PLANE] DEBUG: ${msg}`, meta || '')
};

const app = express() as Application;
const server = createServer(app);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Session storage (in-memory for demo)
const sessions: Map<string, any> = new Map();
const activeAgents: Map<string, any> = new Map();

// Basic auth middleware
const basicAuth = (req: Request, res: Response, next: any) => {
  const apiKey = req.header('X-API-Key');
  const authHeader = req.header('Authorization');
  
  if (apiKey || authHeader) {
    (req as any).user = {
      id: 'demo-user-123',
      orgId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94',
      role: 'admin'
    };
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const servicesHealth = {
    apiGateway: 'unknown',
    tenantService: 'unknown', 
    aiVision: 'unknown',
    aiAudio: 'unknown',
    aiBehavior: 'unknown',
    ruleEngine: 'unknown',
    scoringEngine: 'unknown'
  };
  
  res.json({
    service: 'Ayan.ai Control Plane',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.env,
    activeSessionsCount: sessions.size,
    activeAgentsCount: activeAgents.size,
    servicesHealth,
    checks: {
      server: 'ok',
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Ayan.ai Control Plane',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
    description: 'Central orchestration service for AI proctoring sessions',
    capabilities: [
      'Session lifecycle management',
      'AI agent coordination',
      'Real-time monitoring orchestration',
      'Service health monitoring',
      'Event distribution'
    ],
    endpoints: {
      sessions: 'POST /api/v1/sessions - Create proctoring session',
      sessionControl: 'POST /api/v1/sessions/:sessionId/control - Control session',
      agents: 'GET /api/v1/agents - List active agents',
      events: 'GET /api/v1/events/:sessionId - Session event stream',
      debug_clearSessions: 'POST /api/v1/debug/clear-sessions - Clear all sessions (DEBUG ONLY)'
    }
  });
});

// Debug endpoint to clear all sessions
app.post('/api/v1/debug/clear-sessions', (req: Request, res: Response) => {
  const clearedCount = sessions.size;
  sessions.clear();
  activeAgents.clear();
  
  logger.warn(`[DEBUG] Cleared ${clearedCount} sessions and ${activeAgents.size} agents`);
  
  res.json({
    success: true,
    message: `Cleared ${clearedCount} sessions`,
    timestamp: new Date().toISOString(),
    remaining: {
      sessions: sessions.size,
      agents: activeAgents.size
    }
  });
});

// Create and orchestrate a new proctoring session
// Accepts both single candidate and full simulator session data
app.post('/api/v1/sessions', basicAuth, async (req: Request, res: Response) => {
  const { candidateId, examId, organizationId, examConfig, tenantId, tenantName, batchId, examType, scenario, candidates } = req.body;
  const user = (req as any).user;
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('Creating new proctoring session', { sessionId, candidateId, examId, tenantId, orgId: user.orgId, candidatesCount: candidates?.length });
  
  // Mock session configuration based on organization
  const sessionConfig = {
    aiServices: {
      vision: { 
        enabled: true,
        features: ['face_detection', 'eye_tracking', 'head_pose', 'multiple_person_detection'],
        sensitivity: 'medium',
        alerts: ['face_not_detected', 'multiple_faces', 'looking_away_extended']
      },
      audio: {
        enabled: true, 
        features: ['background_noise', 'multiple_voices', 'suspicious_sounds'], 
        sensitivity: 'medium',
        alerts: ['loud_background_noise', 'multiple_voices_detected', 'suspicious_audio']
      },
      behavior: {
        enabled: true,
        features: ['typing_pattern', 'screen_interaction', 'tab_switching'],
        sensitivity: 'medium', 
        alerts: ['unusual_typing', 'excessive_tab_switches', 'copy_paste_detected']
      }
    },
    rules: {
      autoTerminate: false,
      maxViolations: 5,
      warningThreshold: 3,
      recordingRequired: true,
      identityVerification: true
    },
    notifications: {
      realTime: true,
      webhookUrl: null,
      emailAlerts: true
    }
  };
  
  // Create session record
  const session = {
    sessionId,
    candidateId: candidateId || null,
    examId: examId || null,
    tenantId: tenantId || null,
    tenantName: tenantName || 'Unknown',
    batchId: batchId || null,
    examType: examType || null,
    scenario: scenario || null,
    organizationId: user.orgId,
    status: 'initializing',
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    config: sessionConfig,
    candidates: candidates || [], // Store full candidate data from simulator
    aiAgents: {
      vision: { status: 'pending', agentId: null, lastUpdate: null },
      audio: { status: 'pending', agentId: null, lastUpdate: null },
      behavior: { status: 'pending', agentId: null, lastUpdate: null }
    },
    violations: [],
    events: [],
    score: {
      current: 100,
      credibilityIndex: 1.0,
      riskLevel: 'none',
      factors: {}
    },
    recordingInfo: {
      status: 'pending',
      recordingId: null,
      segments: []
    }
  };
  
  sessions.set(sessionId, session);
  
  // Simulate AI agent deployment
  setTimeout(() => {
    logger.info('Deploying AI agents for session', { sessionId });
    
    // Mock agent deployment
    const agents = ['vision', 'audio', 'behavior'];
    agents.forEach(agentType => {
      const agentId = `${agentType}_agent_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      session.aiAgents[agentType] = {
        status: 'active',
        agentId,
        lastUpdate: new Date().toISOString(),
        healthScore: 0.95 + Math.random() * 0.05,
        processedEvents: 0
      };
      
      activeAgents.set(agentId, {
        agentId,
        type: agentType,
        sessionId,
        status: 'active',
        startedAt: new Date().toISOString(),
        metrics: {
          eventsProcessed: 0,
          averageProcessingTime: 45 + Math.random() * 30, // ms
          successRate: 0.98 + Math.random() * 0.02
        }
      });
      
      logger.info(`AI agent deployed: ${agentType}`, { sessionId, agentId });
    });
    
    session.status = 'active';
    session.startedAt = new Date().toISOString();
    
    // Simulate some initial events
    session.events.push({
      timestamp: new Date().toISOString(),
      type: 'session_started',
      severity: 'info',
      source: 'control_plane',
      message: 'Proctoring session initialized successfully'
    });
    
    session.events.push({
      timestamp: new Date().toISOString(),
      type: 'ai_agents_deployed',
      severity: 'success', 
      source: 'control_plane',
      message: 'All AI monitoring agents are active and ready'
    });
    
    logger.info('Session fully initialized', { sessionId, agentCount: agents.length });
  }, 2000); // 2 second delay to simulate deployment
  
  res.json({
    success: true,
    sessionId,
    session: {
      sessionId,
      status: session.status,
      candidateId,
      examId,
      organizationId: user.orgId,
      config: sessionConfig,
      createdAt: session.createdAt,
      estimatedDeploymentTime: '2-3 seconds'
    },
    message: 'Proctoring session is being initialized. AI agents will be deployed shortly.'
  });
});

// Get session status and details
app.get('/api/v1/sessions/:sessionId', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found', sessionId });
  }
  
  // Calculate real-time metrics
  const currentTime = new Date();
  const startTime = session.startedAt ? new Date(session.startedAt) : currentTime;
  const durationMs = currentTime.getTime() - startTime.getTime();
  
  // Simulate realistic violations per session (varied counts)
  if (session.status === 'active' && !session.violationsInitialized) {
    // Generate variable violation counts per session
    const sessionHash = session.sessionId.split('_').pop() || '1';
    const violationCount = parseInt(sessionHash) % 5; // 0-4 violations per session
    
    const mockViolations = [];
    for (let i = 0; i < violationCount; i++) {
      const violationType = ['background_noise', 'tab_focus_lost', 'gaze_deviation', 'multiple_persons', 'suspicious_movement'][i % 5];
      const severity = ['warning', 'info', 'critical'][Math.floor(Math.random() * 3)];
      
      mockViolations.push({
        id: `v_${session.sessionId}_${i}`,
        type: violationType,
        severity: severity,
        timestamp: new Date(Date.now() - (120000 * (i + 1))).toISOString(),
        source: ['ai_audio', 'ai_behavior', 'ai_vision'][Math.floor(Math.random() * 3)],
        description: `${violationType.replace('_', ' ')} detected - confidence analysis`,
        confidence: 0.70 + (Math.random() * 0.25), // 70-95%
        resolved: Math.random() > 0.3,
        autoResolved: Math.random() > 0.5,
        duration: 2000 + (Math.random() * 8000) // 2-10 seconds
      });
    }
    
    session.violations = mockViolations;
    session.violationsInitialized = true;
    
    // Update score based on actual violation count and severity
    const warningCount = mockViolations.filter(v => v.severity === 'warning').length;
    const infoCount = mockViolations.filter(v => v.severity === 'info').length;
    const criticalCount = mockViolations.filter(v => v.severity === 'critical').length;
    
    session.score.current = Math.max(40, 100 - (criticalCount * 15) - (warningCount * 8) - (infoCount * 3));
    session.score.credibilityIndex = Math.max(0.4, 1.0 - (criticalCount * 0.2) - (warningCount * 0.12) - (infoCount * 0.05));
    session.score.riskLevel = session.score.current > 85 ? 'low' : session.score.current > 65 ? 'medium' : 'high';
  }
  
  const response = {
    ...session,
    duration: Math.floor(durationMs / 1000), // seconds
    realTimeMetrics: {
      aiAgentsHealth: Object.keys(session.aiAgents).map(type => ({
        type,
        status: session.aiAgents[type].status,
        healthScore: session.aiAgents[type].healthScore || 0,
        lastUpdate: session.aiAgents[type].lastUpdate
      })),
      eventProcessingRate: Math.floor(Math.random() * 50) + 20, // events per minute
      memoryUsage: Math.floor(Math.random() * 200) + 100, // MB
      cpuUsage: Math.floor(Math.random() * 30) + 10 // %
    }
  };
  
  res.json({
    success: true,
    session: response
  });
});

// Inject/update violations for a session (from simulator)
app.post('/api/v1/sessions/:sessionId/violations', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { violations, candidates } = req.body;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found', sessionId });
  }
  
  // Update violations if provided
  if (violations && Array.isArray(violations)) {
    session.violations = violations;
    logger.info('Updated session violations', { sessionId, violationCount: violations.length });
  }
  
  // Update candidates if provided (to sync scores, z-scores, percentiles)
  if (candidates && Array.isArray(candidates)) {
    session.candidates = candidates;
    logger.info('Updated session candidates', { sessionId, candidateCount: candidates.length });
  }
  
  // Update timestamp
  session.updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    sessionId,
    message: 'Session violations and candidates updated',
    timestamp: new Date().toISOString()
  });
});

// Session control operations
app.post('/api/v1/sessions/:sessionId/control', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { action, reason } = req.body;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found', sessionId });
  }
  
  logger.info('Session control action', { sessionId, action, reason });
  
  switch (action) {
    case 'pause':
      session.status = 'paused';
      session.events.push({
        timestamp: new Date().toISOString(),
        type: 'session_paused',
        severity: 'warning',
        source: 'control_plane',
        message: `Session paused: ${reason || 'Manual pause'}`
      });
      break;
      
    case 'resume':
      session.status = 'active';
      session.events.push({
        timestamp: new Date().toISOString(),
        type: 'session_resumed',
        severity: 'info',
        source: 'control_plane',
        message: 'Session resumed'
      });
      break;
      
    case 'terminate':
      session.status = 'terminated';
      session.endedAt = new Date().toISOString();
      
      // Clean up agents
      Object.values(session.aiAgents).forEach(agent => {
        if (agent.agentId) {
          activeAgents.delete(agent.agentId);
        }
      });
      
      session.events.push({
        timestamp: new Date().toISOString(),
        type: 'session_terminated',
        severity: 'error',
        source: 'control_plane',
        message: `Session terminated: ${reason || 'Manual termination'}`
      });
      break;
      
    case 'complete':
      session.status = 'completed';
      session.endedAt = new Date().toISOString();
      
      // Clean up agents
      Object.values(session.aiAgents).forEach(agent => {
        if (agent.agentId) {
          activeAgents.delete(agent.agentId);
        }
      });
      
      session.events.push({
        timestamp: new Date().toISOString(),
        type: 'session_completed',
        severity: 'success',
        source: 'control_plane',
        message: 'Session completed successfully'
      });
      break;

    case 'lock':
      session.status = 'locked';
      session.events.push({
        timestamp: new Date().toISOString(),
        type: 'session_locked',
        severity: 'critical',
        source: 'control_plane',
        message: `Session locked: ${reason || 'Manual lock - evidence of suspicious activity'}`
      });
      break;
      
    default:
      return res.status(400).json({ 
        error: 'Invalid action', 
        validActions: ['pause', 'resume', 'terminate', 'complete', 'lock'] 
      });
  }
  
  res.json({
    success: true,
    sessionId,
    action,
    newStatus: session.status,
    timestamp: new Date().toISOString(),
    message: `Session ${action} operation completed successfully`
  });
});

// Super Admin: Batch operations on sessions (pause all in exam, etc)
app.post('/api/v1/admin/sessions/batch/control', basicAuth, express.json(), (req: Request, res: Response) => {
  const { examId, candidateIds, action, reason, organizationId, lockDurationMinutes, filter } = req.body;
  const user = (req as any).user;
  
  if (!action || !['pause', 'resume', 'terminate', 'lock', 'unlock', 'flag'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be one of: pause, resume, terminate, lock, unlock, flag' });
  }

  const targetSessions: any[] = [];
  let affectedCount = 0;
  const actionLog: any[] = [];
  
  for (const [sessionId, session] of sessions) {
    let shouldInclude = false;
    
    // Filter by examId
    if (examId && session.examId === examId) shouldInclude = true;
    
    // Filter by candidateIds
    if (candidateIds && Array.isArray(candidateIds) && candidateIds.includes(session.candidateId)) shouldInclude = true;
    
    // Filter by risk level
    if (filter?.riskAbove) {
      const riskScore = 100 - (session.credibilityScore || 100);
      if (riskScore >= filter.riskAbove) shouldInclude = true;
    }
    
    // Filter by violation type
    if (filter?.violationType) {
      const hasViolation = session.violations.some(v => v.type === filter.violationType);
      if (hasViolation) shouldInclude = true;
    }
    
    if (shouldInclude) {
      const oldStatus = session.status;
      let newStatus = oldStatus;
      let lockUntil = null;
      
      // Apply action to session
      if (action === 'pause') {
        newStatus = 'paused';
      } else if (action === 'resume' && session.status === 'paused') {
        newStatus = 'active';
      } else if (action === 'terminate') {
        newStatus = 'terminated';
        session.endedAt = new Date().toISOString();
        Object.values(session.aiAgents).forEach((agent: any) => {
          if (agent.agentId) activeAgents.delete(agent.agentId);
        });
      } else if (action === 'lock') {
        newStatus = 'locked';
        // Set lock until (temporary: configurable by duration, or permanent: null)
        if (lockDurationMinutes && lockDurationMinutes > 0) {
          lockUntil = new Date(Date.now() + lockDurationMinutes * 60000).toISOString();
        }
        // Store lock metadata
        if (!session.lockMetadata) session.lockMetadata = {};
        session.lockMetadata.lockedAt = new Date().toISOString();
        session.lockMetadata.lockedBy = user.id;
        session.lockMetadata.lockReason = reason || 'Manual lock by admin';
        session.lockMetadata.lockUntil = lockUntil;
      } else if (action === 'unlock' && session.status === 'locked') {
        newStatus = 'active';
        if (session.lockMetadata) {
          session.lockMetadata.unlockedAt = new Date().toISOString();
          session.lockMetadata.unlockedBy = user.id;
        }
      } else if (action === 'flag') {
        if (!session.adminFlags) session.adminFlags = [];
        session.adminFlags.push({
          flaggedAt: new Date().toISOString(),
          flaggedBy: user.id,
          reason: reason || 'Flagged for manual review',
          status: 'active'
        });
      }
      
      session.status = newStatus;
      
      // Audit event
      const auditEvent = {
        timestamp: new Date().toISOString(),
        type: `session_${action}ed`,
        severity: action === 'terminate' ? 'error' : action === 'lock' ? 'warning' : 'info',
        source: 'control_plane_batch',
        actorId: user.id,
        actorRole: user.role,
        message: `Batch action: Session ${action}${lockUntil ? ` until ${lockUntil}` : ''}. Reason: ${reason || 'No reason provided'}`
      };
      
      session.events.push(auditEvent);
      actionLog.push({
        sessionId,
        candidateId: session.candidateId,
        examId: session.examId,
        oldStatus,
        newStatus,
        lockUntil,
        audit: auditEvent
      });
      
      targetSessions.push({
        sessionId,
        candidateId: session.candidateId,
        examId: session.examId,
        oldStatus,
        newStatus,
        lockUntil
      });
      affectedCount++;
    }
  }
  
  res.json({
    success: true,
    action,
    affectedCount,
    sessions: targetSessions.slice(0, 10), // Return first 10 for preview
    totalAffected: affectedCount,
    actionLog: actionLog.slice(0, 5), // Return first 5 for preview
    operationId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    summary: {
      action,
      appliedTo: affectedCount,
      filters: {
        examId: examId || 'any',
        candidateIds: candidateIds?.length || 'any',
        riskAbove: filter?.riskAbove || 'any',
        violationType: filter?.violationType || 'any'
      }
    }
  });
});

// Get all sessions with filters for super admin
app.get('/api/v1/admin/sessions', basicAuth, (req: Request, res: Response) => {
  const status = req.query.status as string;
  const examId = req.query.examId as string;
  const organizationId = req.query.organizationId as string;
  const riskLevel = req.query.riskLevel as string;
  
  let filtered = Array.from(sessions.values());
  
  if (status) filtered = filtered.filter(s => s.status === status);
  if (examId) filtered = filtered.filter(s => s.examId === examId);
  if (organizationId) filtered = filtered.filter(s => s.organizationId === organizationId);
  if (riskLevel) {
    const riskMap: Record<string, string[]> = {
      'critical': ['<-3σ'],
      'high': ['< -2σ'],
      'medium': ['-2σ to -1σ'],
      'low': ['> -1σ']
    };
    filtered = filtered.filter(s => {
      const riskLevelStr = s.riskLevel || 'unknown';
      return riskMap[riskLevel]?.includes(riskLevelStr);
    });
  }
  
  const summary = filtered.map(s => ({
    sessionId: s.sessionId,
    candidateId: s.candidateId,
    examId: s.examId,
    organizationId: s.organizationId,
    status: s.status,
    riskLevel: s.riskLevel || 'low',
    credibilityScore: s.credibilityScore,
    violationCount: s.violations.length,
    startedAt: s.startedAt,
    duration: s.endedAt ? Math.floor((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000) : Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000),
    recentEvents: s.events.slice(-3)
  }));
  
  res.json({
    success: true,
    total: filtered.length,
    sessions: summary.sort((a, b) => b.duration - a.duration)
  });
});

// Get full session context with AI analysis for super admin
app.get('/api/v1/admin/sessions/:sessionId/context', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Calculate z-score context (mock)
  const allScores = Array.from(sessions.values()).map(s => s.credibilityScore);
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allScores.length;
  const stddev = Math.sqrt(variance);
  const zScore = (session.credibilityScore - mean) / stddev;
  
  res.json({
    success: true,
    sessionId,
    candidate: {
      candidateId: session.candidateId,
      email: `${session.candidateId}@example.com`,
      organizationId: session.organizationId
    },
    exam: {
      examId: session.examId,
      startedAt: session.startedAt,
      duration: session.endedAt ? Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000) : Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
    },
    scoring: {
      credibilityScore: session.credibilityScore,
      riskLevel: session.riskLevel,
      zScore: parseFloat(zScore.toFixed(2)),
      cohortMean: parseFloat(mean.toFixed(2)),
      cohortStdDev: parseFloat(stddev.toFixed(2)),
      percentile: parseFloat(((1 - (zScore + 3.5) / 7) * 100).toFixed(1))
    },
    violations: {
      total: session.violations.length,
      byType: session.violations.reduce((acc: Record<string, number>, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {}),
      timeline: session.violations.slice(-10).map(v => ({
        type: v.type,
        timestamp: v.timestamp,
        severity: v.severity,
        confidence: v.confidence
      }))
    },
    aiAnalysis: {
      riskIndicators: [
        zScore < -3 ? 'Critical Z-score anomaly' : undefined,
        session.violations.length > 10 ? 'Excessive violations' : undefined,
        session.violations.some(v => v.type === 'multiple_faces') ? 'Face detection anomalies' : undefined
      ].filter(Boolean),
      recommendations: [
        zScore < -3 ? 'Consider pause or review' : undefined,
        session.credibilityScore < 40 ? 'Consider termination' : undefined,
        session.credibilityScore < 70 ? 'Request proctor review' : 'Monitor closely'
      ].filter(Boolean)
    },
    actionHistory: session.events
      .filter(e => e.type.includes('paused') || e.type.includes('locked') || e.type.includes('terminated') || e.type.includes('resumed'))
      .map(e => ({
        action: e.type,
        timestamp: e.timestamp,
        message: e.message
      }))
  });
});

// Alert configuration for organization
app.get('/api/v1/admin/alerts/config', basicAuth, (req: Request, res: Response) => {
  const organizationId = req.query.organizationId as string;
  
  res.json({
    success: true,
    config: {
      organizationId: organizationId || 'global',
      tiers: {
        tier1: {
          threshold: -1.0,
          type: 'info',
          action: 'display_to_proctor',
          label: 'Watch Zone',
          description: 'Candidate showing normal variation'
        },
        tier2: {
          threshold: -2.0,
          type: 'warning',
          action: 'notify_proctor',
          label: 'Warning Zone',
          description: 'Moderately unusual behavior'
        },
        tier3: {
          threshold: -3.0,
          type: 'critical',
          action: 'alert_super_admin',
          label: 'Critical Zone',
          description: 'Significant anomaly detected'
        },
        tier4: {
          threshold: -3.5,
          type: 'emergency',
          action: 'auto_pause_and_escalate',
          label: 'Emergency Zone',
          description: 'Critical violation pattern'
        }
      },
      notificationChannels: {
        emailOnTier3: true,
        emailOnTier4: true,
        slackOnTier4: true,
        dashboardHighlight: true
      },
      pauseThreshold: 40,
      terminateThreshold: 15,
      updatedAt: new Date().toISOString()
    }
  });
});

// Update alert configuration
app.post('/api/v1/admin/alerts/config', basicAuth, express.json(), (req: Request, res: Response) => {
  const { organizationId, tier2Threshold, tier3Threshold, tier4Threshold, emailOnTier4, slackOnTier4 } = req.body;
  
  // In production, save to database; here we just acknowledge
  res.json({
    success: true,
    message: 'Alert configuration updated',
    config: {
      organizationId: organizationId || 'global',
      tier2Threshold: tier2Threshold || -2.0,
      tier3Threshold: tier3Threshold || -3.0,
      tier4Threshold: tier4Threshold || -3.5,
      notifications: {
        emailOnTier4: emailOnTier4 !== false,
        slackOnTier4: slackOnTier4 || false
      }
    }
  });
});

// Get session scoring breakdown (transparency)
app.get('/api/v1/sessions/:sessionId/score-breakdown', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Calculate penalty breakdown per violation type
  const violationBreakdown: Record<string, { count: number; penalty: number; baseWeight: number; zScore: number; adaptiveWeight: number }> = {};
  let totalPenalty = 0;
  
  // Base weights (configurable per organization)
  const baseWeights: Record<string, number> = {
    tab_switch: 5,
    window_blur: 3,
    copy_attempt: 5,
    cut_attempt: 5,
    paste_attempt: 15,
    right_click: 3,
    shortcut_blocked: 3,
    fullscreen_exit: 8,
    no_face_detected: 8,
    multiple_faces: 15,
    background_voices: 5,
    loud_noise: 3,
    rapid_typing: 2,
    mouse_jitter: 2,
    idle_too_long: 3
  };
  
  // Cohort statistics (would come from database in production)
  const cohortStats = {
    examId: session.examId,
    totalCandidates: Math.max(5, Math.floor(Math.random() * 50)),
    violationStats: {
      tab_switch: { mean: 2.5, stddev: 1.2 },
      multiple_faces: { mean: 0.8, stddev: 1.1 },
      no_face_detected: { mean: 1.2, stddev: 0.9 },
      copy_attempt: { mean: 0.3, stddev: 0.8 },
      paste_attempt: { mean: 0.2, stddev: 0.6 }
    }
  };
  
  // Calculate per violation type
  for (const v of session.violations) {
    if (!violationBreakdown[v.type]) {
      const baseWeight = baseWeights[v.type] || 5;
      const stat = cohortStats.violationStats[v.type as keyof typeof cohortStats.violationStats];
      const count = session.violations.filter(viol => viol.type === v.type).length;
      
      // Calculate z-score: (candidate occurrences - cohort mean) / cohort stddev
      const zScore = stat ? (count - stat.mean) / stat.stddev : 0;
      
      // Adaptive weight: scale by z-score (lower score for below-average, higher for above-average)
      const adaptiveMultiplier = Math.max(0.5, 1 + zScore * 0.15);
      const adaptiveWeight = Math.round(baseWeight * adaptiveMultiplier * 10) / 10;
      const penalty = adaptiveWeight * (Math.floor(Math.random() * 2) + 1); // 1-2 occurrences
      
      violationBreakdown[v.type] = {
        count,
        penalty,
        baseWeight,
        zScore: Math.round(zScore * 100) / 100,
        adaptiveWeight
      };
      totalPenalty += penalty;
    }
  }
  
  // Calculate cohort comparison
  const allSessions = Array.from(sessions.values()).filter(s => s.examId === session.examId);
  const allPenalties = allSessions.map(s => {
    let penalty = 0;
    for (const v of s.violations) {
      penalty += baseWeights[v.type] || 5;
    }
    return penalty;
  });
  const cohortMean = allPenalties.length > 0 ? allPenalties.reduce((a, b) => a + b, 0) / allPenalties.length : 0;
  const cohortVariance = allPenalties.length > 0 ? allPenalties.reduce((a, b) => a + Math.pow(b - cohortMean, 2), 0) / allPenalties.length : 0;
  const cohortStdDev = Math.sqrt(cohortVariance);
  const sessionZScore = (totalPenalty - cohortMean) / (cohortStdDev || 1);
  
  res.json({
    success: true,
    sessionId,
    scoreBreakdown: {
      baseScore: 100,
      totalPenalty,
      finalScore: Math.max(0, 100 - totalPenalty),
      penalties: Object.entries(violationBreakdown).map(([type, data]) => ({
        type,
        count: data.count,
        baseWeight: data.baseWeight,
        cohortContext: {
          mean: cohortStats.violationStats[type as keyof typeof cohortStats.violationStats]?.mean || 'N/A',
          stddev: cohortStats.violationStats[type as keyof typeof cohortStats.violationStats]?.stddev || 'N/A'
        },
        zScore: data.zScore,
        adaptiveWeight: data.adaptiveWeight,
        explanation: data.zScore > 1 ? 'Above cohort average; weight increased' : data.zScore < -1 ? 'Below cohort average; weight decreased' : 'Within normal range; standard weight'
      }))
    },
    cohortComparison: {
      examId: session.examId,
      candidatesInCohort: allSessions.length,
      scoreZScore: Math.round(sessionZScore * 100) / 100,
      scoringTier: sessionZScore > 2 ? 'Below Average' : sessionZScore > 1 ? 'Slightly Below' : sessionZScore < -2 ? 'Excellent' : sessionZScore < -1 ? 'Good' : 'Average',
      percentileRank: Math.round((1 - (1 / (1 + Math.exp(-sessionZScore)))) * 100)
    },
    contextualFactors: {
      examType: session.examId?.includes('proctored') ? 'High-stakes' : 'Standard',
      candidateRiskLevel: Math.max(0, 100 - session.credibilityScore || 100) > 75 ? 'CRITICAL' : Math.max(0, 100 - session.credibilityScore || 100) > 50 ? 'HIGH' : Math.max(0, 100 - session.credibilityScore || 100) > 25 ? 'MEDIUM' : 'LOW',
      recommendedAction: totalPenalty > 40 ? 'Consider manual review' : totalPenalty > 25 ? 'Monitor closely' : 'No action needed'
    }
  });
});

// Get cohort performance with anomalies
app.get('/api/v1/admin/analytics/cohort-advanced', basicAuth, (req: Request, res: Response) => {
  const organizationId = req.query.organizationId as string;
  
  let filtered = Array.from(sessions.values());
  if (organizationId) {
    filtered = filtered.filter(s => s.organizationId === organizationId);
  }
  
  const scores = filtered.map(s => s.credibilityScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length || 0;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length || 0;
  const stddev = Math.sqrt(variance);
  
  const anomalies = filtered
    .map(s => ({
      sessionId: s.sessionId,
      candidateId: s.candidateId,
      zScore: (s.credibilityScore - mean) / stddev,
      credibilityScore: s.credibilityScore,
      violationCount: s.violations.length
    }))
    .filter(s => Math.abs(s.zScore) > 2)
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  
  res.json({
    success: true,
    cohort: {
      organizationId: organizationId || 'all',
      totalCandidates: filtered.length,
      statistics: {
        meanScore: parseFloat(mean.toFixed(2)),
        stddev: parseFloat(stddev.toFixed(2)),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores)
      },
      anomalies: {
        critical: anomalies.filter(a => a.zScore < -3).length,
        warning: anomalies.filter(a => a.zScore < -2 && a.zScore >= -3).length,
        mild: anomalies.filter(a => Math.abs(a.zScore) > 2 && a.zScore >= -2).length,
        topAnomalies: anomalies.slice(0, 10)
      }
    }
  });
});

// Get active alerts for dashboard
app.get('/api/v1/admin/alerts/active', basicAuth, (req: Request, res: Response) => {
  const organizationId = req.query.organizationId as string;
  
  let filtered = Array.from(sessions.values());
  if (organizationId) {
    filtered = filtered.filter(s => s.organizationId === organizationId);
  }
  
  // Calculate anomalies
  const scores = filtered.map(s => s.credibilityScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length || 0;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length || 0;
  const stddev = Math.sqrt(variance);
  
  const alerts = filtered
    .filter(s => {
      const zScore = (s.credibilityScore - mean) / stddev;
      return zScore < -2 || s.credibilityScore < 40 || s.status === 'locked';
    })
    .map(s => {
      const zScore = (s.credibilityScore - mean) / stddev;
      let tier = 'info';
      if (zScore < -3.5) tier = 'emergency';
      else if (zScore < -3) tier = 'critical';
      else if (zScore < -2) tier = 'warning';
      
      return {
        alertId: `alert-${s.sessionId}`,
        sessionId: s.sessionId,
        candidateId: s.candidateId,
        examId: s.examId,
        tier,
        zScore: parseFloat(zScore.toFixed(2)),
        credibilityScore: s.credibilityScore,
        reason: zScore < -3 ? 'Z-score anomaly detected' : 'Low credibility score detected',
        timestamp: new Date().toISOString(),
        status: 'active'
      };
    })
    .sort((a, b) => {
      const tierOrder: Record<string, number> = { emergency: 0, critical: 1, warning: 2 };
      return tierOrder[a.tier] - tierOrder[b.tier];
    });
  
  res.json({
    success: true,
    organizationId: organizationId || 'all',
    activeAlerts: alerts.length,
    alerts: alerts.slice(0, 50)
  });
});

// AI Accuracy: Submit batch feedback approvals
app.post('/api/v1/admin/ai-accuracy/feedback/batch-approve', basicAuth, express.json(), (req: Request, res: Response) => {
  const { violationIds, feedback, examId, organizationId } = req.body;
  const user = (req as any).user;
  
  if (!Array.isArray(violationIds) || violationIds.length === 0) {
    return res.status(400).json({ error: 'violationIds must be a non-empty array' });
  }
  
  if (!feedback || !['correct', 'incorrect', 'uncertain'].includes(feedback)) {
    return res.status(400).json({ error: 'feedback must be: correct, incorrect, or uncertain' });
  }
  
  // Store approval decisions (in production: save to database)
  const approvalRecord = {
    approvalId: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    approvedBy: user.id,
    violationIds,
    feedback,
    examId,
    organizationId,
    batchSize: violationIds.length,
    accuracyImpact: feedback === 'correct' ? 0.95 : feedback === 'incorrect' ? 0.45 : 0.70
  };
  
  // Simulate feedback impact on weights
  const impactedWeights = {
    tab_switch: 5,
    multiple_faces: 15,
    no_face_detected: 8,
    paste_attempt: 15,
    copy_attempt: 5
  };
  
  res.json({
    success: true,
    approvalRecord,
    impact: {
      violationsProcessed: violationIds.length,
      feedbackType: feedback,
      accuracyImprovement: feedback === 'correct' ? '+2.3%' : feedback === 'incorrect' ? '-1.8%' : '±0.5%',
      weightsAffected: Object.keys(impactedWeights).length,
      recommendation: feedback === 'incorrect' ? 'Consider retraining weights' : 'Feedback noted for future sessions'
    },
    nextStep: feedback === 'incorrect' ? 'Ready for batch retrain' : 'Feedback logged'
  });
});

// AI Accuracy: Batch retrain adaptive weights
app.post('/api/v1/admin/ai-accuracy/retrain-weights', basicAuth, express.json(), (req: Request, res: Response) => {
  const { examId, organizationId, sampleSize = 50, feedback } = req.body;
  const user = (req as any).user;
  
  // Calculate new weights based on feedback
  const oldWeights = {
    tab_switch: 5,
    window_blur: 3,
    copy_attempt: 5,
    paste_attempt: 15,
    multiple_faces: 15,
    no_face_detected: 8
  };
  
  const newWeights = { ...oldWeights };
  if (feedback === 'overweighted') {
    newWeights.tab_switch = 4;
    newWeights.copy_attempt = 4;
  } else if (feedback === 'underweighted') {
    newWeights.multiple_faces = 18;
    newWeights.no_face_detected = 10;
  }
  
  const retrainRecord = {
    retrainId: `retrain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    retrainedBy: user.id,
    examId,
    organizationId,
    weightsUpdated: Object.keys(newWeights).length,
    sampleSize,
    feedback,
    changes: Object.entries(oldWeights).map(([type, oldWeight]) => ({
      violationType: type,
      oldWeight,
      newWeight: newWeights[type as keyof typeof newWeights],
      change: newWeights[type as keyof typeof newWeights] - oldWeight
    }))
  };
  
  res.json({
    success: true,
    retrainRecord,
    summary: {
      weightsRetrained: Object.keys(newWeights).length,
      samplesAnalyzed: sampleSize,
      accuracyImprovement: '+3.2%',
      timeToComplete: '2.1s',
      status: 'completed',
      appliedAt: new Date().toISOString(),
      rolloutStatus: 'Ready for deployment to new sessions'
    },
    comparison: {
      oldWeights: oldWeights,
      newWeights: newWeights,
      differences: Object.entries(oldWeights).map(([type]) => ({
        type,
        change: `${oldWeights[type as keyof typeof oldWeights]} → ${newWeights[type as keyof typeof newWeights]}`
      }))
    }
  });
});

// AI Accuracy: Get approval history
app.get('/api/v1/admin/ai-accuracy/approval-history', basicAuth, (req: Request, res: Response) => {
  const examId = req.query.examId as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  // Mock approval history
  const history = Array.from({ length: 50 }, (_, i) => ({
    approvalId: `approval_${i}`,
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    examId: examId || `exam_${Math.floor(i / 10)}`,
    violationsApproved: Math.floor(Math.random() * 20) + 5,
    feedback: ['correct', 'incorrect', 'uncertain'][Math.floor(Math.random() * 3)],
    approvedBy: ['admin1', 'admin2', 'superadmin'][Math.floor(Math.random() * 3)],
    accuracyImpact: (Math.random() * 0.3 - 0.1).toFixed(2)
  }));
  
  const start = (page - 1) * limit;
  const end = start + limit;
  
  res.json({
    success: true,
    pagination: {
      page,
      limit,
      total: history.length,
      pages: Math.ceil(history.length / limit)
    },
    history: history.slice(start, end),
    summary: {
      totalApprovals: history.length,
      correctCount: history.filter(h => h.feedback === 'correct').length,
      incorrectCount: history.filter(h => h.feedback === 'incorrect').length,
      averageAccuracy: ((history.filter(h => h.feedback === 'correct').length / history.length) * 100).toFixed(1) + '%'
    }
  });
});

// Get active agents
app.get('/api/v1/agents', basicAuth, (req: Request, res: Response) => {
  const agentsList = Array.from(activeAgents.values());
  
  const summary = {
    totalAgents: agentsList.length,
    byType: {
      vision: agentsList.filter(a => a.type === 'vision').length,
      audio: agentsList.filter(a => a.type === 'audio').length,
      behavior: agentsList.filter(a => a.type === 'behavior').length
    },
    byStatus: {
      active: agentsList.filter(a => a.status === 'active').length,
      idle: agentsList.filter(a => a.status === 'idle').length,
      error: agentsList.filter(a => a.status === 'error').length
    }
  };
  
  res.json({
    success: true,
    summary,
    agents: agentsList
  });
});

// Get session events stream
app.get('/api/v1/events/:sessionId', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { since, limit = 50 } = req.query;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', sessionId });
  }
  
  let events = [...session.events];
  
  // Filter by timestamp if 'since' is provided
  if (since) {
    const sinceDate = new Date(since as string);
    events = events.filter(e => new Date(e.timestamp) > sinceDate);
  }
  
  // Limit results
  events = events.slice(0, parseInt(limit as string));
  
  res.json({
    success: true,
    sessionId,
    eventCount: events.length,
    events: events.reverse() // Most recent first
  });
});

// List all sessions
app.get('/api/v1/sessions', basicAuth, (req: Request, res: Response) => {
  const { status, limit = 20 } = req.query;
  
  let sessionsList = Array.from(sessions.values());
  
  // Filter by status if provided
  if (status) {
    sessionsList = sessionsList.filter(s => s.status === status);
  }
  
  // Limit results
  sessionsList = sessionsList.slice(0, parseInt(limit as string));
  
  const summary = {
    totalSessions: sessions.size,
    byStatus: {
      active: Array.from(sessions.values()).filter(s => s.status === 'active').length,
      paused: Array.from(sessions.values()).filter(s => s.status === 'paused').length,
      completed: Array.from(sessions.values()).filter(s => s.status === 'completed').length,
      terminated: Array.from(sessions.values()).filter(s => s.status === 'terminated').length
    }
  };
  
  res.json({
    success: true,
    summary,
    sessions: sessionsList.map(s => ({
      sessionId: s.sessionId,
      candidateId: s.candidateId,
      tenantId: s.tenantId,
      tenantName: s.tenantName,
      batchId: s.batchId,
      examType: s.examType,
      scenario: s.scenario,
      examId: s.examId,
      status: s.status,
      createdAt: s.createdAt,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      violationCount: s.violations.length,
      violations: s.violations,
      candidateCount: s.candidates.length,
      candidates: s.candidates,
      score: s.score.current
    }))
  });
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error', error);
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: config.env === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// =================================================================
// PHASE 6: CANDIDATE PROFILES — In-memory store (PostgreSQL in production)
// =================================================================

interface CandidateProfile {
  candidateId: string;
  organizationId: string;
  sessionHistory: Array<{
    sessionId: string;
    date: string;
    examId: string;
    score: number;
    riskLevel: string;
    violationCount: number;
    duration: number;
    highlights: string[];
  }>;
  violationFingerprint: Record<string, number>;
  behavioralSignature: {
    avgTypingSpeed?: number;
    mousePatterns?: string[];
    commonViolations?: string[];
  };
  riskTrend: 'improving' | 'worsening' | 'stable' | 'unknown';
  createdAt: string;
  updatedAt: string;
}

const candidateProfiles = new Map<string, CandidateProfile>();

// Get candidate profile
app.get('/api/v1/candidates/:candidateId/profile', (req: Request, res: Response) => {
  const { candidateId } = req.params;
  const profile = candidateProfiles.get(candidateId);
  if (!profile) {
    res.json({
      success: true,
      data: null,
      message: 'No profile found — first-time candidate'
    });
    return;
  }
  res.json({ success: true, data: profile });
});

// Update candidate profile after session
app.post('/api/v1/candidates/:candidateId/profile', express.json(), (req: Request, res: Response) => {
  const { candidateId } = req.params;
  const { sessionData } = req.body;
  
  if (!sessionData) {
    res.status(400).json({ error: 'sessionData required' });
    return;
  }

  let profile = candidateProfiles.get(candidateId);
  if (!profile) {
    profile = {
      candidateId,
      organizationId: sessionData.organizationId || 'unknown',
      sessionHistory: [],
      violationFingerprint: {},
      behavioralSignature: {},
      riskTrend: 'unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Add session to history
  const sessionEntry = {
    sessionId: sessionData.sessionId,
    date: new Date().toISOString(),
    examId: sessionData.examId || 'unknown',
    score: sessionData.credibilityScore || 100,
    riskLevel: sessionData.riskLevel || 'low',
    violationCount: (sessionData.violations || []).length,
    duration: sessionData.duration || 0,
    highlights: [] as string[],
  };

  // Generate highlights
  const violations = sessionData.violations || [];
  if (violations.length === 0) sessionEntry.highlights.push('Clean session');
  const criticals = violations.filter((v: any) => v.severity === 'critical').length;
  if (criticals > 0) sessionEntry.highlights.push(`${criticals} critical violations`);
  if (sessionData.credibilityScore < 50) sessionEntry.highlights.push('High risk session');

  profile.sessionHistory.push(sessionEntry);
  if (profile.sessionHistory.length > 50) profile.sessionHistory = profile.sessionHistory.slice(-50);

  // Update violation fingerprint
  for (const v of violations) {
    profile.violationFingerprint[v.type] = (profile.violationFingerprint[v.type] || 0) + 1;
  }

  // Calculate risk trend
  const recentScores = profile.sessionHistory.slice(-5).map(s => s.score);
  if (recentScores.length >= 2) {
    const first = recentScores.slice(0, Math.ceil(recentScores.length / 2));
    const second = recentScores.slice(Math.ceil(recentScores.length / 2));
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
    if (avgSecond - avgFirst > 10) profile.riskTrend = 'improving';
    else if (avgFirst - avgSecond > 10) profile.riskTrend = 'worsening';
    else profile.riskTrend = 'stable';
  }

  profile.updatedAt = new Date().toISOString();
  candidateProfiles.set(candidateId, profile);

  logger.info(`Candidate profile updated: ${candidateId} (${profile.sessionHistory.length} sessions, trend: ${profile.riskTrend})`);
  res.json({ success: true, data: profile });
});

// List all candidate profiles
app.get('/api/v1/candidates/profiles', (_req: Request, res: Response) => {
  const profiles = Array.from(candidateProfiles.values());
  res.json({
    success: true,
    data: profiles,
    total: profiles.length,
  });
});

// Get cohort analytics
app.get('/api/v1/analytics/cohort', (req: Request, res: Response) => {
  const organizationId = req.query.organizationId as string | undefined;
  const examId = req.query.examId as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  let profiles = Array.from(candidateProfiles.values());
  
  // Apply filters
  if (organizationId) {
    profiles = profiles.filter(p => p.organizationId === organizationId);
  }
  if (examId) {
    profiles = profiles.filter(p => 
      p.sessionHistory.some(s => s.examId === examId)
    );
  }
  if (dateFrom) {
    const fromTime = new Date(dateFrom).getTime();
    profiles = profiles.filter(p =>
      p.sessionHistory.some(s => new Date(s.date).getTime() >= fromTime)
    );
  }
  if (dateTo) {
    const toTime = new Date(dateTo).getTime();
    profiles = profiles.filter(p =>
      p.sessionHistory.some(s => new Date(s.date).getTime() <= toTime)
    );
  }

  // Filter session history within date ranges if specified
  for (const profile of profiles) {
    if (dateFrom || dateTo) {
      const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toTime = dateTo ? new Date(dateTo).getTime() : Infinity;
      profile.sessionHistory = profile.sessionHistory.filter(s => {
        const sessionTime = new Date(s.date).getTime();
        return sessionTime >= fromTime && sessionTime <= toTime;
      });
    }
  }

  const totalSessions = profiles.reduce((sum, p) => sum + p.sessionHistory.length, 0);
  const allScores = profiles.flatMap(p => p.sessionHistory.map(s => s.score));
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

  // Aggregate violation fingerprint across filtered candidates
  const globalFingerprint: Record<string, number> = {};
  for (const p of profiles) {
    for (const [type, count] of Object.entries(p.violationFingerprint)) {
      globalFingerprint[type] = (globalFingerprint[type] || 0) + count;
    }
  }

  // Risk distribution
  const riskDist = { improving: 0, worsening: 0, stable: 0, unknown: 0 };
  for (const p of profiles) {
    riskDist[p.riskTrend]++;
  }

  res.json({
    success: true,
    data: {
      totalCandidates: profiles.length,
      totalSessions,
      avgScore,
      globalViolationFingerprint: globalFingerprint,
      riskTrendDistribution: riskDist,
      topViolationTypes: Object.entries(globalFingerprint)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count })),
      filters: { organizationId, examId, dateFrom, dateTo },
    },
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND', 
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'GET /',
      'POST /api/v1/sessions',
      'GET /api/v1/sessions',
      'GET /api/v1/sessions/:sessionId',
      'POST /api/v1/sessions/:sessionId/control',
      'GET /api/v1/agents',
      'GET /api/v1/events/:sessionId',
      'GET /api/v1/candidates/:candidateId/profile',
      'POST /api/v1/candidates/:candidateId/profile',
      'GET /api/v1/candidates/profiles',
      'GET /api/v1/analytics/cohort',
    ]
  });
});

// Start server
const PORT = config.server.port;

server.listen(PORT, () => {
  logger.info(`Control Plane server started`, {
    port: PORT,
    environment: config.env,
    nodeVersion: process.version,
    processId: process.pid,
    timestamp: new Date().toISOString(),
    endpoints: [
      `Health: http://localhost:${PORT}/health`,
      `Sessions: http://localhost:${PORT}/api/v1/sessions`,
      `Agents: http://localhost:${PORT}/api/v1/agents`
    ]
  });
});

export { app, server };
