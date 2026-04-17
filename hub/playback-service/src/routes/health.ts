/**
 * Health check routes for Playbook & Audit Service
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { DatabaseService } from '../services/database';
import { StorageService } from '../services/storage';
import { config } from '../config';

const router = Router();

// Basic health check
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'playback-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
}));

// Detailed health check with dependencies
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const checks = {
    database: 'unknown',
    storage: 'unknown',
    memory: 'unknown'
  };

  try {
    // Check database connection
    // In a real implementation, you'd inject these services
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  try {
    // Check storage connection
    checks.storage = 'healthy';
  } catch (error) {
    checks.storage = 'unhealthy';
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  checks.memory = memUsageMB < 1000 ? 'healthy' : 'warning';

  const isHealthy = Object.values(checks).every(status => 
    status === 'healthy' || status === 'warning'
  );

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    memory: {
      heapUsed: `${memUsageMB}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}));

// Readiness check
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  // Check if service is ready to serve requests
  const ready = true; // In real implementation, check if services are initialized
  
  res.status(ready ? 200 : 503).json({
    ready,
    timestamp: new Date().toISOString()
  });
}));

// Liveness check
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
}));

export default router;