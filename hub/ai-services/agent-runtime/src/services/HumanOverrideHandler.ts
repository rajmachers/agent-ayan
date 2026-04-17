import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { Logger } from '../utils/Logger';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { ViolationEvent } from './EnhancedAgentEngine';

export interface OverrideCommand {
  overrideId: string;
  sessionId: string;
  violationId: string;
  proctorId: string;
  proctorName: string;
  originalAIDecision: {
    action: string;
    confidence: number;
    reasoning: string;
  };
  humanDecision: {
    action: 'dismiss' | 'warning' | 'flag' | 'terminate' | 'escalate_higher';
    reasoning: string;
    confidence: number;
    evidence: string[];
    contextNotes: string;
  };
  overrideType: 'correction' | 'escalation' | 'context_override' | 'false_positive';
  priority: 'immediate' | 'normal' | 'batch';
  executedAt: Date;
  acknowledgedAt?: Date;
  learningFeedback?: {
    aiAccuracy: number; // 1-100 score
    reasoningQuality: number; // 1-100 score
    contextMissed: string[];
    improvementAreas: string[];
  };
}

export interface AILearningData {
  caseId: string;
  violationType: string;
  complexityScore: number;
  aiPrediction: string;
  humanCorrection: string;
  accuracyGap: number; // Difference in confidence scores
  contextFactors: string[];
  feedbackCategory: 'accuracy' | 'context' | 'reasoning' | 'false_positive';
  learningValue: number; // Weight for training data
  extractedAt: Date;
}

