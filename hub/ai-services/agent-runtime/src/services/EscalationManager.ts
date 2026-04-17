import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { Logger } from '../utils/Logger';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { ViolationEvent } from './EnhancedAgentEngine';
import { ComplexityAnalysis } from './ComplexityScorer';

export interface EscalationRequest {
  escalationId: string;
  sessionId: string;
  violationId: string;
  candidateId: string;
  tenantId: string;
  complexityScore: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  requestedAt: Date;
  reason: string;
  aiRecommendation: string;
  evidence: {
    screenshot?: string;
    videoClip?: string;
    audioSegment?: string;
    contextData: any;
  };
  status: 'pending' | 'claimed' | 'in_progress' | 'resolved' | 'timeout';
  assignedProctor?: string;
  claimedAt?: Date;
  resolvedAt?: Date;
  escalationPath: string[];
}

export interface ProctorMetrics {
  proctorId: string;
  name: string;
  email: string;
  currentLoad: number;        // Current active cases
  maxCapacity: number;        // Maximum concurrent cases
  averageResponseTime: number; // In seconds
  successRate: number;        // 0-1 resolution success rate
  specializations: string[];  // Types of violations they excel at
  isOnline: boolean;
  lastActiveAt: Date;
  efficiency: number;         // Performance score 0-100
  availabilityWindow: {
    start: string; // "09:00"
    end: string;   // "17:00"
    timezone: string;
  };
}

