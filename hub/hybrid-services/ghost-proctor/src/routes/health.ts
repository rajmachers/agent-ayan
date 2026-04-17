/**
 * Health Check Routes - Phase 7 Ghost Proctor Service
 */
import express, { Request, Response } from 'express';

const router = express.Router();

// Health check endpoint
router.get('/', async (req: any, res: Response) => {
  try {
    // Test database connection
    const dbResult = await req.db.query('SELECT NOW() as timestamp');
    
    // Test Redis connection
    const redisPing = await req.redis.ping();

    // Get system statistics
    const activeProctors = await req.redis.scard('proctors:active');
    const ghostProctors = await req.redis.scard('proctors:ghost');
    const emergencyAssignments = await req.redis.llen('assignments:emergency');
    const overflowAssignments = await req.redis.llen('assignments:overflow');

    // Calculate total system capacity
    const allProctors = await req.redis.smembers('proctors:active');
    let totalCapacity = 0;
    let currentLoad = 0;
    
    for (const proctorId of allProctors) {
      const maxConcurrent = await req.redis.hget(`proctor:${proctorId}:capacity`, 'max_concurrent') || '5';
      const currentAssignments = await req.redis.hget(`proctor:${proctorId}:capacity`, 'current_load') || '0';
      
      totalCapacity += parseInt(maxConcurrent);
      currentLoad += parseInt(currentAssignments);
    }

    const utilizationRate = totalCapacity > 0 ? (currentLoad / totalCapacity * 100).toFixed(1) : '0.0';

    res.json({
      status: 'healthy',
      service: 'ghost-proctor-service-p7',
      version: '1.0.0',
      database: {
        connected: true,
        timestamp: dbResult.rows[0].timestamp
      },
      redis: {
        connected: redisPing === 'PONG'
      },
      system: {
        activeProctors,
        ghostProctors,
        totalCapacity,
        currentLoad,
        utilizationRate: `${utilizationRate}%`,
        emergencyAssignments,
        overflowAssignments
      },
      features: [
        'Supervisory session access',
        'Proctor performance analytics', 
        'AI pre-vetting with credibility scoring',
        'Emergency assignment management'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Ghost Proctor health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      service: 'ghost-proctor-service-p7',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed system status
router.get('/status', async (req: any, res: Response) => {
  try {
    // Get performance metrics summary
    const performanceQuery = await req.db.query(`
      SELECT 
        COUNT(DISTINCT proctor_id) as total_proctors,
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) as avg_approval_time,
        COUNT(*) FILTER (WHERE status = 'approved') as total_approvals,
        COUNT(*) FILTER (WHERE status = 'rejected') as total_rejections,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_hour_sessions
      FROM exam_sessions 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const metrics = performanceQuery.rows[0];
    
    // Get Redis statistics
    const redisInfo = await req.redis.info('memory');
    const memoryUsage = redisInfo.split('\n').find(line => line.startsWith('used_memory_human:'))?.split(':')[1]?.trim();

    // Get recent assignments
    const recentAssignments = await req.redis.lrange('assignments:emergency', 0, 4);
    const assignmentDetails = [];
    
    for (const assignmentId of recentAssignments) {
      const assignment = await req.redis.hgetall(`assignment:${assignmentId}`);
      if (assignment.candidateId) {
        assignmentDetails.push({
          assignmentId,
          candidateId: assignment.candidateId,
          proctorId: assignment.proctorId,
          type: assignment.assignmentType,
          timestamp: assignment.timestamp,
          reason: assignment.reason
        });
      }
    }

    res.json({
      systemStatus: 'operational',
      performance: {
        totalProctors: parseInt(metrics.total_proctors) || 0,
        averageApprovalTime: parseFloat(metrics.avg_approval_time) || 0,
        totalApprovals: parseInt(metrics.total_approvals) || 0,
        totalRejections: parseInt(metrics.total_rejections) || 0,
        lastHourSessions: parseInt(metrics.last_hour_sessions) || 0
      },
      infrastructure: {
        memoryUsage: memoryUsage || 'Unknown',
        uptime: process.uptime(),
        nodeVersion: process.version
      },
      recentActivity: {
        emergencyAssignments: assignmentDetails.length,
        latestAssignments: assignmentDetails
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('System status check failed:', error);
    res.status(500).json({ 
      error: 'Failed to get system status',
      service: 'ghost-proctor-service-p7'
    });
  }
});

export default router;