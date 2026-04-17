import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';

// Basic configuration
const config = {
  server: {
    port: process.env.PORT || 4000,
    host: process.env.HOST || '0.0.0.0'
  },
  env: process.env.NODE_ENV || 'development',
  cors: {
    origins: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3000']
  }
};

// Basic logger
const logger = {
  info: (msg: string, meta?: any) => console.log(`[API-GATEWAY] ${msg}`, meta || ''),
  error: (msg: string, error?: any) => console.error(`[API-GATEWAY] ERROR: ${msg}`, error || ''),
  warn: (msg: string, meta?: any) => console.warn(`[API-GATEWAY] WARN: ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.debug(`[API-GATEWAY] DEBUG: ${msg}`, meta || '')
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
  logger.info(`${req.method} ${req.path}`, { ip: req.ip, userAgent: req.get('User-Agent') });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Basic auth middleware (simplified for demo)
const basicAuth = (req: Request, res: Response, next: any) => {
  // For demo purposes, accept any API key for now
  const apiKey = req.header('X-API-Key');
  const authHeader = req.header('Authorization');
  
  if (apiKey || authHeader) {
    // Simulate user context
    (req as any).user = {
      id: 'demo-user-123',
      orgId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94', // Demo University org
      role: 'admin',
      permissions: ['read', 'write', 'admin']
    };
    next();
  } else {
    res.status(401).json({ error: 'Authentication required', acceptedMethods: ['Bearer token', 'API key'] });
  }
};

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'Ayan.ai API Gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.env,
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
    service: 'Ayan.ai API Gateway',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
    endpoints: {
      health: 'GET /health',
      sessions: 'POST /api/v1/sessions - Start proctoring session',
      sessionStatus: 'GET /api/v1/sessions/:sessionId - Get session status',
      analytics: 'GET /api/v1/sessions/:sessionId/analytics - Session analytics',
      playback: 'GET /api/v1/sessions/:sessionId/playback - Session playback'
    }
  });
});

// Session management endpoints
app.post('/api/v1/sessions/start', basicAuth, (req: Request, res: Response) => {
  const { candidateId, examId, token } = req.body;
  const user = (req as any).user;
  
  logger.info('Starting proctoring session', { candidateId, examId, orgId: user.orgId });
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Mock session data
  const session = {
    sessionId,
    candidateId,
    examId,
    orgId: user.orgId,
    status: 'active',
    startTime: new Date().toISOString(),
    aiMonitoring: {
      vision: { status: 'active', confidence: 0.95 },
      audio: { status: 'active', confidence: 0.92 },
      behavior: { status: 'active', confidence: 0.88 },
      screen: { status: 'active', confidence: 0.97 }
    },
    violations: [],
    score: {
      current: 95,
      credibilityIndex: 0.94,
      riskLevel: 'low'
    }
  };
  
  res.json({
    success: true,
    sessionId,
    session,
    message: 'AI proctoring session started successfully'
  });
});

// Get session status
app.get('/api/v1/sessions/:sessionId', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  // Mock session status
  const mockStatus = {
    sessionId,
    status: 'active',
    startTime: new Date(Date.now() - 300000).toISOString(), // Started 5 minutes ago
    duration: 300, // seconds
    currentPhase: 'monitoring',
    aiMonitoring: {
      vision: {
        status: 'active',
        lastUpdate: new Date().toISOString(),
        detections: {
          faceCount: 1,
          eyeTracking: 'normal',
          headPose: 'forward',
          suspiciousMovement: false
        }
      },
      audio: {
        status: 'active',
        lastUpdate: new Date().toISOString(),
        detections: {
          backgroundNoise: 'low',
          multipleVoices: false,
          suspiciousSounds: false
        }
      },
      behavior: {
        status: 'active',
        lastUpdate: new Date().toISOString(),
        analysis: {
          typingPattern: 'normal',
          screenFocus: 'stable',
          suspiciousActivity: false
        }
      }
    },
    violations: [
      {
        id: 'v1',
        type: 'audio_spike',
        severity: 'warning',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        description: 'Sudden audio spike detected',
        confidence: 0.75,
        resolved: true,
        autoResolved: true
      },
      {
        id: 'v2', 
        type: 'tab_focus_lost',
        severity: 'info',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        description: 'Browser tab lost focus for 3 seconds',
        confidence: 1.0,
        resolved: true,
        autoResolved: false
      }
    ],
    score: {
      current: 92,
      credibilityIndex: 0.89,
      riskLevel: 'low',
      factors: {
        faceDetection: 100,
        eyeTracking: 95,
        audioAnalysis: 88,
        behaviorAnalysis: 94
      }
    }
  };
  
  res.json({
    success: true,
    session: mockStatus
  });
});

// Get session analytics
app.get('/api/v1/sessions/:sessionId/analytics', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const analytics = {
    sessionId,
    overview: {
      totalDuration: 3600, // 1 hour in seconds
      violationCount: 3,
      riskScore: 8.5, // out of 10 (higher is better)
      credibilityIndex: 0.85,
      finalStatus: 'completed'
    },
    timeline: [
      { time: '00:00:00', event: 'session_started', severity: 'info' },
      { time: '00:02:15', event: 'face_detection_verified', severity: 'success' },
      { time: '00:05:45', event: 'audio_spike_detected', severity: 'warning' },
      { time: '00:05:52', event: 'audio_levels_normalized', severity: 'info' },
      { time: '00:12:30', event: 'tab_focus_lost', severity: 'warning' },
      { time: '00:12:33', event: 'tab_focus_restored', severity: 'info' },
      { time: '00:24:15', event: 'behavior_pattern_normal', severity: 'success' },
      { time: '00:58:45', event: 'session_completed', severity: 'success' }
    ],
    aiAnalysis: {
      vision: {
        faceDetection: { accuracy: 99.2, violations: 0 },
        eyeTracking: { accuracy: 96.8, violations: 0 },
        movementAnalysis: { normalBehavior: 94.5, suspiciousMovements: 2 }
      },
      audio: {
        backgroundNoise: { averageLevel: 15, spikes: 1 },
        voiceDetection: { multipleVoices: false, clarity: 92 },
        environmentalSounds: { distractions: 1 }
      },
      behavior: {
        typingPattern: { consistency: 88, naturalFlow: 91 },
        screenInteraction: { focusTime: 97.2, tabSwitches: 2 },
        overallBehavior: { trustworthiness: 89 }
      }
    },
    recommendations: [
      'Candidate demonstrated excellent exam behavior',
      'Minimal violations detected and resolved automatically', 
      'High credibility index indicates authentic performance',
      'Recommend approval for exam results'
    ]
  };
  
  res.json({
    success: true,
    analytics
  });
});

// Get session playback
app.get('/api/v1/sessions/:sessionId/playback', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const playback = {
    sessionId,
    recordingInfo: {
      duration: 3600,
      size: '1.2 GB',
      quality: '1080p',
      fps: 30,
      audioQuality: '48kHz',
      available: true
    },
    segments: [
      {
        id: 'intro',
        title: 'Pre-exam Verification',
        startTime: 0,
        duration: 180,
        keyEvents: ['identity_verification', 'room_scan', 'camera_test']
      },
      {
        id: 'main',
        title: 'Main Examination',
        startTime: 180,
        duration: 3240,
        keyEvents: ['exam_start', 'question_navigation', 'typing_activity']
      },
      {
        id: 'conclusion',
        title: 'Exam Submission',
        startTime: 3420,
        duration: 180,
        keyEvents: ['exam_review', 'submission', 'confirmation']
      }
    ],
    violationMarkers: [
      {
        timestamp: 345,
        type: 'audio_spike',
        severity: 'warning',
        description: 'Background noise detected'
      },
      {
        timestamp: 750,
        type: 'tab_focus',
        severity: 'info',
        description: 'Brief tab focus loss'
      }
    ],
    downloadUrls: {
      fullRecording: '/api/v1/sessions/session_123/recording/full',
      audioOnly: '/api/v1/sessions/session_123/recording/audio',
      highlights: '/api/v1/sessions/session_123/recording/highlights'
    }
  };
  
  res.json({
    success: true,
    playback
  });
});

// Stop session
app.post('/api/v1/sessions/:sessionId/stop', basicAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  logger.info('Stopping proctoring session', { sessionId });
  
  res.json({
    success: true,
    sessionId,
    status: 'stopped',
    stopTime: new Date().toISOString(),
    message: 'AI proctoring session stopped successfully'
  });
});

// Mock organizations endpoint for integration with tenant service
app.get('/api/v1/organizations', basicAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    organizations: [
      {
        id: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94',
        name: 'Demo University',
        slug: 'demo-university',
        status: 'active',
        sessionCount: 156,
        lastActivity: new Date().toISOString()
      }
    ]
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
      'POST /api/v1/sessions/start',
      'GET /api/v1/sessions/:sessionId',
      'POST /api/v1/sessions/:sessionId/stop',
      'GET /api/v1/sessions/:sessionId/analytics',
      'GET /api/v1/sessions/:sessionId/playback'
    ]
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

// Start server
const PORT = config.server.port;

server.listen(PORT, () => {
  logger.info(`API Gateway server started`, {
    port: PORT,
    environment: config.env,
    nodeVersion: process.version,
    processId: process.pid,
    timestamp: new Date().toISOString(),
    endpoints: [
      `Health: http://localhost:${PORT}/health`,
      `API: http://localhost:${PORT}/api/v1`,
      `Sessions: http://localhost:${PORT}/api/v1/sessions`
    ]
  });
});

export { app, server };