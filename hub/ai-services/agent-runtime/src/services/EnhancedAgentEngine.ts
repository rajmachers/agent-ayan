import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { ComplexityScorer } from './ComplexityScorer';
import { EscalationManager } from './EscalationManager';
import { HumanOverrideHandler } from './HumanOverrideHandler';
import { CollaborationInterface } from './CollaborationInterface';
import { Logger } from '../utils/Logger';
import axios from 'axios';

export interface ViolationEvent {
  sessionId: string;
  candidateId: string;
  tenantId: string;
  violationType: 'looking_away' | 'multiple_persons' | 'mobile_device' | 'prohibited_object' | 'audio_anomaly';
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  evidence: {
    screenshot?: string;
    videoClip?: string;
    audioSegment?: string;
    metadata: any;
  };
  aiAnalysis: {
    reasoning: string;
    confidence_explanation: string;
    similar_cases: number;
    recommended_action: string;
  };
}

export interface EnhancedDecision {
  sessionId: string;
  violationId: string;
  decision: 'ALLOW' | 'WARN' | 'PAUSE' | 'ESCALATE' | 'TERMINATE';
  reasoning: string;
  confidence: number;
  humanRequired: boolean;
  escalationUrgency: 'low' | 'medium' | 'high' | 'critical';
  recommendedActions: string[];
  evidenceSummary: string;
  complexityScore: number;
}

export interface AgentEngineConfig {
  dbConnection: DatabaseConnection;
  redisConnection: RedisConnection;
  complexityScorer: ComplexityScorer;
  escalationManager: EscalationManager;
  overrideHandler: HumanOverrideHandler;
  collaborationInterface: CollaborationInterface;
}

export class EnhancedAgentEngine {
  private logger = Logger.getInstance();
  private activeDecisions = new Map<string, EnhancedDecision>();
  private humanOverrides = new Map<string, any>();

  constructor(private config: AgentEngineConfig) {}

  /**
   * Enhanced agent reasoning with human-AI collaboration
   * REQ-001-012: Real-time Human-AI Collaboration
   */
  async processViolation(violation: ViolationEvent): Promise<EnhancedDecision> {
    try {
      const startTime = Date.now();

      // Step 1: Calculate complexity score (REQ-013-016)
      const complexityScore = await this.config.complexityScorer.calculateComplexity(violation);

      // Step 2: Enhanced AI analysis with multiple recommendation options
      const aiRecommendations = await this.generateEnhancedRecommendations(violation, complexityScore);

      // Step 3: Determine if human collaboration is needed
      const humanRequired = this.shouldEscalateToHuman(violation, complexityScore);

      // Step 4: Create enhanced decision with evidence assembly
      const decision: EnhancedDecision = {
        sessionId: violation.sessionId,
        violationId: `violation_${Date.now()}`,
        decision: humanRequired ? 'ESCALATE' : aiRecommendations.primaryAction,
        reasoning: aiRecommendations.reasoning,
        confidence: aiRecommendations.confidence,
        humanRequired,
        escalationUrgency: this.determineEscalationUrgency(violation, complexityScore),
        recommendedActions: aiRecommendations.options,
        evidenceSummary: aiRecommendations.evidenceSummary,
        complexityScore
      };

      // Step 5: Store decision for human review
      this.activeDecisions.set(decision.violationId, decision);

      // Step 6: Handle escalation if required (REQ-001-004: <2 seconds)
      if (humanRequired) {
        await this.config.escalationManager.escalateCase(decision, violation);
      }

      // Step 7: Log processing time (Performance REQ-065-068)
      const processingTime = Date.now() - startTime;
      this.logger.info(`🤖 Enhanced decision generated: ${decision.violationId} in ${processingTime}ms`);

      // Step 8: Auto-execute if confidence is high and no human required
      if (!humanRequired && aiRecommendations.confidence > 90) {
        await this.executeDecision(decision, violation);
      }

      return decision;

    } catch (error) {
      this.logger.error('Enhanced agent processing failed:', error);
      throw error;
    }
  }

