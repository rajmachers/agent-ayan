import { Router } from 'express';
import { checkDatabaseHealth } from '../utils/database';
import { checkRedisHealth } from '../utils/redis';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Check all dependencies
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);
  
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  const health = {
    status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'ayan-api-gateway',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    responseTime: `${responseTime}ms`,
    dependencies: {
      database: dbHealth ? 'healthy' : 'unhealthy',
      redis: redisHealth ? 'healthy' : 'unhealthy',
    },
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    },
    environment: process.env.NODE_ENV || 'development',
  };
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json(health);
  
  if (statusCode !== 200) {
    logger.warn('Health check failed', { health });
  }
}));

/**
 * Readiness probe
 * GET /health/ready
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);
  
  if (dbHealth && redisHealth) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      issues: {
        database: !dbHealth,
        redis: !redisHealth,
      },
    });
  }
}));

/**
 * Liveness probe
 * GET /health/live
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as healthRoutes };