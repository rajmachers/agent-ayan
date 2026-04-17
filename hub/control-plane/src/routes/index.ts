import { Express, Request, Response } from 'express';
import { SessionManager } from '../services/SessionManager';
import { ProctorManager } from '../services/ProctorManager';
import { ModelOrchestrator } from '../services/ModelOrchestrator';
import { Logger } from '../utils/Logger';
import { z } from 'zod';

interface Services {
  sessionManager: SessionManager;
  proctorManager: ProctorManager;
  modelOrchestrator: ModelOrchestrator;
}

const logger = Logger.getInstance();

// Validation schemas
const CreateSessionSchema = z.object({
  candidateId: z.string().uuid(),
  examId: z.string().uuid(),
  tenantId: z.string().uuid(),
  proctoring_model: z.enum(['basic', 'advanced']).optional(),
  proctor_ratio: z.number().min(5).max(50).optional(),
  metadata: z.object({
    candidateName: z.string(),
    examTitle: z.string(),
    duration: z.number()
  })
});

const RegisterProctorSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  maxCapacity: z.number().min(1).max(100).optional()
});

const ModelSwitchSchema = z.object({
  tenantId: z.string().uuid(),
  proctoring_model: z.enum(['basic', 'advanced']),
  requestedBy: z.string(),
  reason: z.string().optional()
});