  /**
   * Generate multiple AI recommendations with pros/cons analysis
   * REQ-045-048: AI Recommendation Engine with confidence scores
   */
  private async generateEnhancedRecommendations(
    violation: ViolationEvent,
    complexityScore: number
  ): Promise<{
    primaryAction: EnhancedDecision['decision'];
    confidence: number;
    reasoning: string;
    options: string[];
    evidenceSummary: string;
  }> {
    try {
      // Call multiple AI analysis services for comprehensive assessment
      const [visionAnalysis, behaviorAnalysis, historicalPattern] = await Promise.all([
        this.getVisionAnalysis(violation),
        this.getBehaviorAnalysis(violation),
        this.getHistoricalPattern(violation)
      ]);

      // Combine analyses for enhanced reasoning
      const combinedConfidence = (visionAnalysis.confidence + behaviorAnalysis.confidence) / 2;
      
      // Generate multiple action options
      const options = this.generateActionOptions(violation, combinedConfidence, complexityScore);
      
      // Select primary action based on combined analysis
      const primaryAction = this.selectPrimaryAction(options, combinedConfidence, complexityScore);

      // Create evidence summary (REQ-049-052)
      const evidenceSummary = this.assembleEvidenceSummary(violation, visionAnalysis, behaviorAnalysis);

      // Enhanced reasoning with explanations (REQ-114)
      const reasoning = this.generateNaturalLanguageExplanation(
        violation,
        visionAnalysis,
        behaviorAnalysis,
        historicalPattern,
        primaryAction
      );

      return {
        primaryAction,
        confidence: combinedConfidence,
        reasoning,
        options: options.map(o => `${o.action}: ${o.rationale}`),
        evidenceSummary
      };

    } catch (error) {
      this.logger.error('Failed to generate enhanced recommendations:', error);
      
      // Fallback to basic recommendation
      return {
        primaryAction: 'ESCALATE',
        confidence: 50,
        reasoning: 'Enhanced analysis failed. Escalating for human review.',
        options: ['ESCALATE: System error requires human assessment'],
        evidenceSummary: 'Evidence processing unavailable'
      };
    }
  }

  /**
   * Determine if case should be escalated to human
   * REQ-016: Complexity thresholds for auto-escalation
   */
  private shouldEscalateToHuman(violation: ViolationEvent, complexityScore: number): boolean {
    // Critical factors requiring human intervention
    if (complexityScore >= 8) return true; // High complexity
    if (violation.severity === 'high' && violation.confidence < 85) return true; // High severity, low confidence
    if (violation.violationType === 'multiple_persons') return true; // Always escalate multiple persons
    
    // Tenant-specific escalation thresholds
    const tenantThreshold = this.getTenantEscalationThreshold(violation.tenantId);
    if (complexityScore >= tenantThreshold) return true;

    return false;
  }

  /**
   * Process human override commands
   * REQ-005-008: Human Override Capabilities with immediate effect
   */
  async processHumanOverride(overrideData: {
    violationId: string;
    proctorId: string;
    decision: EnhancedDecision['decision'];
    reasoning: string;
    timestamp: Date;
  }): Promise<{ success: boolean; appliedAt: Date }> {
    try {
      const decision = this.activeDecisions.get(overrideData.violationId);
      if (!decision) {
        throw new Error(`Decision not found: ${overrideData.violationId}`);
      }

      // Store human override for learning (REQ-007)
      this.humanOverrides.set(overrideData.violationId, {
        ...overrideData,
        originalDecision: decision.decision,
        originalReasoning: decision.reasoning
      });

      // Update decision with human override
      decision.decision = overrideData.decision;
      decision.reasoning = `HUMAN OVERRIDE: ${overrideData.reasoning}`;
      decision.humanRequired = false;

      // Apply override immediately (REQ-006: <1 second)
      const appliedAt = new Date();
      await this.executeDecision(decision, null, overrideData.proctorId);

      // Stop autonomous AI actions (REQ-008)
      await this.config.redisConnection.set(`stop_ai:${decision.sessionId}`, 'true', 300);

      // Log for learning loop
      await this.logHumanOverride(overrideData, decision);

      this.logger.info(`✋ Human override applied: ${overrideData.violationId} by ${overrideData.proctorId}`);

      return { success: true, appliedAt };

    } catch (error) {
      this.logger.error('Human override processing failed:', error);
      return { success: false, appliedAt: new Date() };
    }
  }

