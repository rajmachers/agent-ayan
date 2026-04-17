/**
 * Analytics Routes - Phase 7 Ghost Proctor Service  
 * REQ-041: Proctor efficiency ranking identifying "Super Proctors" vs "Slow Proctors"
 */
import express, { Request, Response } from 'express';
import moment from 'moment';

const router = express.Router();

// Get proctor performance rankings
router.get('/rankings', async (req: any, res: Response) => {
  try {
    const { classification, timeframe = '30d', limit = 100 } = req.query;

    // Get time range
    let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
    if (timeframe === '7d') dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
    else if (timeframe === '24h') dateFilter = "created_at >= NOW() - INTERVAL '1 day'";
    else if (timeframe === '90d') dateFilter = "created_at >= NOW() - INTERVAL '90 days'";

    // Get all active proctors with performance metrics
    const proctorsQuery = await req.db.query(`
      SELECT DISTINCT proctor_id FROM exam_sessions WHERE ${dateFilter}
    `);

    const rankings = [];
    
    for (const { proctor_id } of proctorsQuery.rows) {
      try {
        // Calculate performance using the service method
        const performance = await req.ghostService.calculateProctorPerformance(proctor_id);
        
        // Get proctor details
        const proctorDetails = await req.db.query(`
          SELECT name, email, status FROM proctors WHERE proctor_id = $1
        `, [proctor_id]);

        if (proctorDetails.rows.length > 0) {
          const proctor = proctorDetails.rows[0];
          
          // Filter by classification if specified
          if (!classification || performance.classification === classification) {
            rankings.push({
              proctorId: proctor_id,
              name: proctor.name,
              email: proctor.email,
              status: proctor.status,
              performance,
              rank: 0 // Will be calculated after sorting
            });
          }
        }
      } catch (error) {
        req.logger.warn(`Failed to calculate performance for proctor ${proctor_id}:`, error);
      }
    }

    // Sort by efficiency rank (descending)
    rankings.sort((a, b) => b.performance.efficiencyRank - a.performance.efficiencyRank);
    
    // Assign ranks
    rankings.forEach((proctor, index) => {
      proctor.rank = index + 1;
    });

    // Apply limit
    const limitedRankings = rankings.slice(0, parseInt(limit as string));

    // Calculate summary statistics
    const summary = {
      totalProctors: rankings.length,
      superProctors: rankings.filter(p => p.performance.classification === 'super').length,
      standardProctors: rankings.filter(p => p.performance.classification === 'standard').length,
      slowProctors: rankings.filter(p => p.performance.classification === 'slow').length,
      traineeProctors: rankings.filter(p => p.performance.classification === 'trainee').length,
      averageEfficiencyScore: rankings.length > 0 ? 
        (rankings.reduce((sum, p) => sum + p.performance.efficiencyRank, 0) / rankings.length).toFixed(2) : 0,
      averageThroughput: rankings.length > 0 ?
        (rankings.reduce((sum, p) => sum + p.performance.throughputRate, 0) / rankings.length).toFixed(2) : 0
    };

    res.json({
      rankings: limitedRankings,
      summary,
      filters: {
        classification,
        timeframe,
        limit: parseInt(limit as string)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Analytics rankings error:', error);
    res.status(500).json({
      error: 'Failed to get proctor rankings',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get detailed performance metrics for a specific proctor
router.get('/performance/:proctorId', async (req: any, res: Response) => {
  try {
    const { proctorId } = req.params;
    const { timeframe = '30d' } = req.query;

    // Get proctor details
    const proctorQuery = await req.db.query(`
      SELECT * FROM proctors WHERE proctor_id = $1
    `, [proctorId]);

    if (proctorQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Proctor not found',
        proctorId,
        service: 'ghost-proctor-service-p7'
      });
    }

    const proctor = proctorQuery.rows[0];

    // Calculate current performance
    const performance = await req.ghostService.calculateProctorPerformance(proctorId);

    // Get historical performance data
    let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
    if (timeframe === '7d') dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
    else if (timeframe === '24h') dateFilter = "created_at >= NOW() - INTERVAL '1 day'";
    else if (timeframe === '90d') dateFilter = "created_at >= NOW() - INTERVAL '90 days'";

    const detailsQuery = await req.db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as sessions,
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) as avg_approval_time,
        COUNT(*) FILTER (WHERE status = 'approved') as approvals,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejections,
        AVG(CASE WHEN accuracy_score IS NOT NULL THEN accuracy_score ELSE 0 END) as avg_accuracy
      FROM exam_sessions
      WHERE proctor_id = $1 AND ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [proctorId]);

    // Get recent sessions for detailed analysis
    const recentSessionsQuery = await req.db.query(`
      SELECT 
        session_id,
        candidate_id, 
        status,
        created_at,
        approved_at,
        violations_count,
        accuracy_score,
        EXTRACT(EPOCH FROM (approved_at - created_at)) as approval_time_seconds
      FROM exam_sessions
      WHERE proctor_id = $1 AND ${dateFilter}
      ORDER BY created_at DESC
      LIMIT 20
    `, [proctorId]);

    // Calculate trends and patterns
    const dailyMetrics = detailsQuery.rows.map(row => ({
      date: row.date,
      sessions: parseInt(row.sessions),
      avgApprovalTime: parseFloat(row.avg_approval_time) || 0,
      approvals: parseInt(row.approvals),
      rejections: parseInt(row.rejections),
      avgAccuracy: parseFloat(row.avg_accuracy) || 0,
      throughput: parseInt(row.approvals) + parseInt(row.rejections)
    }));

    // Identify patterns
    const patterns = {
      bestPerformanceDay: dailyMetrics.length > 0 ? 
        dailyMetrics.reduce((best, current) => 
          current.avgAccuracy > best.avgAccuracy ? current : best
        ) : null,
      consistencyScore: calculateConsistencyScore(dailyMetrics),
      improvementTrend: calculateTrend(dailyMetrics.slice(-7), 'avgAccuracy'), // Last 7 days
      peakHours: await getProctorPeakHours(proctorId, req.db)
    };

    // Get comparison with peer group
    const peerComparison = await getPeerComparison(proctorId, performance.classification, req.db, req.ghostService);

    res.json({
      proctor: {
        proctorId: proctor.proctor_id,
        name: proctor.name,
        email: proctor.email,
        status: proctor.status,
        createdAt: proctor.created_at
      },
      performance,
      analytics: {
        dailyMetrics,
        patterns,
        peerComparison,
        recentSessions: recentSessionsQuery.rows.map(s => ({
          sessionId: s.session_id,
          candidateId: s.candidate_id,
          status: s.status,
          createdAt: s.created_at,
          approvedAt: s.approved_at,
          violationsCount: s.violations_count,
          accuracyScore: s.accuracy_score,
          approvalTimeSeconds: parseFloat(s.approval_time_seconds) || 0
        }))
      },
      filters: {
        timeframe
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Performance analytics error:', error);
    res.status(500).json({
      error: 'Failed to get performance analytics',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get system-wide analytics dashboard
router.get('/dashboard', async (req: any, res: Response) => {
  try {
    const { timeframe = '24h' } = req.query;

    // Get time range
    let dateFilter = "created_at >= NOW() - INTERVAL '1 day'";
    if (timeframe === '7d') dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
    else if (timeframe === '30d') dateFilter = "created_at >= NOW() - INTERVAL '30 days'";

    // System overview metrics
    const overviewQuery = await req.db.query(`
      SELECT 
        COUNT(DISTINCT proctor_id) as active_proctors,
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'approved') as approvals,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejections,
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) as avg_processing_time,
        AVG(violations_count) as avg_violations
      FROM exam_sessions
      WHERE ${dateFilter}
    `);

    const overview = overviewQuery.rows[0];

    // Performance distribution
    const allProctors = await req.db.query(`
      SELECT DISTINCT proctor_id FROM exam_sessions WHERE ${dateFilter}
    `);

    const performanceDistribution = {
      super: 0,
      standard: 0,  
      slow: 0,
      trainee: 0
    };

    // Get cached performance data for all proctors
    for (const { proctor_id } of allProctors.rows) {
      try {
        const perfData = await req.redis.hgetall(`proctor:${proctor_id}:performance`);
        const classification = perfData.classification;
        
        if (classification && performanceDistribution.hasOwnProperty(classification)) {
          performanceDistribution[classification]++;
        }
      } catch (error) {
        // Skip if no cached data
      }
    }

    // Hourly activity pattern
    const hourlyQuery = await req.db.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as sessions,
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) as avg_time
      FROM exam_sessions
      WHERE ${dateFilter}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `);

    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyQuery.rows.find(row => parseInt(row.hour) === hour);
      return {
        hour,
        sessions: data ? parseInt(data.sessions) : 0,
        avgProcessingTime: data ? parseFloat(data.avg_time) : 0
      };
    });

    // Top performers
    const topPerformersQuery = await req.db.query(`
      SELECT 
        proctor_id,
        COUNT(*) as sessions,
        AVG(accuracy_score) as avg_accuracy,
        COUNT(*) FILTER (WHERE status = 'approved') as approvals
      FROM exam_sessions
      WHERE ${dateFilter} AND accuracy_score IS NOT NULL
      GROUP BY proctor_id
      HAVING COUNT(*) >= 5
      ORDER BY AVG(accuracy_score) DESC, COUNT(*) DESC
      LIMIT 10
    `);

    const topPerformers = [];
    for (const perf of topPerformersQuery.rows) {
      const proctorData = await req.db.query(`
        SELECT name FROM proctors WHERE proctor_id = $1
      `, [perf.proctor_id]);

      if (proctorData.rows.length > 0) {
        topPerformers.push({
          proctorId: perf.proctor_id,
          name: proctorData.rows[0].name,
          sessions: parseInt(perf.sessions),
          avgAccuracy: parseFloat(perf.avg_accuracy).toFixed(2),
          approvals: parseInt(perf.approvals)
        });
      }
    }

    // System alerts
    const alerts = await getSystemAlerts(req.redis, req.db);

    res.json({
      overview: {
        activeProctors: parseInt(overview.active_proctors) || 0,
        totalSessions: parseInt(overview.total_sessions) || 0,  
        approvals: parseInt(overview.approvals) || 0,
        rejections: parseInt(overview.rejections) || 0,
        avgProcessingTime: parseFloat(overview.avg_processing_time) || 0,
        avgViolations: parseFloat(overview.avg_violations) || 0,
        approvalRate: overview.total_sessions > 0 ? 
          ((parseInt(overview.approvals) / parseInt(overview.total_sessions)) * 100).toFixed(1) + '%' : '0%'
      },
      performanceDistribution,
      hourlyActivity,
      topPerformers,
      alerts,
      filters: {
        timeframe
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Analytics dashboard error:', error);
    res.status(500).json({
      error: 'Failed to get analytics dashboard',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Helper functions

function calculateConsistencyScore(dailyMetrics: any[]): number {
  if (dailyMetrics.length < 3) return 0;
  
  const accuracies = dailyMetrics.map(m => m.avgAccuracy);
  const mean = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
  const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower standard deviation = higher consistency
  return Math.max(0, 100 - (stdDev * 2));
}

function calculateTrend(data: any[], field: string): 'improving' | 'declining' | 'stable' {
  if (data.length < 2) return 'stable';
  
  const values = data.map(d => d[field]);
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  if (diff > 2) return 'improving';
  if (diff < -2) return 'declining';
  return 'stable';
}

async function getProctorPeakHours(proctorId: string, db: any): Promise<number[]> {
  const hourlyQuery = await db.query(`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as sessions
    FROM exam_sessions
    WHERE proctor_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY sessions DESC
    LIMIT 3
  `, [proctorId]);

  return hourlyQuery.rows.map(row => parseInt(row.hour));
}

async function getPeerComparison(proctorId: string, classification: string, db: any, ghostService: any): Promise<any> {
  // Get other proctors with same classification
  const peersQuery = await db.query(`
    SELECT DISTINCT proctor_id FROM exam_sessions 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    AND proctor_id != $1
    LIMIT 10
  `, [proctorId]);

  const peerPerformances = [];
  for (const { proctor_id } of peersQuery.rows) {
    try {
      const perf = await ghostService.calculateProctorPerformance(proctor_id);
      if (perf.classification === classification) {
        peerPerformances.push({
          efficiencyRank: perf.efficiencyRank,
          throughputRate: perf.throughputRate,
          accuracyScore: perf.accuracyScore
        });
      }
    } catch (error) {
      // Skip if calculation fails
    }
  }

  if (peerPerformances.length === 0) {
    return {
      percentile: 50,
      aboveAverage: false,
      peerCount: 0
    };
  }

  // Calculate current proctor's performance
  const currentPerf = await ghostService.calculateProctorPerformance(proctorId);
  
  // Calculate percentile
  const betterThanCount = peerPerformances.filter(p => p.efficiencyRank < currentPerf.efficiencyRank).length;
  const percentile = Math.round((betterThanCount / peerPerformances.length) * 100);

  const avgPeerEfficiency = peerPerformances.reduce((sum, p) => sum + p.efficiencyRank, 0) / peerPerformances.length;

  return {
    percentile,
    aboveAverage: currentPerf.efficiencyRank > avgPeerEfficiency,
    peerCount: peerPerformances.length,
    avgPeerEfficiency: avgPeerEfficiency.toFixed(2)
  };
}

async function getSystemAlerts(redis: any, db: any): Promise<any[]> {
  const alerts = [];

  // Check for slow proctors
  const slowProctorsCount = await redis.get('analytics:slow_proctors_count') || '0';
  if (parseInt(slowProctorsCount) > 0) {
    alerts.push({
      type: 'warning',
      title: 'Performance Alert',
      message: `${slowProctorsCount} proctors showing slow performance`,
      priority: 'medium'
    });
  }

  // Check for capacity issues
  const utilizationRate = await redis.get('system:utilization_rate') || '0';
  if (parseFloat(utilizationRate) > 90) {
    alerts.push({
      type: 'critical',
      title: 'Capacity Alert', 
      message: `System at ${utilizationRate}% capacity`,
      priority: 'high'
    });
  }

  // Check for emergency assignments
  const emergencyCount = await redis.llen('assignments:emergency');
  if (emergencyCount > 5) {
    alerts.push({
      type: 'warning',
      title: 'Emergency Assignments',
      message: `${emergencyCount} emergency assignments in queue`,
      priority: 'medium'
    });
  }

  return alerts;
}

export default router;