/**
 * Health Check Routes - Phase 7 Gatekeeper Service
 */
import express, { Request, Response, Router } from 'express';

const router: Router = express.Router();

// Health check endpoint
router.get('/', async (req: any, res: Response) => {
  try {
    // Test database connection
    const dbResult = await req.db.query('SELECT NOW() as timestamp');
    
    // Test Redis connection
    const redisPing = await req.redis.ping();

    // Get queue statistics
    const waitingRoomCount = await req.redis.llen('gatekeeper:waiting_room');
    const pendingApprovalCount = await req.redis.llen('gatekeeper:pending_approval');

    res.json({
      status: 'healthy',
      service: 'gatekeeper-service-p7',
      version: '1.0.0',
      database: {
        connected: true,
        timestamp: dbResult.rows[0].timestamp
      },
      redis: {
        connected: redisPing === 'PONG'
      },
      queues: {
        waitingRoom: waitingRoomCount,
        pendingApproval: pendingApprovalCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Gatekeeper health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      service: 'gatekeeper-service-p7',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;