  /**
   * Execute final decision (AI or human-guided)
   */
  private async executeDecision(
    decision: EnhancedDecision,
    violation: ViolationEvent | null,
    proctorId?: string
  ): Promise<void> {
    try {
      // Call appropriate action service
      switch (decision.decision) {
        case 'ALLOW':
          await this.executeAllowAction(decision);
          break;
        case 'WARN':
          await this.executeWarnAction(decision);
          break;
        case 'PAUSE':
          await this.executePauseAction(decision);
          break;
        case 'TERMINATE':
          await this.executeTerminateAction(decision);
          break;
        default:
          this.logger.warn(`Unknown decision type: ${decision.decision}`);
      }

      // Update session status via P7 Control Plane
      await axios.post(`http://localhost:13002/api/sessions/${decision.sessionId}/decision`, {
        violationId: decision.violationId,
        decision: decision.decision,
        proctorId,
        appliedAt: new Date(),
        reasoning: decision.reasoning
      });

      this.logger.info(`⚡ Decision executed: ${decision.decision} for ${decision.violationId}`);

    } catch (error) {
      this.logger.error('Failed to execute decision:', error);
      throw error;
    }
  }

  /**
   * Get vision analysis from P7 AI Vision service
   */
  private async getVisionAnalysis(violation: ViolationEvent): Promise<{
    confidence: number;
    findings: string[];
    risk_level: string;
  }> {
    try {
      const response = await axios.post(`http://localhost:13101/api/analyze`, {
        sessionId: violation.sessionId,
        violationType: violation.violationType,
        evidence: violation.evidence,
        enhanced_mode: true
      });

      return response.data;
    } catch (error) {
      this.logger.error('Vision analysis failed:', error);
      return { confidence: 50, findings: ['Analysis unavailable'], risk_level: 'medium' };
    }
  }

  /**
   * Get behavior analysis from P7 AI Behavior service
   */
  private async getBehaviorAnalysis(violation: ViolationEvent): Promise<{
    confidence: number;
    behavioral_pattern: string;
    anomaly_score: number;
  }> {
    try {
      const response = await axios.post(`http://localhost:13103/api/analyze`, {
        sessionId: violation.sessionId,
        violationType: violation.violationType,
        timestamp: violation.timestamp,
        enhanced_mode: true
      });

      return response.data;
    } catch (error) {
      this.logger.error('Behavior analysis failed:', error);
      return { confidence: 50, behavioral_pattern: 'unknown', anomaly_score: 0.5 };
    }
  }