export class EscalationManager {
  private logger = Logger.getInstance();
  private escalationQueue = new Map<string, EscalationRequest>();
  private proctorMetrics = new Map<string, ProctorMetrics>();
  
  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection,
    private websocketManager: WebSocketManager
  ) {
    // Initialize proctor monitoring
    this.startProctorMetricsMonitoring();
  }

  /**
   * Create escalation request for human intervention
   * REQ-017: Create escalation requests for human proctors with <2 second response time requirement
   */
  async createEscalationRequest(
    violation: ViolationEvent,
    complexity: ComplexityAnalysis,
    reason: string,
    aiRecommendation: string
  ): Promise<string> {
    try {
      const escalationId = `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const urgencyLevel = this.determineUrgencyLevel(complexity.totalScore, violation);
      
      const escalationRequest: EscalationRequest = {
        escalationId,
        sessionId: violation.sessionId,
        violationId: violation.violationId || `violation_${Date.now()}`,
        candidateId: violation.candidateId,
        tenantId: violation.tenantId,
        complexityScore: complexity.totalScore,
        urgencyLevel,
        requestedAt: new Date(),
        reason,
        aiRecommendation,
        evidence: violation.evidence,
        status: 'pending',
        escalationPath: [`ai_agent:${new Date().toISOString()}`]
      };

      // Store escalation request
      await this.storeEscalationRequest(escalationRequest);
      
      // Add to live queue
      this.escalationQueue.set(escalationId, escalationRequest);

      // Broadcast to available proctors immediately
      await this.broadcastEscalationNotification(escalationRequest);

      // Start timeout monitoring for 2-second requirement
      this.startEscalationTimeout(escalationId, urgencyLevel);

      this.logger.info(`🚨 Escalation created: ${escalationId} (${urgencyLevel}) for session ${violation.sessionId}`);
      
      return escalationId;

    } catch (error) {
      this.logger.error('Failed to create escalation request:', error);
      throw error;
    }
  }

  /**
   * Handle proctor claim on escalation
   * REQ-018: Track which proctors are handling which cases
   */
  async claimEscalation(escalationId: string, proctorId: string): Promise<boolean> {
    try {
      const escalation = this.escalationQueue.get(escalationId);
      if (!escalation) {
        throw new Error(`Escalation ${escalationId} not found`);
      }

      if (escalation.status !== 'pending') {
        return false; // Already claimed or resolved
      }

      // Check proctor availability and capacity
      const canClaim = await this.canProctorClaim(proctorId);
      if (!canClaim) {
        this.logger.warn(`❌ Proctor ${proctorId} cannot claim escalation - at capacity or offline`);
        return false;
      }

      // Update escalation
      escalation.status = 'claimed';
      escalation.assignedProctor = proctorId;
      escalation.claimedAt = new Date();
      escalation.escalationPath.push(`proctor_claim:${proctorId}:${new Date().toISOString()}`);

      // Update database
      await this.updateEscalationStatus(escalationId, 'claimed', proctorId);

      // Update proctor metrics
      await this.updateProctorLoad(proctorId, 1);

      // Notify other proctors that case is taken
      await this.broadcastEscalationUpdate(escalation);

      // Notify AI system about human takeover
      await this.notifyAISystemHandoff(escalation);

      this.logger.info(`👩‍💼 Escalation ${escalationId} claimed by proctor ${proctorId}`);
      
      return true;

    } catch (error) {
      this.logger.error('Failed to claim escalation:', error);
      return false;
    }
  }

  /**
   * Resolve escalation with proctor decision
   * REQ-019: Log all escalation decisions and outcomes for learning
   */
  async resolveEscalation(
    escalationId: string, 
    proctorId: string, 
    decision: {
      action: 'dismiss' | 'warning' | 'flag' | 'terminate';
      reasoning: string;
      confidence: number;
      additionalNotes?: string;
    }
  ): Promise<boolean> {
    try {
      const escalation = this.escalationQueue.get(escalationId);
      if (!escalation || escalation.assignedProctor !== proctorId) {
        throw new Error(`Escalation ${escalationId} not found or not assigned to proctor ${proctorId}`);
      }

      // Update escalation
      escalation.status = 'resolved';
      escalation.resolvedAt = new Date();
      escalation.escalationPath.push(`resolution:${decision.action}:${new Date().toISOString()}`);

      // Store resolution decision
      await this.storeEscalationResolution(escalationId, decision, proctorId);

      // Update proctor metrics
      await this.updateProctorLoad(proctorId, -1);
      await this.updateProctorPerformance(proctorId, escalation);

      // Remove from live queue
      this.escalationQueue.delete(escalationId);

      // Notify AI system about resolution outcome for learning
      await this.notifyAISystemResolution(escalation, decision);

      // Notify session participants about resolution
      await this.notifySessionResolution(escalation, decision);

      this.logger.info(`✅ Escalation ${escalationId} resolved: ${decision.action} by ${proctorId}`);
      
      return true;

    } catch (error) {
      this.logger.error('Failed to resolve escalation:', error);
      return false;
    }
  }

  /**
   * Monitor escalation queue for timeout and auto-routing
   * REQ-017: <2 second response time requirement
   */
  private startEscalationTimeout(escalationId: string, urgencyLevel: string): void {
    const timeoutDuration = this.getTimeoutDuration(urgencyLevel);
    
    setTimeout(async () => {
      const escalation = this.escalationQueue.get(escalationId);
      
      if (escalation && escalation.status === 'pending') {
        await this.handleEscalationTimeout(escalation);
      }
    }, timeoutDuration * 1000);
  }

  /**
   * Handle escalation timeout by auto-routing or emergency protocols
   */
  private async handleEscalationTimeout(escalation: EscalationRequest): Promise<void> {
    try {
      this.logger.warn(`⏰ Escalation timeout: ${escalation.escalationId} (${escalation.urgencyLevel})`);
      
      if (escalation.urgencyLevel === 'critical') {
        // Emergency protocol: auto-terminate session
        await this.emergencySessionTermination(escalation);
      } else {
        // Try to auto-route to backup proctors
        await this.autoRouteToBackup(escalation);
      }

      escalation.status = 'timeout';
      escalation.escalationPath.push(`timeout:${new Date().toISOString()}`);
      
      await this.updateEscalationStatus(escalation.escalationId, 'timeout');

    } catch (error) {
      this.logger.error('Failed to handle escalation timeout:', error);
    }
  }

  /**
   * Broadcast escalation notification to available proctors
   */
  private async broadcastEscalationNotification(escalation: EscalationRequest): Promise<void> {
    try {
      // Get available proctors for this tenant
      const availableProctors = await this.getAvailableProctors(escalation.tenantId);
      
      // Filter by specialization if needed
      const suitableProctors = this.filterProctorsBySpecialization(
        availableProctors, 
        escalation.evidence
      );

      // Create notification payload
      const notification = {
        type: 'escalation_request',
        escalationId: escalation.escalationId,
        sessionId: escalation.sessionId,
        urgencyLevel: escalation.urgencyLevel,
        complexityScore: escalation.complexityScore,
        reason: escalation.reason,
        aiRecommendation: escalation.aiRecommendation,
        evidence: escalation.evidence,
        requestedAt: escalation.requestedAt,
        estimatedResponseTime: this.getTimeoutDuration(escalation.urgencyLevel)
      };

      // Send to each suitable proctor
      for (const proctor of suitableProctors) {
        await this.websocketManager.sendToProctor(proctor.proctorId, notification);
      }

      // Also send summary to proctor dashboard
      await this.websocketManager.broadcast('proctor_dashboard', {
        type: 'new_escalation',
        escalation: notification
      });

      this.logger.info(`📡 Escalation broadcasted to ${suitableProctors.length} proctors`);

    } catch (error) {
      this.logger.error('Failed to broadcast escalation notification:', error);
    }
  }

  /**
   * Check if proctor can claim new escalation
   */
  private async canProctorClaim(proctorId: string): Promise<boolean> {
    try {
      const metrics = await this.getProctorMetrics(proctorId);
      
      if (!metrics.isOnline) {
        return false;
      }

      if (metrics.currentLoad >= metrics.maxCapacity) {
        return false;
      }

      // Check availability window
      const now = new Date();
      const currentHour = now.getHours();
      const startHour = parseInt(metrics.availabilityWindow.start.split(':')[0]);
      const endHour = parseInt(metrics.availabilityWindow.end.split(':')[0]);

      if (currentHour < startHour || currentHour > endHour) {
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to check proctor claim eligibility:', error);
      return false;
    }
  }

  /**
   * Determine urgency level based on complexity and violation type
   */
  private determineUrgencyLevel(complexityScore: number, violation: ViolationEvent): EscalationRequest['urgencyLevel'] {
    // Critical urgency for security violations
    if (violation.violationType === 'multiple_persons' || complexityScore >= 9) {
      return 'critical';
    }

    // High urgency for complex cases
    if (complexityScore >= 7) {
      return 'high';
    }

    // Medium urgency for moderate complexity
    if (complexityScore >= 5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get timeout duration based on urgency
   */
  private getTimeoutDuration(urgencyLevel: string): number {
    const timeouts = {
      critical: 1,   // 1 second for critical
      high: 2,       // 2 seconds for high
      medium: 5,     // 5 seconds for medium  
      low: 10        // 10 seconds for low
    };

    return timeouts[urgencyLevel] || 5;
  }

  /**
   * Filter proctors by specialization
   */
  private filterProctorsBySpecialization(proctors: ProctorMetrics[], evidence: any): ProctorMetrics[] {
    // In a real implementation, this would match proctor specializations
    // to violation types and evidence requirements
    return proctors.filter(proctor => 
      proctor.specializations.length === 0 || // General proctors
      proctor.specializations.includes('general') || 
      proctor.specializations.includes('technical')
    );
  }

  /**
   * Emergency session termination for critical timeout
   */
  private async emergencySessionTermination(escalation: EscalationRequest): Promise<void> {
    try {
      // Immediately terminate the session
      await this.websocketManager.sendToSession(escalation.sessionId, {
        type: 'session_terminated',
        reason: 'Emergency termination due to critical escalation timeout',
        escalationId: escalation.escalationId,
        timestamp: new Date().toISOString()
      });

      // Log emergency action
      await this.db.query(`
        INSERT INTO p7_emergency_actions (
          escalation_id, session_id, action_type, reason, executed_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        escalation.escalationId,
        escalation.sessionId,
        'emergency_termination',
        'Critical escalation timeout - no proctor response'
      ]);

      this.logger.error(`🚨 EMERGENCY: Session terminated due to escalation timeout: ${escalation.sessionId}`);

    } catch (error) {
      this.logger.error('Failed to execute emergency session termination:', error);
    }
  }

  /**
   * Auto-route to backup proctors
   */
  private async autoRouteToBackup(escalation: EscalationRequest): Promise<void> {
    try {
      // Get backup proctors (perhaps from other tenants or supervisors)
      const backupProctors = await this.getBackupProctors(escalation.tenantId);
      
      if (backupProctors.length > 0) {
        // Re-broadcast to backup proctors
        escalation.urgencyLevel = 'high'; // Upgrade urgency
        await this.broadcastEscalationNotification(escalation);
        
        this.logger.info(`🔄 Escalation auto-routed to ${backupProctors.length} backup proctors`);
      } else {
        // No backup available - apply default AI decision
        await this.applyDefaultAIDecision(escalation);
      }

    } catch (error) {
      this.logger.error('Failed to auto-route to backup:', error);
    }
  }

  /**
   * Apply default AI decision when no human available
   */
  private async applyDefaultAIDecision(escalation: EscalationRequest): Promise<void> {
    try {
      const decision = {
        action: 'flag' as const, // Conservative default
        reasoning: 'Applied AI default decision due to no proctor availability',
        confidence: 60,
        additionalNotes: 'Requires manual review when proctor becomes available'
      };

      await this.storeEscalationResolution(escalation.escalationId, decision, 'system_ai');
      
      this.logger.warn(`🤖 Applied default AI decision for escalation: ${escalation.escalationId}`);

    } catch (error) {
      this.logger.error('Failed to apply default AI decision:', error);
    }
  }

  // Database and metrics operations

  private async storeEscalationRequest(escalation: EscalationRequest): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_escalations (
          escalation_id, session_id, violation_id, candidate_id, tenant_id,
          complexity_score, urgency_level, reason, ai_recommendation,
          evidence, status, escalation_path, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        escalation.escalationId,
        escalation.sessionId,
        escalation.violationId,
        escalation.candidateId,
        escalation.tenantId,
        escalation.complexityScore,
        escalation.urgencyLevel,
        escalation.reason,
        escalation.aiRecommendation,
        JSON.stringify(escalation.evidence),
        escalation.status,
        JSON.stringify(escalation.escalationPath),
        escalation.requestedAt
      ]);
    } catch (error) {
      this.logger.error('Failed to store escalation request:', error);
    }
  }

  private async updateEscalationStatus(
    escalationId: string, 
    status: string, 
    proctorId?: string
  ): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_escalations 
        SET status = $2, assigned_proctor = $3, 
            claimed_at = CASE WHEN $2 = 'claimed' THEN NOW() ELSE claimed_at END,
            resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE escalation_id = $1
      `, [escalationId, status, proctorId]);
    } catch (error) {
      this.logger.error('Failed to update escalation status:', error);
    }
  }

  private async storeEscalationResolution(
    escalationId: string,
    decision: any,
    proctorId: string
  ): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_escalation_resolutions (
          escalation_id, proctor_id, action, reasoning, confidence,
          additional_notes, resolved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        escalationId,
        proctorId,
        decision.action,
        decision.reasoning,
        decision.confidence,
        decision.additionalNotes
      ]);
    } catch (error) {
      this.logger.error('Failed to store escalation resolution:', error);
    }
  }

  private async getAvailableProctors(tenantId: string): Promise<ProctorMetrics[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM p7_proctor_metrics 
        WHERE tenant_id = $1 AND is_online = true 
        ORDER BY current_load ASC, efficiency DESC
      `, [tenantId]);

      return result.rows.map(row => ({
        proctorId: row.proctor_id,
        name: row.name,
        email: row.email,
        currentLoad: row.current_load,
        maxCapacity: row.max_capacity,
        averageResponseTime: row.average_response_time,
        successRate: row.success_rate,
        specializations: row.specializations,
        isOnline: row.is_online,
        lastActiveAt: row.last_active_at,
        efficiency: row.efficiency,
        availabilityWindow: row.availability_window
      }));
    } catch (error) {
      this.logger.error('Failed to get available proctors:', error);
      return [];
    }
  }

  private async getBackupProctors(tenantId: string): Promise<ProctorMetrics[]> {
    try {
      // Get supervisors or cross-tenant backup proctors
      const result = await this.db.query(`
        SELECT * FROM p7_proctor_metrics 
        WHERE (tenant_id = $1 AND role = 'supervisor') 
           OR (role = 'backup' AND is_online = true)
        ORDER BY efficiency DESC
      `, [tenantId]);

      return result.rows.map(row => ({
        proctorId: row.proctor_id,
        name: row.name,
        email: row.email,
        currentLoad: row.current_load,
        maxCapacity: row.max_capacity,
        averageResponseTime: row.average_response_time,
        successRate: row.success_rate,
        specializations: row.specializations,
        isOnline: row.is_online,
        lastActiveAt: row.last_active_at,
        efficiency: row.efficiency,
        availabilityWindow: row.availability_window
      }));
    } catch (error) {
      this.logger.error('Failed to get backup proctors:', error);
      return [];
    }
  }

  private async getProctorMetrics(proctorId: string): Promise<ProctorMetrics> {
    try {
      const cached = this.proctorMetrics.get(proctorId);
      if (cached) return cached;

      const result = await this.db.query(`
        SELECT * FROM p7_proctor_metrics WHERE proctor_id = $1
      `, [proctorId]);

      if (result.rows.length === 0) {
        throw new Error(`Proctor ${proctorId} not found`);
      }

      const row = result.rows[0];
      const metrics: ProctorMetrics = {
        proctorId: row.proctor_id,
        name: row.name,
        email: row.email,
        currentLoad: row.current_load,
        maxCapacity: row.max_capacity,
        averageResponseTime: row.average_response_time,
        successRate: row.success_rate,
        specializations: row.specializations,
        isOnline: row.is_online,
        lastActiveAt: row.last_active_at,
        efficiency: row.efficiency,
        availabilityWindow: row.availability_window
      };

      this.proctorMetrics.set(proctorId, metrics);
      return metrics;

    } catch (error) {
      this.logger.error('Failed to get proctor metrics:', error);
      throw error;
    }
  }

  private async updateProctorLoad(proctorId: string, delta: number): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_proctor_metrics 
        SET current_load = GREATEST(0, current_load + $2),
            last_active_at = NOW()
        WHERE proctor_id = $1
      `, [proctorId, delta]);

      // Update cache
      const cached = this.proctorMetrics.get(proctorId);
      if (cached) {
        cached.currentLoad = Math.max(0, cached.currentLoad + delta);
        cached.lastActiveAt = new Date();
      }
    } catch (error) {
      this.logger.error('Failed to update proctor load:', error);
    }
  }

  private async updateProctorPerformance(proctorId: string, escalation: EscalationRequest): Promise<void> {
    try {
      const responseTime = escalation.claimedAt && escalation.requestedAt
        ? (escalation.claimedAt.getTime() - escalation.requestedAt.getTime()) / 1000
        : 0;

      await this.db.query(`
        UPDATE p7_proctor_metrics 
        SET average_response_time = (average_response_time + $2) / 2,
            efficiency = LEAST(100, efficiency + CASE WHEN $2 < 5 THEN 1 ELSE -1 END)
        WHERE proctor_id = $1
      `, [proctorId, responseTime]);
    } catch (error) {
      this.logger.error('Failed to update proctor performance:', error);
    }
  }

  private async broadcastEscalationUpdate(escalation: EscalationRequest): Promise<void> {
    try {
      await this.websocketManager.broadcast('proctor_dashboard', {
        type: 'escalation_update',
        escalationId: escalation.escalationId,
        status: escalation.status,
        assignedProctor: escalation.assignedProctor
      });
    } catch (error) {
      this.logger.error('Failed to broadcast escalation update:', error);
    }
  }

  private async notifyAISystemHandoff(escalation: EscalationRequest): Promise<void> {
    try {
      await this.websocketManager.sendToService('p7-agent-runtime', {
        type: 'human_handoff',
        escalationId: escalation.escalationId,
        sessionId: escalation.sessionId,
        proctorId: escalation.assignedProctor
      });
    } catch (error) {
      this.logger.error('Failed to notify AI system of handoff:', error);
    }
  }

  private async notifyAISystemResolution(
    escalation: EscalationRequest,
    decision: any
  ): Promise<void> {
    try {
      await this.websocketManager.sendToService('p7-agent-runtime', {
        type: 'human_resolution',
        escalationId: escalation.escalationId,
        sessionId: escalation.sessionId,
        decision: decision,
        complexityScore: escalation.complexityScore,
        actualOutcome: decision.action
      });
    } catch (error) {
      this.logger.error('Failed to notify AI system of resolution:', error);
    }
  }

  private async notifySessionResolution(
    escalation: EscalationRequest,
    decision: any
  ): Promise<void> {
    try {
      await this.websocketManager.sendToSession(escalation.sessionId, {
        type: 'violation_resolved',
        escalationId: escalation.escalationId,
        action: decision.action,
        reasoning: decision.reasoning,
        resolvedBy: escalation.assignedProctor
      });
    } catch (error) {
      this.logger.error('Failed to notify session of resolution:', error);
    }
  }

  /**
   * Start monitoring proctor metrics and availability
   */
  private startProctorMetricsMonitoring(): void {
    // Update proctor metrics every 30 seconds
    setInterval(async () => {
      try {
        await this.refreshProctorMetrics();
      } catch (error) {
        this.logger.error('Failed to refresh proctor metrics:', error);
      }
    }, 30000);
  }

  private async refreshProctorMetrics(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT proctor_id FROM p7_proctor_metrics 
        WHERE last_active_at > NOW() - INTERVAL '5 minutes'
      `);

      for (const row of result.rows) {
        this.proctorMetrics.delete(row.proctor_id); // Force refresh
      }
    } catch (error) {
      this.logger.error('Failed to refresh proctor metrics cache:', error);
    }
  }

  /**
   * Get escalation statistics for dashboard
   */
  async getEscalationStatistics(tenantId: string, timeRange: string = '24h'): Promise<{
    totalEscalations: number;
    averageResponseTime: number;
    resolutionRate: number;
    urgencyBreakdown: any;
    proctorPerformance: any[];
  }> {
    try {
      const interval = timeRange === '1h' ? '1 hour' : 
                     timeRange === '24h' ? '24 hours' :
                     '7 days';

      const [stats, urgency, performance] = await Promise.all([
        this.db.query(`
          SELECT 
            COUNT(*) as total_escalations,
            AVG(EXTRACT(EPOCH FROM (claimed_at - requested_at))) as avg_response_time,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / COUNT(*) as resolution_rate
          FROM p7_escalations 
          WHERE tenant_id = $1 AND requested_at > NOW() - INTERVAL '${interval}'
        `, [tenantId]),
        
        this.db.query(`
          SELECT urgency_level, COUNT(*) as count
          FROM p7_escalations 
          WHERE tenant_id = $1 AND requested_at > NOW() - INTERVAL '${interval}'
          GROUP BY urgency_level
        `, [tenantId]),
        
        this.db.query(`
          SELECT 
            pm.proctor_id, pm.name, pm.efficiency,
            COUNT(e.escalation_id) as cases_handled,
            AVG(EXTRACT(EPOCH FROM (e.claimed_at - e.requested_at))) as avg_response
          FROM p7_proctor_metrics pm
          LEFT JOIN p7_escalations e ON e.assigned_proctor = pm.proctor_id 
            AND e.requested_at > NOW() - INTERVAL '${interval}'
          WHERE pm.tenant_id = $1
          GROUP BY pm.proctor_id, pm.name, pm.efficiency
          ORDER BY pm.efficiency DESC
        `, [tenantId])
      ]);

      return {
        totalEscalations: parseInt(stats.rows[0]?.total_escalations || 0),
        averageResponseTime: parseFloat(stats.rows[0]?.avg_response_time || 0),
        resolutionRate: parseFloat(stats.rows[0]?.resolution_rate || 0),
        urgencyBreakdown: urgency.rows.reduce((acc, row) => {
          acc[row.urgency_level] = parseInt(row.count);
          return acc;
        }, {}),
        proctorPerformance: performance.rows
      };

    } catch (error) {
      this.logger.error('Failed to get escalation statistics:', error);
      return {
        totalEscalations: 0,
        averageResponseTime: 0,
        resolutionRate: 0,
        urgencyBreakdown: {},
        proctorPerformance: []
      };
    }
  }
}