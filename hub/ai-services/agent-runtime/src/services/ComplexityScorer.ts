import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { Logger } from '../utils/Logger';
import { ViolationEvent } from './EnhancedAgentEngine';

export interface ComplexityFactors {
  violationPattern: number;      // 0-3 points
  candidateBehavior: number;     // 0-2 points  
  examContext: number;           // 0-2 points
  historicalRisk: number;        // 0-2 points
  evidenceQuality: number;       // 0-1 points
}

export interface ComplexityAnalysis {
  sessionId: string;
  violationId: string;
  totalScore: number;            // 1-10 scale
  factors: ComplexityFactors;
  category: 'simple' | 'moderate' | 'complex' | 'critical';
  escalationRecommended: boolean;
  reasoning: string[];
  calculatedAt: Date;
}

export class ComplexityScorer {
  private logger = Logger.getInstance();
  private scoringCache = new Map<string, ComplexityAnalysis>();

  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection
  ) {}

  /**
   * Calculate complexity score for violation case
   * REQ-013: AI MUST score every case complexity (1-10 scale: simple to critical)
   * REQ-014: Scoring factors: violation patterns, candidate behavior anomalies, exam context
   */
  async calculateComplexity(violation: ViolationEvent): Promise<number> {
    try {
      const cacheKey = `complexity:${violation.sessionId}:${violation.violationType}`;
      
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const analysis = JSON.parse(cached);
        this.logger.info(`📊 Using cached complexity score: ${analysis.totalScore} for ${violation.sessionId}`);
        return analysis.totalScore;
      }

      // Calculate comprehensive complexity analysis
      const analysis = await this.performComplexityAnalysis(violation);
      
      // Store in cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(analysis));
      
      // Store in database for historical analysis
      await this.storeComplexityAnalysis(analysis);

      // Dynamic rescoring trigger (REQ-015)
      await this.scheduleRescoringIfNeeded(violation, analysis);

      this.logger.info(`🎯 Complexity calculated: ${analysis.totalScore}/10 (${analysis.category}) for ${violation.sessionId}`);
      
      return analysis.totalScore;

    } catch (error) {
      this.logger.error('Complexity calculation failed:', error);
      // Return default medium complexity on error
      return 5;
    }
  }

  /**
   * Perform comprehensive complexity analysis
   * REQ-014: Multi-factor scoring system
   */
  private async performComplexityAnalysis(violation: ViolationEvent): Promise<ComplexityAnalysis> {
    try {
      // Gather all complexity factors concurrently
      const [
        violationPattern,
        candidateBehavior, 
        examContext,
        historicalRisk,
        evidenceQuality
      ] = await Promise.all([
        this.analyzeViolationPattern(violation),
        this.analyzeCandidateBehavior(violation),
        this.analyzeExamContext(violation),
        this.analyzeHistoricalRisk(violation),
        this.analyzeEvidenceQuality(violation)
      ]);

      const factors: ComplexityFactors = {
        violationPattern,
        candidateBehavior,
        examContext,
        historicalRisk,
        evidenceQuality
      };

      // Calculate total score (1-10 scale)
      const totalScore = Math.min(10, Math.max(1, 
        violationPattern + candidateBehavior + examContext + historicalRisk + evidenceQuality
      ));

      // Determine category and escalation recommendation
      const category = this.determineComplexityCategory(totalScore);
      const escalationRecommended = this.shouldRecommendEscalation(totalScore, violation);

      // Generate reasoning explanation
      const reasoning = this.generateComplexityReasoning(factors, violation);

      const analysis: ComplexityAnalysis = {
        sessionId: violation.sessionId,
        violationId: `violation_${Date.now()}`,
        totalScore,
        factors,
        category,
        escalationRecommended,
        reasoning,
        calculatedAt: new Date()
      };

      return analysis;

    } catch (error) {
      this.logger.error('Failed to perform complexity analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze violation pattern complexity
   * Multiple violations, simultaneous violations, violation sequence patterns
   */
  private async analyzeViolationPattern(violation: ViolationEvent): Promise<number> {
    try {
      let score = 0;

      // Check for multiple recent violations in same session
      const recentViolations = await this.getRecentViolations(violation.sessionId, 300); // Last 5 minutes
      
      if (recentViolations.length >= 3) {
        score += 3; // Multiple violations = high complexity
      } else if (recentViolations.length === 2) {
        score += 2; // Two violations = moderate complexity  
      } else {
        score += 1; // Single violation = low complexity
      }

      // Check violation type complexity
      const violationComplexity = {
        'looking_away': 1,
        'mobile_device': 2,
        'prohibited_object': 2,
        'audio_anomaly': 2,
        'multiple_persons': 3 // Highest complexity
      };

      const typeComplexity = violationComplexity[violation.violationType] || 1;
      score = Math.min(3, score + typeComplexity - 1);

      this.logger.debug(`Violation pattern score: ${score}/3 for ${violation.violationType}`);
      return score;

    } catch (error) {
      this.logger.error('Failed to analyze violation pattern:', error);
      return 1; // Default low complexity
    }
  }

  /**
   * Analyze candidate behavior anomalies
   * Behavioral patterns, session duration, exam progress
   */
  private async analyzeCandidateBehavior(violation: ViolationEvent): Promise<number> {
    try {
      let score = 0;

      // Get candidate's session behavior data
      const behaviorData = await this.getCandidateBehaviorData(violation.candidateId, violation.sessionId);
      
      // Analyze behavior anomaly indicators
      if (behaviorData.suspiciousActivityCount > 5) {
        score += 2; // High anomaly
      } else if (behaviorData.suspiciousActivityCount > 2) {
        score += 1; // Moderate anomaly
      }

      // Check session progression anomalies
      if (behaviorData.sessionTimeSpent > behaviorData.expectedDuration * 1.5) {
        score += 1; // Taking too long
      }

      // Check gaze/attention patterns
      if (behaviorData.attentionScore < 0.5) {
        score += 1; // Poor attention patterns
      }

      score = Math.min(2, score);
      
      this.logger.debug(`Candidate behavior score: ${score}/2 for ${violation.candidateId}`);
      return score;

    } catch (error) {
      this.logger.error('Failed to analyze candidate behavior:', error);
      return 0; // Default no behavior complexity
    }
  }

  /**
   * Analyze exam context complexity
   * High-stakes vs standard exams, time pressure, subject matter
   */
  private async analyzeExamContext(violation: ViolationEvent): Promise<number> {
    try {
      let score = 0;

      // Get exam metadata
      const examData = await this.getExamContextData(violation.sessionId);
      
      // High-stakes exam increases complexity
      if (examData.isHighStakes) {
        score += 1;
      }

      // Time pressure increases complexity
      if (examData.timeRemaining < examData.totalDuration * 0.2) {
        score += 1; // Less than 20% time remaining
      }

      // Certification/professional exams are more complex
      if (examData.examType === 'certification' || examData.examType === 'professional') {
        score += 1;
      }

      score = Math.min(2, score);
      
      this.logger.debug(`Exam context score: ${score}/2 for session ${violation.sessionId}`);
      return score;

    } catch (error) {
      this.logger.error('Failed to analyze exam context:', error);
      return 0; // Default no context complexity
    }
  }

  /**
   * Analyze historical risk factors
   * Previous violations, candidate history, proctor notes
   */
  private async analyzeHistoricalRisk(violation: ViolationEvent): Promise<number> {
    try {
      let score = 0;

      // Check candidate's violation history
      const historicalViolations = await this.getCandidateViolationHistory(violation.candidateId);
      
      if (historicalViolations.length >= 3) {
        score += 2; // High historical risk
      } else if (historicalViolations.length >= 1) {
        score += 1; // Moderate historical risk
      }

      // Check for previous escalations
      const previousEscalations = historicalViolations.filter(v => v.wasEscalated);
      if (previousEscalations.length > 0) {
        score += 1;
      }

      score = Math.min(2, score);
      
      this.logger.debug(`Historical risk score: ${score}/2 for candidate ${violation.candidateId}`);
      return score;

    } catch (error) {
      this.logger.error('Failed to analyze historical risk:', error);
      return 0; // Default no historical risk
    }
  }

  /**
   * Analyze evidence quality
   * Image/video quality, audio clarity, metadata completeness
   */
  private async analyzeEvidenceQuality(violation: ViolationEvent): Promise<number> {
    try {
      let score = 0;

      // Check evidence completeness
      if (violation.evidence.screenshot && violation.evidence.videoClip) {
        score += 0.5; // Complete visual evidence
      }

      // Check AI confidence in evidence
      if (violation.confidence > 95) {
        score += 0.5; // High confidence evidence
      } else if (violation.confidence < 70) {
        score -= 0.5; // Low confidence reduces complexity (might be false positive)
      }

      score = Math.max(0, Math.min(1, score));
      
      this.logger.debug(`Evidence quality score: ${score}/1 for violation evidence`);
      return score;

    } catch (error) {
      this.logger.error('Failed to analyze evidence quality:', error);
      return 0.5; // Default medium evidence quality
    }
  }

  /**
   * Dynamic rescoring as session progresses
   * REQ-015: Dynamic rescoring as session progresses and new evidence emerges
   */
  async scheduleRescoringIfNeeded(violation: ViolationEvent, analysis: ComplexityAnalysis): Promise<void> {
    try {
      // Schedule rescoring for high-complexity cases that might change
      if (analysis.totalScore >= 7) {
        const rescoringKey = `rescore:${violation.sessionId}`;
        await this.redis.setex(rescoringKey, 600, JSON.stringify({ 
          sessionId: violation.sessionId,
          lastScore: analysis.totalScore,
          scheduledAt: new Date()
        }));

        this.logger.info(`📅 Rescoring scheduled for high-complexity session: ${violation.sessionId}`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule rescoring:', error);
    }
  }

  /**
   * Check escalation thresholds per organization
   * REQ-016: Complexity thresholds for auto-escalation (configurable per organization)
   */
  async checkEscalationThreshold(tenantId: string, complexityScore: number): Promise<boolean> {
    try {
      // Get tenant-specific escalation threshold
      const threshold = await this.getTenantEscalationThreshold(tenantId);
      
      const shouldEscalate = complexityScore >= threshold;
      
      if (shouldEscalate) {
        this.logger.info(`🚨 Escalation threshold met: ${complexityScore} >= ${threshold} for tenant ${tenantId}`);
      }
      
      return shouldEscalate;

    } catch (error) {
      this.logger.error('Failed to check escalation threshold:', error);
      return complexityScore >= 6; // Default threshold
    }
  }

  /**
   * Determine complexity category based on score
   */
  private determineComplexityCategory(score: number): ComplexityAnalysis['category'] {
    if (score >= 8) return 'critical';
    if (score >= 6) return 'complex';
    if (score >= 4) return 'moderate';
    return 'simple';
  }

  /**
   * Determine if escalation should be recommended
   */
  private shouldRecommendEscalation(score: number, violation: ViolationEvent): boolean {
    // Always escalate critical cases
    if (score >= 8) return true;
    
    // Escalate complex cases with high severity
    if (score >= 6 && violation.severity === 'high') return true;
    
    // Escalate multiple persons regardless of score
    if (violation.violationType === 'multiple_persons') return true;
    
    return false;
  }

  /**
   * Generate human-readable complexity reasoning
   */
  private generateComplexityReasoning(factors: ComplexityFactors, violation: ViolationEvent): string[] {
    const reasoning = [];

    if (factors.violationPattern >= 2) {
      reasoning.push('Multiple violation pattern detected');
    }
    
    if (factors.candidateBehavior >= 1) {
      reasoning.push('Behavioral anomalies observed');
    }
    
    if (factors.examContext >= 1) {
      reasoning.push('High-stakes or time-pressured exam context');
    }
    
    if (factors.historicalRisk >= 1) {
      reasoning.push('Candidate has previous violation history');
    }
    
    if (factors.evidenceQuality < 0.5) {
      reasoning.push('Evidence quality may affect confidence');
    }

    if (reasoning.length === 0) {
      reasoning.push('Standard complexity case');
    }

    return reasoning;
  }

  // Helper methods for data retrieval

  private async getRecentViolations(sessionId: string, secondsBack: number): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM p7_violations 
        WHERE session_id = $1 
        AND created_at > NOW() - INTERVAL '${secondsBack} seconds'
        ORDER BY created_at DESC
      `, [sessionId]);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get recent violations:', error);
      return [];
    }
  }

  private async getCandidateBehaviorData(candidateId: string, sessionId: string): Promise<{
    suspiciousActivityCount: number;
    sessionTimeSpent: number;
    expectedDuration: number;
    attentionScore: number;
  }> {
    try {
      // In a real implementation, this would query behavioral analytics
      return {
        suspiciousActivityCount: Math.floor(Math.random() * 10),
        sessionTimeSpent: 3600, // 1 hour in seconds
        expectedDuration: 3600, // Expected 1 hour
        attentionScore: 0.8
      };
    } catch (error) {
      this.logger.error('Failed to get candidate behavior data:', error);
      return {
        suspiciousActivityCount: 0,
        sessionTimeSpent: 3600,
        expectedDuration: 3600,
        attentionScore: 1.0
      };
    }
  }

  private async getExamContextData(sessionId: string): Promise<{
    isHighStakes: boolean;
    timeRemaining: number;
    totalDuration: number;
    examType: string;
  }> {
    try {
      // In a real implementation, this would query exam configuration
      return {
        isHighStakes: false,
        timeRemaining: 1800, // 30 minutes remaining
        totalDuration: 3600, // 1 hour total
        examType: 'standard'
      };
    } catch (error) {
      this.logger.error('Failed to get exam context data:', error);
      return {
        isHighStakes: false,
        timeRemaining: 3600,
        totalDuration: 3600,
        examType: 'standard'
      };
    }
  }

  private async getCandidateViolationHistory(candidateId: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM p7_violations 
        WHERE candidate_id = $1 
        AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 10
      `, [candidateId]);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get candidate violation history:', error);
      return [];
    }
  }

  private async getTenantEscalationThreshold(tenantId: string): Promise<number> {
    try {
      const cached = await this.redis.get(`threshold:${tenantId}`);
      if (cached) {
        return parseInt(cached);
      }

      const result = await this.db.query(`
        SELECT escalation_threshold FROM p7_tenant_config 
        WHERE tenant_id = $1
      `, [tenantId]);
      
      const threshold = result.rows[0]?.escalation_threshold || 6;
      
      // Cache for 1 hour
      await this.redis.setex(`threshold:${tenantId}`, 3600, threshold.toString());
      
      return threshold;
    } catch (error) {
      this.logger.error('Failed to get tenant escalation threshold:', error);
      return 6; // Default threshold
    }
  }

  private async storeComplexityAnalysis(analysis: ComplexityAnalysis): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_complexity_scores (
          session_id, violation_id, total_score, factors, 
          category, escalation_recommended, reasoning, calculated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        analysis.sessionId,
        analysis.violationId,
        analysis.totalScore,
        JSON.stringify(analysis.factors),
        analysis.category,
        analysis.escalationRecommended,
        JSON.stringify(analysis.reasoning),
        analysis.calculatedAt
      ]);
    } catch (error) {
      this.logger.error('Failed to store complexity analysis:', error);
    }
  }

  /**
   * Get complexity analysis by session
   */
  async getSessionComplexityHistory(sessionId: string): Promise<ComplexityAnalysis[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM p7_complexity_scores 
        WHERE session_id = $1 
        ORDER BY calculated_at DESC
      `, [sessionId]);

      return result.rows.map(row => ({
        sessionId: row.session_id,
        violationId: row.violation_id,
        totalScore: row.total_score,
        factors: row.factors,
        category: row.category,
        escalationRecommended: row.escalation_recommended,
        reasoning: row.reasoning,
        calculatedAt: row.calculated_at
      }));
    } catch (error) {
      this.logger.error('Failed to get session complexity history:', error);
      return [];
    }
  }

  /**
   * Update tenant escalation threshold
   * REQ-016: Configurable per organization
   */
  async updateTenantEscalationThreshold(tenantId: string, threshold: number): Promise<boolean> {
    try {
      if (threshold < 1 || threshold > 10) {
        throw new Error('Threshold must be between 1 and 10');
      }

      await this.db.query(`
        INSERT INTO p7_tenant_config (tenant_id, escalation_threshold, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (tenant_id) 
        DO UPDATE SET escalation_threshold = $2, updated_at = NOW()
      `, [tenantId, threshold]);

      // Update cache
      await this.redis.setex(`threshold:${tenantId}`, 3600, threshold.toString());

      this.logger.info(`🎯 Escalation threshold updated: ${tenantId} → ${threshold}`);
      return true;

    } catch (error) {
      this.logger.error('Failed to update tenant escalation threshold:', error);
      return false;
    }
  }
}