  /**
   * Get historical pattern analysis
   */
  private async getHistoricalPattern(violation: ViolationEvent): Promise<{
    similar_cases: number;
    typical_outcome: string;
    success_rate: number;
  }> {
    try {
      const response = await axios.post(`http://localhost:13302/api/historical-analysis`, {
        tenantId: violation.tenantId,
        violationType: violation.violationType,
        candidate_profile: { candidateId: violation.candidateId }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Historical pattern analysis failed:', error);
      return { similar_cases: 0, typical_outcome: 'unknown', success_rate: 0.5 };
    }
  }

  /**
   * Generate multiple action options with rationale
   */
  private generateActionOptions(
    violation: ViolationEvent,
    confidence: number,
    complexityScore: number
  ): Array<{ action: EnhancedDecision['decision']; rationale: string; confidence: number }> {
    const options = [];

    // Always include conservative option
    options.push({
      action: 'ESCALATE',
      rationale: 'Human review ensures accuracy for complex cases',
      confidence: 95
    });

    // Add action based on violation type and confidence
    if (violation.violationType === 'looking_away' && confidence > 80) {
      options.push({
        action: 'WARN',
        rationale: 'Looking away can be corrected with warning',
        confidence
      });
    }

    if (violation.severity === 'low' && confidence > 85) {
      options.push({
        action: 'ALLOW',
        rationale: 'Low severity with high confidence can proceed',
        confidence
      });
    }

    if (violation.severity === 'high' && confidence > 90) {
      options.push({
        action: 'PAUSE',
        rationale: 'High severity violation requires immediate pause',
        confidence
      });
    }

    return options;
  }

  /**
   * Select primary action based on analysis
   */
  private selectPrimaryAction(
    options: Array<{ action: EnhancedDecision['decision']; confidence: number }>,
    combinedConfidence: number,
    complexityScore: number
  ): EnhancedDecision['decision'] {
    // High confidence and low complexity: proceed with AI recommendation
    if (combinedConfidence > 90 && complexityScore < 5) {
      const nonEscalateOptions = options.filter(o => o.action !== 'ESCALATE');
      if (nonEscalateOptions.length > 0) {
        return nonEscalateOptions[0].action;
      }
    }

    // Default to escalation for safety
    return 'ESCALATE';
  }

  /**
   * Assemble comprehensive evidence summary
   * REQ-049-052: Evidence Assembly System
   */
  private assembleEvidenceSummary(
    violation: ViolationEvent,
    visionAnalysis: any,
    behaviorAnalysis: any
  ): string {
    const evidence = [];
    
    if (violation.evidence.screenshot) {
      evidence.push(`Screenshot captured at ${violation.timestamp.toISOString()}`);
    }
    
    if (visionAnalysis.findings?.length > 0) {
      evidence.push(`Vision: ${visionAnalysis.findings.join(', ')}`);
    }
    
    if (behaviorAnalysis.behavioral_pattern !== 'unknown') {
      evidence.push(`Behavior: ${behaviorAnalysis.behavioral_pattern}`);
    }

    return evidence.join(' | ');
  }

  /**
   * Generate natural language explanation for human understanding
   * REQ-114: Natural language AI explanations
   */
  private generateNaturalLanguageExplanation(
    violation: ViolationEvent,
    visionAnalysis: any,
    behaviorAnalysis: any,
    historicalPattern: any,
    primaryAction: string
  ): string {
    let explanation = `Detected ${violation.violationType} with ${violation.confidence}% confidence. `;
    
    if (visionAnalysis.risk_level === 'high') {
      explanation += 'Visual analysis indicates high risk behavior. ';
    }
    
    if (behaviorAnalysis.anomaly_score > 0.7) {
      explanation += 'Behavioral patterns show significant anomaly. ';
    }
    
    if (historicalPattern.similar_cases > 5) {
      explanation += `Similar cases typically result in ${historicalPattern.typical_outcome}. `;
    }
    
    explanation += `Recommended action: ${primaryAction}.`;
    
    return explanation;
  }

  /**
   * Determine escalation urgency level
   */
  private determineEscalationUrgency(
    violation: ViolationEvent,
    complexityScore: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (complexityScore >= 9 || violation.violationType === 'multiple_persons') {
      return 'critical';
    }
    if (complexityScore >= 7 || violation.severity === 'high') {
      return 'high';
    }
    if (complexityScore >= 5 || violation.severity === 'medium') {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get tenant-specific escalation threshold
   */
  private getTenantEscalationThreshold(tenantId: string): number {
    // In a real implementation, this would query tenant configuration
    // For now, return a default threshold
    return 6; // Escalate if complexity score >= 6
  }

  /**
   * Log human override for learning loop
   * REQ-057-061: Human Expertise Capture
   */
  private async logHumanOverride(overrideData: any, decision: EnhancedDecision): Promise<void> {
    try {
      await this.config.dbConnection.query(`
        INSERT INTO p7_human_overrides (
          violation_id, proctor_id, original_decision, override_decision,
          original_reasoning, override_reasoning, complexity_score, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        overrideData.violationId,
        overrideData.proctorId,
        decision.decision,
        overrideData.decision,
        decision.reasoning,
        overrideData.reasoning,
        decision.complexityScore,
        overrideData.timestamp
      ]);
    } catch (error) {
      this.logger.error('Failed to log human override:', error);
    }
  }

  // Action execution methods
  private async executeAllowAction(decision: EnhancedDecision): Promise<void> {
    // Continue session without interruption
    this.logger.info(`✅ ALLOW action for ${decision.sessionId}`);
  }

  private async executeWarnAction(decision: EnhancedDecision): Promise<void> {
    // Send warning message to candidate
    this.logger.info(`⚠️ WARN action for ${decision.sessionId}`);
  }

  private async executePauseAction(decision: EnhancedDecision): Promise<void> {
    // Pause the exam session
    this.logger.info(`⏸️ PAUSE action for ${decision.sessionId}`);
  }

  private async executeTerminateAction(decision: EnhancedDecision): Promise<void> {
    // Terminate the exam session
    this.logger.info(`🛑 TERMINATE action for ${decision.sessionId}`);
  }

  /**
   * Get active decision by ID
   */
  getActiveDecision(violationId: string): EnhancedDecision | undefined {
    return this.activeDecisions.get(violationId);
  }

  /**
   * Get all active decisions for a session
   */
  getSessionDecisions(sessionId: string): EnhancedDecision[] {
    return Array.from(this.activeDecisions.values()).filter(d => d.sessionId === sessionId);
  }

  /**
   * Clear completed decisions
   */
  clearCompletedDecisions(): void {
    // Remove decisions older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, decision] of this.activeDecisions) {
      if (new Date(id.split('_')[1]).getTime() < oneHourAgo) {
        this.activeDecisions.delete(id);
      }
    }
  }
}