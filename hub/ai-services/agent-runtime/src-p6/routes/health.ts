import { Router } from 'express';
import { AgentRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { executeQuery } from '../utils/database';
import { cache } from '../utils/redis';

const router = Router();

router.get('/', asyncHandler(async (req: AgentRequest, res) => {
  const healthCheck = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown' as 'ok' | 'error' | 'unknown',
      redis: 'unknown' as 'ok' | 'error' | 'unknown',
      agents: {
        total: 0,
        active: 0,
      },
    },
  };

  // Check database connection
  try {
    await executeQuery('SELECT 1');
    healthCheck.services.database = 'ok';
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    healthCheck.services.database = 'error';
    healthCheck.status = 'error';
  }

  // Check Redis connection
  try {
    await cache.ping();
    healthCheck.services.redis = 'ok';
  } catch (error) {
    logger.error('Redis health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    healthCheck.services.redis = 'error';
    healthCheck.status = 'error';
  }

  // Get agent statistics
  if (req.agentManager) {
    const allAgents = req.agentManager.getAllAgents();
    healthCheck.services.agents.total = allAgents.length;
    healthCheck.services.agents.active = req.agentManager.getActiveAgentCount();
  }

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
}));

router.get('/live', (req, res) => {
  // Simple liveness probe
  res.status(200).json({ status: 'alive' });
});

router.get('/ready', asyncHandler(async (req, res) => {
  // Readiness probe - check if service is ready to handle requests
  try {
    await executeQuery('SELECT 1');
    await cache.ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

export default router;