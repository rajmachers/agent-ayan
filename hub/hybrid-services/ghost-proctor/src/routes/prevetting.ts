/**
 * Pre-vetting Routes - Phase 7 Ghost Proctor Service
 * REQ-043: AI pre-vetting based on integrity/credibility score with tenant-configurable thresholds
 */
import express, { Request, Response } from 'express';

const router = express.Router();

// Process candidate pre-vetting with AI credibility scoring
router.post('/assess/:candidateId', async (req: any, res: Response) => {
  try {
    const { candidateId } = req.params;
    const { sessionId, tenantId, examId, enhancedAnalysis = false } = req.body;

    if (!tenantId || !examId) {
      return res.status(400).json({
        error: 'tenantId and examId are required for pre-vetting assessment',
        service: 'ghost-proctor-service-p7'
      });
    }

    // Check if candidate already has recent credibility assessment
    const existingAssessment = await req.redis.hgetall(`candidate:${candidateId}:credibility`);
    const assessmentAge = existingAssessment.timestamp ? 
      Date.now() - new Date(existingAssessment.timestamp).getTime() : Infinity;
    
    // Use cached assessment if less than 1 hour old and not requesting enhanced analysis
    if (assessmentAge < 3600000 && !enhancedAnalysis && existingAssessment.overallScore) {
      return res.json({
        message: 'Using cached credibility assessment',
        assessment: {
          candidateId,
          overallScore: parseFloat(existingAssessment.overallScore),
          riskLevel: existingAssessment.riskLevel,
          recommendedAction: existingAssessment.recommendedAction,
          factors: JSON.parse(existingAssessment.factors || '{}'),
          tenantThreshold: parseFloat(existingAssessment.tenantThreshold),
          confidenceLevel: parseFloat(existingAssessment.confidenceLevel),
          detectionReasons: JSON.parse(existingAssessment.detectionReasons || '[]'),
          cached: true,
          assessedAt: existingAssessment.timestamp
        },
        timestamp: new Date().toISOString()
      });
    }

    // Gather session data for comprehensive analysis
    const sessionData = {
      candidateId,
      sessionId,
      tenantId,
      examId,
      enhancedAnalysis
    };

    // Get candidate history from database for pattern analysis
    const candidateHistory = await req.db.query(`
      SELECT 
        session_id,
        status,
        violations_count,
        created_at,
        accuracy_score
      FROM exam_sessions 
      WHERE candidate_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [candidateId]);

    sessionData['history'] = candidateHistory.rows;

    // Calculate credibility score using AI assessment
    const credibilityScore = await req.ghostService.calculateCredibilityScore(candidateId, sessionData);

    // Log the assessment
    await req.redis.lpush(`prevetting:assessments`, JSON.stringify({
      candidateId,
      sessionId,
      tenantId,
      overallScore: credibilityScore.overallScore,
      riskLevel: credibilityScore.riskLevel,
      recommendedAction: credibilityScore.recommendedAction,
      timestamp: new Date().toISOString()
    }));
    await req.redis.expire(`prevetting:assessments`, 172800); // 48 hours

    // Update tenant statistics
    await req.redis.hincrby(`tenant:${tenantId}:prevetting:stats`, 'total_assessments', 1);
    await req.redis.hincrby(`tenant:${tenantId}:prevetting:stats`, credibilityScore.riskLevel, 1);

    req.logger.info('Pre-vetting assessment completed', {
      candidateId,
      sessionId,
      tenantId,
      overallScore: credibilityScore.overallScore,
      riskLevel: credibilityScore.riskLevel,
      recommendedAction: credibilityScore.recommendedAction
    });

    res.json({
      message: 'Credibility assessment completed successfully',
      assessment: {
        ...credibilityScore,
        cached: false,
        assessedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Pre-vetting assessment error:', error);
    res.status(500).json({
      error: 'Failed to process credibility assessment',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get credibility score for a candidate
router.get('/score/:candidateId', async (req: any, res: Response) => {
  try {
    const { candidateId } = req.params;

    // Get cached credibility data
    const credibilityData = await req.redis.hgetall(`candidate:${candidateId}:credibility`);

    if (!credibilityData.overallScore) {
      return res.status(404).json({
        error: 'No credibility assessment found for candidate',
        candidateId,
        message: 'Run pre-vetting assessment first',
        service: 'ghost-proctor-service-p7'
      });
    }

    // Parse the stored data
    const assessment = {
      candidateId,
      overallScore: parseFloat(credibilityData.overallScore),
      riskLevel: credibilityData.riskLevel,
      recommendedAction: credibilityData.recommendedAction,
      factors: JSON.parse(credibilityData.factors || '{}'),
      tenantThreshold: parseFloat(credibilityData.tenantThreshold),
      confidenceLevel: parseFloat(credibilityData.confidenceLevel),
      detectionReasons: JSON.parse(credibilityData.detectionReasons || '[]'),
      assessedAt: credibilityData.timestamp
    };

    // Get assessment age
    const assessmentAge = Date.now() - new Date(assessment.assessedAt).getTime();
    const ageHours = Math.floor(assessmentAge / (1000 * 60 * 60));

    res.json({
      assessment,
      metadata: {
        ageHours,
        isRecent: ageHours < 24,
        needsRefresh: ageHours > 48
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Credibility score retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get credibility score',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Configure tenant credibility thresholds
router.put('/thresholds/:tenantId', async (req: any, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { 
      autoApprovalThreshold = 85,
      humanReviewThreshold = 60,
      rejectionThreshold = 30,
      enhancedMonitoringThreshold = 70
    } = req.body;

    // Validate thresholds
    const thresholds = {
      autoApprovalThreshold: parseFloat(autoApprovalThreshold),
      humanReviewThreshold: parseFloat(humanReviewThreshold),
      rejectionThreshold: parseFloat(rejectionThreshold),
      enhancedMonitoringThreshold: parseFloat(enhancedMonitoringThreshold)
    };

    // Validate ranges
    for (const [key, value] of Object.entries(thresholds)) {
      if (value < 0 || value > 100) {
        return res.status(400).json({
          error: `Invalid threshold value for ${key}: must be between 0 and 100`,
          service: 'ghost-proctor-service-p7'
        });
      }
    }

    // Store tenant thresholds
    await req.redis.hset(`tenant:${tenantId}:credibility_thresholds`, {
      ...thresholds,
      updatedAt: new Date().toISOString()
    });

    // Update main threshold for compatibility
    await req.redis.set(
      `tenant:${tenantId}:credibility_threshold`, 
      thresholds.humanReviewThreshold,
      'EX',
      86400
    );

    // Log configuration change
    await req.redis.lpush(`tenant:${tenantId}:threshold_changes`, JSON.stringify({
      ...thresholds,
      changedAt: new Date().toISOString(),
      action: 'updated'
    }));
    await req.redis.expire(`tenant:${tenantId}:threshold_changes`, 2592000); // 30 days

    req.logger.info('Tenant credibility thresholds updated', {
      tenantId,
      thresholds
    });

    res.json({
      message: 'Credibility thresholds updated successfully',
      tenantId,
      thresholds,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Threshold configuration error:', error);
    res.status(500).json({
      error: 'Failed to update credibility thresholds',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get tenant credibility configuration and statistics
router.get('/config/:tenantId', async (req: any, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Get tenant thresholds
    const thresholdData = await req.redis.hgetall(`tenant:${tenantId}:credibility_thresholds`);
    
    const thresholds = Object.keys(thresholdData).length > 0 ? {
      autoApprovalThreshold: parseFloat(thresholdData.autoApprovalThreshold) || 85,
      humanReviewThreshold: parseFloat(thresholdData.humanReviewThreshold) || 60,
      rejectionThreshold: parseFloat(thresholdData.rejectionThreshold) || 30,
      enhancedMonitoringThreshold: parseFloat(thresholdData.enhancedMonitoringThreshold) || 70,
      updatedAt: thresholdData.updatedAt
    } : {
      autoApprovalThreshold: 85,
      humanReviewThreshold: 60,
      rejectionThreshold: 30,
      enhancedMonitoringThreshold: 70,
      updatedAt: null
    };

    // Get tenant statistics
    const stats = await req.redis.hgetall(`tenant:${tenantId}:prevetting:stats`);
    const tenantStats = {
      totalAssessments: parseInt(stats.total_assessments) || 0,
      lowRisk: parseInt(stats.low) || 0,
      mediumRisk: parseInt(stats.medium) || 0,
      highRisk: parseInt(stats.high) || 0,
      criticalRisk: parseInt(stats.critical) || 0
    };

    // Calculate percentages
    const total = tenantStats.totalAssessments;
    const percentages = {
      lowRisk: total > 0 ? ((tenantStats.lowRisk / total) * 100).toFixed(1) : '0.0',
      mediumRisk: total > 0 ? ((tenantStats.mediumRisk / total) * 100).toFixed(1) : '0.0',
      highRisk: total > 0 ? ((tenantStats.highRisk / total) * 100).toFixed(1) : '0.0',
      criticalRisk: total > 0 ? ((tenantStats.criticalRisk / total) * 100).toFixed(1) : '0.0'
    };

    // Get recent threshold changes
    const recentChanges = await req.redis.lrange(`tenant:${tenantId}:threshold_changes`, 0, 4);
    const thresholdHistory = recentChanges.map(change => {
      try {
        return JSON.parse(change);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Get recent assessments
    const recentAssessments = await req.redis.lrange(`prevetting:assessments`, 0, 19);
    const tenantAssessments = recentAssessments.map(assessment => {
      try {
        const parsed = JSON.parse(assessment);
        return parsed.tenantId === tenantId ? parsed : null;
      } catch {
        return null;
      }
    }).filter(Boolean).slice(0, 10);

    res.json({
      tenantId,
      configuration: {
        thresholds,
        isConfigured: thresholds.updatedAt !== null
      },
      statistics: {
        ...tenantStats,
        percentages
      },
      recentActivity: {
        thresholdChanges: thresholdHistory,
        recentAssessments: tenantAssessments
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Tenant configuration retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get tenant configuration',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Batch assessment for multiple candidates
router.post('/batch-assess', async (req: any, res: Response) => {
  try {
    const { candidates, tenantId, examId } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        error: 'candidates array is required and must not be empty',
        service: 'ghost-proctor-service-p7'
      });
    }

    if (!tenantId || !examId) {
      return res.status(400).json({
        error: 'tenantId and examId are required for batch assessment',
        service: 'ghost-proctor-service-p7'
      });
    }

    if (candidates.length > 50) {
      return res.status(400).json({
        error: 'Batch size limited to 50 candidates',
        service: 'ghost-proctor-service-p7'
      });
    }

    const batchId = require('uuid').v4();
    const results = [];

    // Process each candidate
    for (const candidateId of candidates) {
      try {
        const sessionData = {
          candidateId,
          tenantId,
          examId,
          batchId,
          batchProcessing: true
        };

        const credibilityScore = await req.ghostService.calculateCredibilityScore(candidateId, sessionData);
        results.push({
          candidateId,
          success: true,
          assessment: credibilityScore
        });

        // Brief delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        req.logger.warn(`Batch assessment failed for candidate ${candidateId}:`, error);
        results.push({
          candidateId,
          success: false,
          error: error.message || 'Assessment failed'
        });
      }
    }

    // Store batch results
    await req.redis.hset(`batch:${batchId}`, {
      tenantId,
      examId,
      totalCandidates: candidates.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results: JSON.stringify(results),
      processedAt: new Date().toISOString()
    });
    await req.redis.expire(`batch:${batchId}`, 86400); // 24 hours

    // Update tenant statistics
    await req.redis.hincrby(`tenant:${tenantId}:prevetting:stats`, 'batch_assessments', 1);
    await req.redis.hincrby(`tenant:${tenantId}:prevetting:stats`, 'total_assessments', results.filter(r => r.success).length);

    const summary = {
      total: candidates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      riskDistribution: {
        low: results.filter(r => r.success && r.assessment.riskLevel === 'low').length,
        medium: results.filter(r => r.success && r.assessment.riskLevel === 'medium').length,
        high: results.filter(r => r.success && r.assessment.riskLevel === 'high').length,
        critical: results.filter(r => r.success && r.assessment.riskLevel === 'critical').length
      }
    };

    req.logger.info('Batch pre-vetting assessment completed', {
      batchId,
      tenantId,
      examId,
      summary
    });

    res.json({
      message: 'Batch credibility assessment completed',
      batchId,
      summary,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Batch assessment error:', error);
    res.status(500).json({
      error: 'Failed to process batch credibility assessment',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get assessment analytics and trends
router.get('/analytics/:tenantId', async (req: any, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { timeframe = '7d' } = req.query;

    // Get recent assessments from the log
    const recentAssessments = await req.redis.lrange(`prevetting:assessments`, 0, 999);
    const tenantAssessments = recentAssessments.map(assessment => {
      try {
        const parsed = JSON.parse(assessment);
        return parsed.tenantId === tenantId ? parsed : null;
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Filter by timeframe
    const cutoffDate = new Date();
    if (timeframe === '24h') cutoffDate.setHours(cutoffDate.getHours() - 24);
    else if (timeframe === '7d') cutoffDate.setDate(cutoffDate.getDate() - 7);
    else if (timeframe === '30d') cutoffDate.setDate(cutoffDate.getDate() - 30);

    const filteredAssessments = tenantAssessments.filter(a => 
      new Date(a.timestamp) >= cutoffDate
    );

    // Calculate analytics
    const analytics = {
      totalAssessments: filteredAssessments.length,
      averageScore: filteredAssessments.length > 0 ? 
        (filteredAssessments.reduce((sum, a) => sum + a.overallScore, 0) / filteredAssessments.length).toFixed(2) : 0,
      riskDistribution: {
        low: filteredAssessments.filter(a => a.riskLevel === 'low').length,
        medium: filteredAssessments.filter(a => a.riskLevel === 'medium').length,
        high: filteredAssessments.filter(a => a.riskLevel === 'high').length,
        critical: filteredAssessments.filter(a => a.riskLevel === 'critical').length
      },
      actionDistribution: {
        auto_approve: filteredAssessments.filter(a => a.recommendedAction === 'auto_approve').length,
        human_review: filteredAssessments.filter(a => a.recommendedAction === 'human_review').length,
        enhanced_monitoring: filteredAssessments.filter(a => a.recommendedAction === 'enhanced_monitoring').length,
        reject: filteredAssessments.filter(a => a.recommendedAction === 'reject').length
      }
    };

    // Daily trend (last 7 days)
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayAssessments = filteredAssessments.filter(a => {
        const assessmentDate = new Date(a.timestamp);
        return assessmentDate >= dayStart && assessmentDate <= dayEnd;
      });

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        count: dayAssessments.length,
        averageScore: dayAssessments.length > 0 ? 
          (dayAssessments.reduce((sum, a) => sum + a.overallScore, 0) / dayAssessments.length).toFixed(2) : 0,
        highRiskCount: dayAssessments.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length
      });
    }

    res.json({
      tenantId,
      timeframe,
      analytics,
      dailyTrend,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Assessment analytics error:', error);
    res.status(500).json({
      error: 'Failed to get assessment analytics',
      service: 'ghost-proctor-service-p7'
    });
  }
});

export default router;