export class HumanOverrideHandler {
  private logger = Logger.getInstance();
  private overrideQueue = new Map<string, OverrideCommand>();
  private learningBuffer: AILearningData[] = [];
  private readonly BATCH_SIZE = 50;

  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection,
    private websocketManager: WebSocketManager
  ) {
    // Initialize learning data processing
    this.startLearningDataProcessor();
  }

  /**
   * Process human override command with immediate effect
   * REQ-020: Human proctors can override AI decisions with immediate effect
   */
  async processHumanOverride(
    sessionId: string,
    violationId: string,
    proctorId: string,
    originalAI: any,
    humanDecision: any,
    priority: OverrideCommand['priority'] = 'normal'
  ): Promise<string> {
    try {
      const overrideId = `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get proctor details
      const proctor = await this.getProctorDetails(proctorId);
      
      const overrideCommand: OverrideCommand = {
        overrideId,
        sessionId,
        violationId,
        proctorId,
        proctorName: proctor.name,
        originalAIDecision: originalAI,
        humanDecision,
        overrideType: this.determineOverrideType(originalAI, humanDecision),
        priority,
        executedAt: new Date()
      };

      // Store override command
      await this.storeOverrideCommand(overrideCommand);
      
      // Add to processing queue
      this.overrideQueue.set(overrideId, overrideCommand);

      // Execute immediate override based on priority
      if (priority === 'immediate') {
        await this.executeImmediateOverride(overrideCommand);
      } else {
        await this.scheduleOverrideExecution(overrideCommand);
      }

      // Extract learning data for AI improvement (REQ-023)
      await this.extractLearningData(overrideCommand);

      this.logger.info(`👩‍💼 Human override processed: ${overrideId} (${priority}) by ${proctor.name}`);
      
      return overrideId;

    } catch (error) {
      this.logger.error('Failed to process human override:', error);
      throw error;
    }
  }

  /**
   * Execute immediate override with <1 second response time
   * REQ-020: Immediate effect requirement
   */
  private async executeImmediateOverride(override: OverrideCommand): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Apply the human decision immediately
      await Promise.all([
        this.applySessionAction(override),
        this.updateViolationRecord(override),
        this.notifyAllParticipants(override),
        this.updateProctorMetrics(override)
      ]);

      const executionTime = Date.now() - startTime;
      
      // Mark as acknowledged
      override.acknowledgedAt = new Date();
      await this.updateOverrideStatus(override.overrideId, 'executed');

      this.logger.info(`⚡ Immediate override executed in ${executionTime}ms: ${override.overrideId}`);

    } catch (error) {
      this.logger.error('Failed to execute immediate override:', error);
      throw error;
    }
  }

  /**
   * Apply the human decision to the session
   */
  private async applySessionAction(override: OverrideCommand): Promise<void> {
    try {
      const { action, reasoning } = override.humanDecision;
      
      switch (action) {
        case 'dismiss':
          await this.dismissViolation(override);
          break;
          
        case 'warning':
          await this.issueWarning(override);
          break;
          
        case 'flag':
          await this.flagForReview(override);
          break;
          
        case 'terminate':
          await this.terminateSession(override);
          break;
          
        case 'escalate_higher':
          await this.escalateToSupervisor(override);
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Log the action application
      await this.logActionExecution(override, action);

    } catch (error) {
      this.logger.error('Failed to apply session action:', error);
      throw error;
    }
  }

  /**
   * Dismiss violation - clear all flags and continue session
   */
  private async dismissViolation(override: OverrideCommand): Promise<void> {
    try {
      // Remove violation flags
      await this.db.query(`
        UPDATE p7_violations 
        SET status = 'dismissed', dismissed_by = $2, dismissed_at = NOW(),
            dismissal_reason = $3
        WHERE violation_id = $1
      `, [override.violationId, override.proctorId, override.humanDecision.reasoning]);

      // Notify session to continue normally
      await this.websocketManager.sendToSession(override.sessionId, {
        type: 'violation_dismissed',
        violationId: override.violationId,
        proctorName: override.proctorName,
        message: 'Violation has been reviewed and dismissed. You may continue.',
        reasoning: override.humanDecision.reasoning
      });

      this.logger.info(`✅ Violation dismissed: ${override.violationId} by ${override.proctorName}`);

    } catch (error) {
      this.logger.error('Failed to dismiss violation:', error);
      throw error;
    }
  }

  /**
   * Issue warning to candidate
   */
  private async issueWarning(override: OverrideCommand): Promise<void> {
    try {
      // Record warning
      await this.db.query(`
        INSERT INTO p7_warnings (
          session_id, violation_id, issued_by, warning_text, issued_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [override.sessionId, override.violationId, override.proctorId, override.humanDecision.reasoning]);

      // Send warning to candidate
      await this.websocketManager.sendToSession(override.sessionId, {
        type: 'warning_issued',
        violationId: override.violationId,
        proctorName: override.proctorName,
        message: override.humanDecision.reasoning,
        severity: 'warning',
        acknowledgeRequired: true
      });

      this.logger.info(`⚠️  Warning issued: ${override.violationId} by ${override.proctorName}`);

    } catch (error) {
      this.logger.error('Failed to issue warning:', error);
      throw error;
    }
  }

  /**
   * Flag violation for review but allow session to continue
   */
  private async flagForReview(override: OverrideCommand): Promise<void> {
    try {
      // Update violation status
      await this.db.query(`
        UPDATE p7_violations 
        SET status = 'flagged', flagged_by = $2, flagged_at = NOW(),
            flag_reason = $3, review_required = true
        WHERE violation_id = $1
      `, [override.violationId, override.proctorId, override.humanDecision.reasoning]);

      // Notify candidate (optional based on tenant settings)
      await this.websocketManager.sendToSession(override.sessionId, {
        type: 'violation_flagged',
        violationId: override.violationId,
        message: 'Behavior has been noted. Please maintain exam integrity.',
        allowContinue: true
      });

      this.logger.info(`🚩 Violation flagged: ${override.violationId} by ${override.proctorName}`);

    } catch (error) {
      this.logger.error('Failed to flag violation:', error);
      throw error;
    }
  }

  /**
   * Terminate session immediately
   */
  private async terminateSession(override: OverrideCommand): Promise<void> {
    try {
      // Mark session as terminated
      await this.db.query(`
        UPDATE p7_sessions 
        SET status = 'terminated', terminated_by = $2, terminated_at = NOW(),
            termination_reason = $3
        WHERE session_id = $1
      `, [override.sessionId, override.proctorId, override.humanDecision.reasoning]);

      // Force close session
      await this.websocketManager.sendToSession(override.sessionId, {
        type: 'session_terminated',
        violationId: override.violationId,
        proctorName: override.proctorName,
        reason: override.humanDecision.reasoning,
        immediate: true,
        appealProcess: true
      });

      this.logger.info(`❌ Session terminated: ${override.sessionId} by ${override.proctorName}`);

    } catch (error) {
      this.logger.error('Failed to terminate session:', error);
      throw error;
    }
  }

  /**
   * Escalate to supervisor level
   */
  private async escalateToSupervisor(override: OverrideCommand): Promise<void> {
    try {
      // Create supervisor escalation
      await this.db.query(`
        INSERT INTO p7_supervisor_escalations (
          session_id, violation_id, escalated_by, escalation_reason,
          urgency_level, escalated_at
        ) VALUES ($1, $2, $3, $4, 'high', NOW())
      `, [override.sessionId, override.violationId, override.proctorId, override.humanDecision.reasoning]);

      // Notify supervisors
      await this.websocketManager.broadcast('supervisors', {
        type: 'supervisor_escalation',
        sessionId: override.sessionId,
        violationId: override.violationId,
        escalatedBy: override.proctorName,
        reason: override.humanDecision.reasoning,
        urgency: 'high'
      });

      this.logger.info(`⬆️  Escalated to supervisor: ${override.violationId} by ${override.proctorName}`);

    } catch (error) {
      this.logger.error('Failed to escalate to supervisor:', error);
      throw error;
    }
  }

  /**
   * Extract learning data for AI improvement
   * REQ-023: System learns from human corrections to improve AI accuracy over time
   */
  private async extractLearningData(override: OverrideCommand): Promise<void> {
    try {
      const learningData: AILearningData = {
        caseId: override.violationId,
        violationType: await this.getViolationType(override.violationId),
        complexityScore: await this.getComplexityScore(override.violationId),
        aiPrediction: override.originalAIDecision.action,
        humanCorrection: override.humanDecision.action,
        accuracyGap: Math.abs(override.originalAIDecision.confidence - override.humanDecision.confidence),
        contextFactors: this.extractContextFactors(override),
        feedbackCategory: override.overrideType === 'false_positive' ? 'false_positive' : 
                         override.overrideType === 'context_override' ? 'context' :
                         override.overrideType === 'correction' ? 'accuracy' : 'reasoning',
        learningValue: this.calculateLearningValue(override),
        extractedAt: new Date()
      };

      // Add to learning buffer
      this.learningBuffer.push(learningData);

      // Process batch if buffer is full
      if (this.learningBuffer.length >= this.BATCH_SIZE) {
        await this.processBatchLearningData();
      }

      this.logger.debug(`📚 Learning data extracted: ${learningData.feedbackCategory} for ${override.violationId}`);

    } catch (error) {
      this.logger.error('Failed to extract learning data:', error);
    }
  }

  /**
   * Calculate learning value based on override characteristics
   */
  private calculateLearningValue(override: OverrideCommand): number {
    let value = 1.0; // Base value

    // Higher value for corrections vs escalations
    if (override.overrideType === 'correction') value *= 1.5;
    
    // Higher value for confident human decisions
    if (override.humanDecision.confidence > 90) value *= 1.3;
    
    // Higher value for significant accuracy gaps
    const accuracyGap = Math.abs(override.originalAIDecision.confidence - override.humanDecision.confidence);
    if (accuracyGap > 30) value *= 1.4;
    
    // Higher value for false positives (important to learn)
    if (override.overrideType === 'false_positive') value *= 2.0;

    return Math.min(5.0, value); // Cap at 5.0
  }

  /**
   * Track all override decisions for learning
   * REQ-021: Track all override decisions for learning and audit
   */
  async trackOverrideDecision(
    overrideId: string,
    outcome: 'successful' | 'disputed' | 'appealed',
    feedback?: {
      candidateFeedback?: string;
      supervisorReview?: string;
      outcomeAccuracy?: number;
    }
  ): Promise<void> {
    try {
      // Store outcome tracking
      await this.db.query(`
        INSERT INTO p7_override_tracking (
          override_id, outcome, candidate_feedback, supervisor_review,
          outcome_accuracy, tracked_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        overrideId,
        outcome,
        feedback?.candidateFeedback,
        feedback?.supervisorReview,
        feedback?.outcomeAccuracy
      ]);

      // Update learning feedback if provided
      if (feedback?.outcomeAccuracy) {
        const override = this.overrideQueue.get(overrideId);
        if (override) {
          override.learningFeedback = {
            aiAccuracy: this.calculateAIAccuracy(override, feedback.outcomeAccuracy),
            reasoningQuality: feedback.outcomeAccuracy,
            contextMissed: this.identifyMissedContext(override),
            improvementAreas: this.identifyImprovementAreas(override)
          };

          await this.updateOverrideLearningFeedback(overrideId, override.learningFeedback);
        }
      }

      this.logger.info(`📊 Override decision tracked: ${overrideId} → ${outcome}`);

    } catch (error) {
      this.logger.error('Failed to track override decision:', error);
    }
  }

  /**
   * Generate learning insights for AI model improvement
   * REQ-022: Provide learning insights to improve future AI decisions
   */
  async generateLearningInsights(timeRange: string = '7d'): Promise<{
    overridePatterns: any[];
    aiAccuracyTrends: any[];
    commonMistakes: any[];
    improvementRecommendations: string[];
    confidenceCalibration: any;
  }> {
    try {
      const interval = timeRange === '1d' ? '1 day' : 
                     timeRange === '7d' ? '7 days' : 
                     '30 days';

      const [patterns, accuracy, mistakes] = await Promise.all([
        this.analyzeOverridePatterns(interval),
        this.analyzeAccuracyTrends(interval),
        this.analyzeCommonMistakes(interval)
      ]);

      const recommendations = this.generateImprovementRecommendations(patterns, accuracy, mistakes);
      const calibration = this.analyzeConfidenceCalibration(accuracy);

      return {
        overridePatterns: patterns,
        aiAccuracyTrends: accuracy,
        commonMistakes: mistakes,
        improvementRecommendations: recommendations,
        confidenceCalibration: calibration
      };

    } catch (error) {
      this.logger.error('Failed to generate learning insights:', error);
      return {
        overridePatterns: [],
        aiAccuracyTrends: [],
        commonMistakes: [],
        improvementRecommendations: [],
        confidenceCalibration: {}
      };
    }
  }

  /**
   * Process batch learning data for AI training
   */
  private async processBatchLearningData(): Promise<void> {
    try {
      if (this.learningBuffer.length === 0) return;

      // Store batch in database
      const batchId = `batch_${Date.now()}`;
      await this.db.query(`
        INSERT INTO p7_learning_batches (
          batch_id, learning_data, processed_at, batch_size
        ) VALUES ($1, $2, NOW(), $3)
      `, [batchId, JSON.stringify(this.learningBuffer), this.learningBuffer.length]);

      // Send to AI training pipeline
      await this.websocketManager.sendToService('ai-training', {
        type: 'learning_batch',
        batchId,
        data: this.learningBuffer,
        priority: 'normal'
      });

      this.logger.info(`📦 Learning batch processed: ${batchId} (${this.learningBuffer.length} samples)`);
      
      // Clear buffer
      this.learningBuffer = [];

    } catch (error) {
      this.logger.error('Failed to process batch learning data:', error);
    }
  }

  /**
   * Start learning data processor (periodic batch processing)
   */
  private startLearningDataProcessor(): void {
    // Process learning data every 5 minutes
    setInterval(async () => {
      try {
        if (this.learningBuffer.length > 0) {
          await this.processBatchLearningData();
        }
      } catch (error) {
        this.logger.error('Learning data processor error:', error);
      }
    }, 300000); // 5 minutes
  }

  // Helper methods for data analysis and extraction

  private determineOverrideType(originalAI: any, humanDecision: any): OverrideCommand['overrideType'] {
    if (humanDecision.action === 'dismiss' && originalAI.confidence > 80) {
      return 'false_positive';
    }
    
    if (humanDecision.action === 'escalate_higher') {
      return 'escalation';
    }
    
    if (humanDecision.contextNotes && humanDecision.contextNotes.length > 0) {
      return 'context_override';
    }
    
    return 'correction';
  }

  private extractContextFactors(override: OverrideCommand): string[] {
    const factors = [];
    
    if (override.humanDecision.contextNotes) {
      factors.push('human_context_provided');
    }
    
    if (override.humanDecision.evidence.length > 0) {
      factors.push('additional_evidence');
    }
    
    if (override.overrideType === 'false_positive') {
      factors.push('ai_misclassification');
    }
    
    return factors;
  }

  private calculateAIAccuracy(override: OverrideCommand, outcomeAccuracy: number): number {
    // Compare AI prediction with actual outcome
    const aiConfidence = override.originalAIDecision.confidence;
    const humanConfidence = override.humanDecision.confidence;
    
    // If human was right and AI was wrong, AI accuracy is low
    if (outcomeAccuracy > 80 && Math.abs(aiConfidence - humanConfidence) > 30) {
      return Math.max(0, 100 - Math.abs(aiConfidence - outcomeAccuracy));
    }
    
    return Math.min(100, aiConfidence + (outcomeAccuracy - humanConfidence));
  }

  private identifyMissedContext(override: OverrideCommand): string[] {
    const missed = [];
    
    if (override.humanDecision.contextNotes.includes('cultural')) {
      missed.push('cultural_context');
    }
    
    if (override.humanDecision.contextNotes.includes('medical') || 
        override.humanDecision.contextNotes.includes('disability')) {
      missed.push('accessibility_needs');
    }
    
    if (override.humanDecision.contextNotes.includes('technical') ||
        override.humanDecision.contextNotes.includes('equipment')) {
      missed.push('technical_issues');
    }
    
    return missed;
  }

  private identifyImprovementAreas(override: OverrideCommand): string[] {
    const areas = [];
    
    if (override.overrideType === 'false_positive') {
      areas.push('reduce_false_positives');
    }
    
    if (override.overrideType === 'context_override') {
      areas.push('improve_context_awareness');
    }
    
    const confidenceGap = Math.abs(
      override.originalAIDecision.confidence - override.humanDecision.confidence
    );
    
    if (confidenceGap > 40) {
      areas.push('calibrate_confidence_scores');
    }
    
    return areas;
  }

  // Database helper methods

  private async getProctorDetails(proctorId: string): Promise<{ name: string; email: string }> {
    try {
      const result = await this.db.query(`
        SELECT name, email FROM p7_proctors WHERE proctor_id = $1
      `, [proctorId]);

      if (result.rows.length === 0) {
        throw new Error(`Proctor ${proctorId} not found`);
      }

      return {
        name: result.rows[0].name,
        email: result.rows[0].email
      };
    } catch (error) {
      this.logger.error('Failed to get proctor details:', error);
      return { name: 'Unknown Proctor', email: '' };
    }
  }

  private async getViolationType(violationId: string): Promise<string> {
    try {
      const result = await this.db.query(`
        SELECT violation_type FROM p7_violations WHERE violation_id = $1
      `, [violationId]);

      return result.rows[0]?.violation_type || 'unknown';
    } catch (error) {
      this.logger.error('Failed to get violation type:', error);
      return 'unknown';
    }
  }

  private async getComplexityScore(violationId: string): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT total_score FROM p7_complexity_scores WHERE violation_id = $1
      `, [violationId]);

      return result.rows[0]?.total_score || 5;
    } catch (error) {
      this.logger.error('Failed to get complexity score:', error);
      return 5;
    }
  }

  private async storeOverrideCommand(override: OverrideCommand): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_human_overrides (
          override_id, session_id, violation_id, proctor_id, proctor_name,
          original_ai_decision, human_decision, override_type, priority,
          executed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        override.overrideId,
        override.sessionId,
        override.violationId,
        override.proctorId,
        override.proctorName,
        JSON.stringify(override.originalAIDecision),
        JSON.stringify(override.humanDecision),
        override.overrideType,
        override.priority,
        override.executedAt
      ]);
    } catch (error) {
      this.logger.error('Failed to store override command:', error);
    }
  }

  private async updateOverrideStatus(overrideId: string, status: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_human_overrides 
        SET status = $2, acknowledged_at = NOW()
        WHERE override_id = $1
      `, [overrideId, status]);
    } catch (error) {
      this.logger.error('Failed to update override status:', error);
    }
  }

  private async updateOverrideLearningFeedback(overrideId: string, feedback: any): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_human_overrides 
        SET learning_feedback = $2
        WHERE override_id = $1
      `, [overrideId, JSON.stringify(feedback)]);
    } catch (error) {
      this.logger.error('Failed to update override learning feedback:', error);
    }
  }

  private async scheduleOverrideExecution(override: OverrideCommand): Promise<void> {
    // For non-immediate overrides, process after short delay for batching
    setTimeout(async () => {
      try {
        await this.executeImmediateOverride(override);
      } catch (error) {
        this.logger.error('Failed to execute scheduled override:', error);
      }
    }, 1000); // 1 second delay for normal priority
  }

  private async updateViolationRecord(override: OverrideCommand): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_violations 
        SET human_override = true, override_decision = $2, 
            overridden_by = $3, overridden_at = NOW()
        WHERE violation_id = $1
      `, [override.violationId, override.humanDecision.action, override.proctorId]);
    } catch (error) {
      this.logger.error('Failed to update violation record:', error);
    }
  }

  private async notifyAllParticipants(override: OverrideCommand): Promise<void> {
    try {
      // Notify session participants
      await this.websocketManager.sendToSession(override.sessionId, {
        type: 'human_override_applied',
        overrideId: override.overrideId,
        proctorName: override.proctorName,
        action: override.humanDecision.action,
        timestamp: override.executedAt
      });

      // Notify other proctors
      await this.websocketManager.broadcast('proctors', {
        type: 'override_notification',
        sessionId: override.sessionId,
        proctorName: override.proctorName,
        action: override.humanDecision.action
      });

    } catch (error) {
      this.logger.error('Failed to notify all participants:', error);
    }
  }

  private async updateProctorMetrics(override: OverrideCommand): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_proctor_metrics 
        SET total_overrides = total_overrides + 1,
            last_active_at = NOW()
        WHERE proctor_id = $1
      `, [override.proctorId]);
    } catch (error) {
      this.logger.error('Failed to update proctor metrics:', error);
    }
  }

  private async logActionExecution(override: OverrideCommand, action: string): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_action_logs (
          override_id, session_id, action_type, executed_by, executed_at, details
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
        override.overrideId,
        override.sessionId,
        action,
        override.proctorId,
        JSON.stringify(override.humanDecision)
      ]);
    } catch (error) {
      this.logger.error('Failed to log action execution:', error);
    }
  }

  // Analysis methods for learning insights

  private async analyzeOverridePatterns(interval: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          override_type,
          COUNT(*) as count,
          AVG((human_decision->>'confidence')::int) as avg_human_confidence,
          AVG((original_ai_decision->>'confidence')::int) as avg_ai_confidence
        FROM p7_human_overrides 
        WHERE executed_at > NOW() - INTERVAL '${interval}'
        GROUP BY override_type
        ORDER BY count DESC
      `);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to analyze override patterns:', error);
      return [];
    }
  }

  private async analyzeAccuracyTrends(interval: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          DATE_TRUNC('day', executed_at) as date,
          COUNT(*) as total_overrides,
          COUNT(CASE WHEN override_type = 'false_positive' THEN 1 END) as false_positives,
          AVG(ABS((original_ai_decision->>'confidence')::int - (human_decision->>'confidence')::int)) as avg_confidence_gap
        FROM p7_human_overrides 
        WHERE executed_at > NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('day', executed_at)
        ORDER BY date DESC
      `);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to analyze accuracy trends:', error);
      return [];
    }
  }

  private async analyzeCommonMistakes(interval: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          v.violation_type,
          COUNT(*) as mistake_count,
          AVG((ho.original_ai_decision->>'confidence')::int) as avg_ai_confidence,
          ARRAY_AGG(DISTINCT ho.override_type) as override_types
        FROM p7_human_overrides ho
        JOIN p7_violations v ON v.violation_id = ho.violation_id
        WHERE ho.executed_at > NOW() - INTERVAL '${interval}'
          AND ho.override_type IN ('false_positive', 'correction')
        GROUP BY v.violation_type
        ORDER BY mistake_count DESC
        LIMIT 10
      `);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to analyze common mistakes:', error);
      return [];
    }
  }

  private generateImprovementRecommendations(patterns: any[], accuracy: any[], mistakes: any[]): string[] {
    const recommendations = [];

    // High false positive rate
    if (patterns.find(p => p.override_type === 'false_positive' && p.count > 10)) {
      recommendations.push('Reduce false positive rate by adjusting detection thresholds');
    }

    // Large confidence gaps
    const avgGap = accuracy.reduce((sum, a) => sum + parseFloat(a.avg_confidence_gap || 0), 0) / accuracy.length;
    if (avgGap > 30) {
      recommendations.push('Improve confidence calibration - AI confidence scores need adjustment');
    }

    // Common mistake patterns
    if (mistakes.length > 0 && mistakes[0].mistake_count > 20) {
      recommendations.push(`Focus AI training on ${mistakes[0].violation_type} detection accuracy`);
    }

    // Context override frequency
    if (patterns.find(p => p.override_type === 'context_override' && p.count > 15)) {
      recommendations.push('Enhance AI context awareness and situational understanding');
    }

    if (recommendations.length === 0) {
      recommendations.push('AI performance is stable - continue monitoring for emerging patterns');
    }

    return recommendations;
  }

  private analyzeConfidenceCalibration(accuracy: any[]): any {
    if (accuracy.length === 0) return {};

    const totalGap = accuracy.reduce((sum, a) => sum + parseFloat(a.avg_confidence_gap || 0), 0);
    const avgGap = totalGap / accuracy.length;

    return {
      averageConfidenceGap: Math.round(avgGap * 100) / 100,
      calibrationStatus: avgGap < 15 ? 'well_calibrated' : 
                        avgGap < 30 ? 'needs_adjustment' : 'poorly_calibrated',
      recommendation: avgGap < 15 ? 'Confidence scores are well calibrated' :
                     avgGap < 30 ? 'Minor confidence adjustments needed' :
                     'Significant confidence recalibration required'
    };
  }
}