export function setupRoutes(app: Express, services: Services): void {
  const { sessionManager, proctorManager, modelOrchestrator } = services;

  // Health check
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const [dbHealth, redisHealth] = await Promise.all([
        sessionManager['db'].healthCheck(),
        sessionManager['redis'].healthCheck()
      ]);

      res.json({
        service: 'p7-control-plane',
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        port: process.env.PORT || 13002,
        dependencies: {
          database: dbHealth,
          redis: redisHealth
        },
        requirements: {
          'REQ-025': 'Multi-Stage Entry Protocol ✅',
          'REQ-036': 'Random Proctor Assignment ✅',
          'REQ-017-020': 'Basic/Advanced Models ✅',
          'REQ-081': 'WebSocket Communication ✅'
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        service: 'p7-control-plane',
        status: 'unhealthy',
        error: error.message
      });
    }
  });

  // Session Management Routes

  /**
   * Create new exam session
   * POST /api/sessions
   */
  app.post('/api/sessions', async (req: Request, res: Response) => {
    try {
      const sessionData = CreateSessionSchema.parse(req.body);
      
      const result = await modelOrchestrator.orchestrateSession(sessionData);
      
      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: result
      });

      logger.info(`✅ Session created via API: ${result.sessionId} (${result.model})`);

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      } else {
        logger.error('Session creation API error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create session'
        });
      }
    }
  });

  /**
   * Get session details
   * GET /api/sessions/:sessionId
   */
  app.get('/api/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      logger.error('Get session API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session'
      });
    }
  });

  /**
   * Update session status (for Gatekeeper approvals)
   * PUT /api/sessions/:sessionId/status
   */
  app.put('/api/sessions/:sessionId/status', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { status, proctorId, reason } = req.body;

      await sessionManager.updateSessionStatus(sessionId, status);

      if (proctorId && status === 'APPROVED') {
        await sessionManager.assignProctor(sessionId, proctorId);
      }

      if (reason && status === 'REJECTED') {
        await sessionManager.updateSessionMetadata(sessionId, { rejection_reason: reason });
      }

      res.json({
        success: true,
        message: `Session status updated to ${status}`
      });

      logger.info(`📊 Session ${sessionId} status updated to ${status} via API`);

    } catch (error) {
      logger.error('Update session status API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update session status'
      });
    }
  });

  /**
   * Get sessions by tenant and status
   * GET /api/tenants/:tenantId/sessions?status=PENDING
   */
  app.get('/api/tenants/:tenantId/sessions', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { status } = req.query;

      if (!status) {
        res.status(400).json({
          success: false,
          error: 'Status parameter is required'
        });
        return;
      }

      const sessions = await sessionManager.getSessionsByStatus(tenantId, status as any);

      res.json({
        success: true,
        data: sessions,
        count: sessions.length
      });

    } catch (error) {
      logger.error('Get tenant sessions API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sessions'
      });
    }
  });

  // Proctor Management Routes

  /**
   * Register new proctor
   * POST /api/proctors
   */
  app.post('/api/proctors', async (req: Request, res: Response) => {
    try {
      const proctorData = RegisterProctorSchema.parse(req.body);
      
      const result = await proctorManager.registerProctor(proctorData);
      
      res.status(201).json({
        success: true,
        message: 'Proctor registered successfully',
        data: {
          proctor: {
            proctorId: result.proctor.proctorId,
            name: result.proctor.name,
            email: result.proctor.email,
            status: result.proctor.status
          },
          credentials: {
            expiresAt: result.credentials.expiresAt
          }
        }
      });

      logger.info(`✅ Proctor registered via API: ${result.proctor.name} (${result.proctor.proctorId})`);

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      } else {
        logger.error('Proctor registration API error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to register proctor'
        });
      }
    }
  });

  /**
   * Bulk register proctors from CSV
   * POST /api/proctors/bulk
   */
  app.post('/api/proctors/bulk', async (req: Request, res: Response) => {
    try {
      const { proctors } = req.body;
      
      if (!Array.isArray(proctors)) {
        res.status(400).json({
          success: false,
          error: 'proctors must be an array'
        });
        return;
      }

      const result = await proctorManager.bulkRegisterProctors(proctors);
      
      res.json({
        success: true,
        message: `Bulk registration completed: ${result.success} success, ${result.failed} failed`,
        data: result
      });

      logger.info(`📊 Bulk proctor registration: ${result.success} success, ${result.failed} failed`);

    } catch (error) {
      logger.error('Bulk proctor registration API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register proctors'
      });
    }
  });

  /**
   * Get proctor details
   * GET /api/proctors/:proctorId
   */
  app.get('/api/proctors/:proctorId', async (req: Request, res: Response) => {
    try {
      const { proctorId } = req.params;
      
      const proctor = await proctorManager.getProctor(proctorId);
      if (!proctor) {
        res.status(404).json({
          success: false,
          error: 'Proctor not found'
        });
        return;
      }

      // Remove sensitive credentials from response
      const { credentials, ...proctorData } = proctor;

      res.json({
        success: true,
        data: proctorData
      });

    } catch (error) {
      logger.error('Get proctor API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get proctor'
      });
    }
  });

  /**
   * Get active proctors for tenant
   * GET /api/tenants/:tenantId/proctors
   */
  app.get('/api/tenants/:tenantId/proctors', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      const proctors = await proctorManager.getActiveProctors(tenantId);

      res.json({
        success: true,
        data: proctors.map(p => ({
          proctorId: p.proctorId,
          name: p.name,
          status: p.status,
          currentLoad: p.currentLoad,
          maxCapacity: p.maxCapacity,
          efficiency: p.efficiency
        })),
        count: proctors.length
      });

    } catch (error) {
      logger.error('Get tenant proctors API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get proctors'
      });
    }
  });

  /**
   * Get readiness dashboard for tenant
   * GET /api/tenants/:tenantId/readiness
   */
  app.get('/api/tenants/:tenantId/readiness', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      const readiness = await proctorManager.getReadinessDashboard(tenantId);

      res.json({
        success: true,
        data: readiness
      });

    } catch (error) {
      logger.error('Get readiness dashboard API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get readiness dashboard'
      });
    }
  });

  // Model Orchestration Routes

  /**
   * Switch tenant proctoring model
   * POST /api/tenants/:tenantId/model
   */
  app.post('/api/tenants/:tenantId/model', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const switchData = ModelSwitchSchema.parse({ ...req.body, tenantId });
      
      const result = await modelOrchestrator.switchTenantModel(switchData);
      
      res.json({
        success: true,
        message: `Model switched from ${result.oldModel} to ${result.newModel}`,
        data: result
      });

      logger.info(`🔄 Model switch via API: ${tenantId} → ${result.newModel}`);

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      } else {
        logger.error('Model switch API error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to switch model'
        });
      }
    }
  });

  /**
   * Update proctor ratio for tenant
   * POST /api/tenants/:tenantId/ratio
   */
  app.post('/api/tenants/:tenantId/ratio', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { proctor_ratio } = req.body;

      if (!proctor_ratio || proctor_ratio < 5 || proctor_ratio > 50) {
        res.status(400).json({
          success: false,
          error: 'Invalid proctor ratio. Must be between 5 and 50.'
        });
        return;
      }

      const result = await modelOrchestrator.updateProctorRatio(tenantId, proctor_ratio);
      
      res.json({
        success: true,
        message: `Proctor ratio updated to 1:${result.newRatio}`,
        data: result
      });

      logger.info(`📊 Proctor ratio updated via API: ${tenantId} → 1:${result.newRatio}`);

    } catch (error) {
      logger.error('Update proctor ratio API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update proctor ratio'
      });
    }
  });

  /**
   * Get model effectiveness comparison
   * GET /api/tenants/:tenantId/effectiveness
   */
  app.get('/api/tenants/:tenantId/effectiveness', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      const effectiveness = await modelOrchestrator.getModelEffectiveness(tenantId);
      
      res.json({
        success: true,
        data: effectiveness
      });

    } catch (error) {
      logger.error('Get model effectiveness API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get model effectiveness'
      });
    }
  });

  /**
   * Handle emergency assignment
   * POST /api/tenants/:tenantId/emergency
   */
  app.post('/api/tenants/:tenantId/emergency', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      const result = await modelOrchestrator.handleEmergencyAssignment(tenantId);
      
      res.json({
        success: true,
        message: 'Emergency assignment processed',
        data: result
      });

      if (result.action === 'EMERGENCY_ASSIGNMENT') {
        logger.warn(`🚨 Emergency assignment executed for ${tenantId}: ${result.assignedSessions} sessions`);
      }

    } catch (error) {
      logger.error('Emergency assignment API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to handle emergency assignment'
      });
    }
  });

  // Authentication & Login Routes

  /**
   * Proctor login
   * POST /api/auth/proctor/login
   */
  app.post('/api/auth/proctor/login', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      
      const proctor = await proctorManager.proctorLogin(token);
      if (!proctor) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          proctorId: proctor.proctorId,
          name: proctor.name,
          tenantId: proctor.tenantId,
          status: proctor.status,
          maxCapacity: proctor.maxCapacity
        }
      });

      logger.info(`🟢 Proctor login via API: ${proctor.name} (${proctor.proctorId})`);

    } catch (error) {
      logger.error('Proctor login API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to login'
      });
    }
  });

  logger.info('✅ P7 Control Plane API routes configured');
}