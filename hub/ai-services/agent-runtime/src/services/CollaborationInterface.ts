import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { Logger } from '../utils/Logger';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { ViolationEvent } from './EnhancedAgentEngine';

export interface RealtimeNotification {
  notificationId: string;
  sessionId: string;
  proctorId: string;
  type: 'violation_detected' | 'severity_change' | 'context_update' | 'ai_recommendation' | 'candidate_action';
  priority: 'low' | 'medium' | 'high' | 'critical';
  content: {
    title: string;
    message: string;
    actionable: boolean;
    evidence?: any;
    recommendations?: string[];
  };
  timestamp: Date;
  acknowledgedAt?: Date;
  actionTaken?: {
    type: string;
    timestamp: Date;
    result: string;
  };
}

export interface CollaborationSession {
  collaborationId: string;
  sessionId: string;
  participants: {
    proctorId: string;
    role: 'primary' | 'secondary' | 'supervisor' | 'observer';
    joinedAt: Date;
    permissions: string[];
  }[];
  sharedState: {
    currentViolation?: string;
    discussionNotes: string[];
    consensusDecision?: {
      action: string;
      reasoning: string;
      agreedBy: string[];
      timestamp: Date;
    };
  };
  createdAt: Date;
  status: 'active' | 'concluded' | 'escalated';
}

export interface AIRecommendation {
  recommendationId: string;
  sessionId: string;
  violationId: string;
  generatedAt: Date;
  confidence: number;
  recommendations: {
    primary: {
      action: string;
      reasoning: string;
      confidence: number;
      evidence: string[];
    };
    alternatives: {
      action: string;
      reasoning: string;
      confidence: number;
      pros: string[];
      cons: string[];
    }[];
  };
  contextFactors: {
    examType: string;
    timeRemaining: number;
    candidateHistory: any;
    violationSeverity: string;
  };
  humanFeedback?: {
    proctorId: string;
    rating: number; // 1-5 stars
    comments: string;
    implemented: boolean;
  };
}

export class CollaborationInterface {
  private logger = Logger.getInstance();
  private activeCollaborations = new Map<string, CollaborationSession>();
  private notificationQueue = new Map<string, RealtimeNotification[]>();

  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection,
    private websocketManager: WebSocketManager
  ) {
    // Initialize real-time notification system
    this.startNotificationProcessor();
  }

  /**
   * Push real-time notifications to proctors with context
   * REQ-024: Push real-time notifications to proctors with context and actionable insights
   */
  async pushRealtimeNotification(
    sessionId: string,
    proctorIds: string[],
    type: RealtimeNotification['type'],
    content: RealtimeNotification['content'],
    priority: RealtimeNotification['priority'] = 'medium'
  ): Promise<string> {
    try {
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create notification for each proctor
      for (const proctorId of proctorIds) {
        const notification: RealtimeNotification = {
          notificationId: `${notificationId}_${proctorId}`,
          sessionId,
          proctorId,
          type,
          priority,
          content,
          timestamp: new Date()
        };

        // Store notification
        await this.storeNotification(notification);
        
        // Add to proctor's queue
        if (!this.notificationQueue.has(proctorId)) {
          this.notificationQueue.set(proctorId, []);
        }
        this.notificationQueue.get(proctorId)!.push(notification);

        // Send immediate push notification
        await this.sendPushNotification(notification);

        // Log notification for audit trail
        await this.logNotificationPush(notification);
      }

      this.logger.info(`📢 Real-time notification pushed: ${type} to ${proctorIds.length} proctors (${priority})`);
      
      return notificationId;

    } catch (error) {
      this.logger.error('Failed to push real-time notification:', error);
      throw error;
    }
  }

  /**
   * Send immediate push notification via WebSocket
   */
  private async sendPushNotification(notification: RealtimeNotification): Promise<void> {
    try {
      // Determine notification urgency and delivery method
      const deliveryPayload = {
        type: 'realtime_notification',
        notificationId: notification.notificationId,
        sessionId: notification.sessionId,
        priority: notification.priority,
        content: notification.content,
        timestamp: notification.timestamp,
        requiresAcknowledgment: notification.priority === 'critical',
        autoExpire: this.getAutoExpireTime(notification.priority)
      };

      // Send via WebSocket
      await this.websocketManager.sendToProctor(notification.proctorId, deliveryPayload);

      // For critical notifications, also send via alternative channels
      if (notification.priority === 'critical') {
        await this.sendCriticalNotificationBackup(notification);
      }

      this.logger.debug(`📱 Push notification sent to proctor ${notification.proctorId}`);

    } catch (error) {
      this.logger.error('Failed to send push notification:', error);
    }
  }

  /**
   * Enable multi-proctor collaboration on complex cases
   * REQ-025: Enable multi-proctor collaboration on complex cases with shared decision-making
   */
  async initiateCollaboration(
    sessionId: string,
    initiatorId: string,
    participantIds: string[],
    violationId?: string
  ): Promise<string> {
    try {
      const collaborationId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create collaboration session
      const collaboration: CollaborationSession = {
        collaborationId,
        sessionId,
        participants: [
          {
            proctorId: initiatorId,
            role: 'primary',
            joinedAt: new Date(),
            permissions: ['view', 'annotate', 'decide', 'invite']
          },
          ...participantIds.map(id => ({
            proctorId: id,
            role: 'secondary' as const,
            joinedAt: new Date(),
            permissions: ['view', 'annotate', 'recommend']
          }))
        ],
        sharedState: {
          currentViolation: violationId,
          discussionNotes: []
        },
        createdAt: new Date(),
        status: 'active'
      };

      // Store collaboration session
      await this.storeCollaborationSession(collaboration);
      
      // Add to active collaborations
      this.activeCollaborations.set(collaborationId, collaboration);

      // Create collaboration workspace
      await this.createCollaborationWorkspace(collaboration);

      // Invite all participants
      for (const participant of collaboration.participants) {
        await this.sendCollaborationInvite(collaboration, participant.proctorId);
      }

      // Initialize shared whiteboard/annotation system
      await this.initializeSharedAnnotations(collaborationId, sessionId);

      this.logger.info(`🤝 Collaboration initiated: ${collaborationId} for session ${sessionId}`);
      
      return collaborationId;

    } catch (error) {
      this.logger.error('Failed to initiate collaboration:', error);
      throw error;
    }
  }

  /**
   * Join collaboration session
   */
  async joinCollaboration(collaborationId: string, proctorId: string): Promise<boolean> {
    try {
      const collaboration = this.activeCollaborations.get(collaborationId);
      if (!collaboration) {
        throw new Error(`Collaboration ${collaborationId} not found`);
      }

      // Check if proctor is invited
      const participant = collaboration.participants.find(p => p.proctorId === proctorId);
      if (!participant) {
        throw new Error(`Proctor ${proctorId} not invited to collaboration`);
      }

      // Update join status
      participant.joinedAt = new Date();

      // Send current collaboration state
      await this.sendCollaborationState(collaboration, proctorId);

      // Broadcast join notification to other participants
      await this.broadcastToCollaborators(collaboration, {
        type: 'participant_joined',
        proctorId,
        timestamp: new Date()
      }, proctorId);

      this.logger.info(`👥 Proctor joined collaboration: ${proctorId} → ${collaborationId}`);
      
      return true;

    } catch (error) {
      this.logger.error('Failed to join collaboration:', error);
      return false;
    }
  }

  /**
   * Add discussion note to shared state
   */
  async addDiscussionNote(
    collaborationId: string,
    proctorId: string,
    note: string,
    attachments?: any[]
  ): Promise<boolean> {
    try {
      const collaboration = this.activeCollaborations.get(collaborationId);
      if (!collaboration) return false;

      // Verify permission
      const participant = collaboration.participants.find(p => p.proctorId === proctorId);
      if (!participant || !participant.permissions.includes('annotate')) {
        return false;
      }

      // Add note to shared state
      const noteEntry = {
        noteId: `note_${Date.now()}`,
        proctorId,
        content: note,
        attachments: attachments || [],
        timestamp: new Date()
      };

      collaboration.sharedState.discussionNotes.push(JSON.stringify(noteEntry));

      // Store update
      await this.updateCollaborationState(collaborationId, collaboration.sharedState);

      // Broadcast to all participants
      await this.broadcastToCollaborators(collaboration, {
        type: 'discussion_note',
        note: noteEntry
      });

      this.logger.debug(`💬 Discussion note added: ${collaborationId} by ${proctorId}`);
      
      return true;

    } catch (error) {
      this.logger.error('Failed to add discussion note:', error);
      return false;
    }
  }

  /**
   * Record consensus decision
   */
  async recordConsensusDecision(
    collaborationId: string,
    decision: {
      action: string;
      reasoning: string;
      agreedBy: string[];
    }
  ): Promise<boolean> {
    try {
      const collaboration = this.activeCollaborations.get(collaborationId);
      if (!collaboration) return false;

      // Validate that all agreeing proctors are participants
      const validAgreeBy = decision.agreedBy.filter(proctorId =>
        collaboration.participants.some(p => p.proctorId === proctorId)
      );

      if (validAgreeBy.length === 0) return false;

      // Record consensus decision
      collaboration.sharedState.consensusDecision = {
        action: decision.action,
        reasoning: decision.reasoning,
        agreedBy: validAgreeBy,
        timestamp: new Date()
      };

      // Update status if consensus reached
      const requiredConsensus = Math.ceil(collaboration.participants.length * 0.6); // 60% agreement
      if (validAgreeBy.length >= requiredConsensus) {
        collaboration.status = 'concluded';
      }

      // Store update
      await this.updateCollaborationState(collaborationId, collaboration.sharedState);

      // Broadcast decision to all participants and session
      await this.broadcastConsensusDecision(collaboration);

      this.logger.info(`🎯 Consensus decision recorded: ${collaborationId} → ${decision.action}`);
      
      return true;

    } catch (error) {
      this.logger.error('Failed to record consensus decision:', error);
      return false;
    }
  }

  /**
   * Provide multiple AI recommendation options for human consideration
   * REQ-026: Provide multiple AI recommendation options for human consideration and feedback
   */
  async generateAIRecommendations(
    sessionId: string,
    violationId: string,
    violation: ViolationEvent
  ): Promise<string> {
    try {
      const recommendationId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate multiple recommendation options
      const recommendations = await this.calculateRecommendationOptions(violation);
      
      // Get context factors
      const contextFactors = await this.gatherContextFactors(sessionId, violation);

      const aiRecommendation: AIRecommendation = {
        recommendationId,
        sessionId,
        violationId,
        generatedAt: new Date(),
        confidence: recommendations.primary.confidence,
        recommendations,
        contextFactors
      };

      // Store recommendation
      await this.storeAIRecommendation(aiRecommendation);

      // Push to relevant proctors
      await this.pushRecommendationToProctors(aiRecommendation);

      this.logger.info(`🤖 AI recommendations generated: ${recommendationId} with ${recommendations.alternatives.length} options`);
      
      return recommendationId;

    } catch (error) {
      this.logger.error('Failed to generate AI recommendations:', error);
      throw error;
    }
  }

  /**
   * Calculate multiple recommendation options
   */
  private async calculateRecommendationOptions(violation: ViolationEvent): Promise<AIRecommendation['recommendations']> {
    try {
      // Primary recommendation (highest confidence)
      const primary = await this.calculatePrimaryRecommendation(violation);
      
      // Alternative recommendations
      const alternatives = await this.calculateAlternativeRecommendations(violation);

      return {
        primary,
        alternatives
      };

    } catch (error) {
      this.logger.error('Failed to calculate recommendation options:', error);
      throw error;
    }
  }

  /**
   * Calculate primary recommendation
   */
  private async calculatePrimaryRecommendation(violation: ViolationEvent): Promise<AIRecommendation['recommendations']['primary']> {
    // AI logic for primary recommendation
    let action = 'warning';
    let confidence = 75;
    let reasoning = 'Standard protocol for violation type';
    const evidence = [];

    // Severity-based decision logic
    switch (violation.severity) {
      case 'low':
        action = 'warning';
        confidence = 85;
        reasoning = 'Minor violation detected - warning appropriate to maintain exam integrity';
        break;
      
      case 'medium':
        action = 'flag';
        confidence = 80;
        reasoning = 'Moderate violation - flagging for review while allowing exam continuation';
        break;
      
      case 'high':
        action = 'escalate';
        confidence = 90;
        reasoning = 'Significant violation requires human review and potential intervention';
        break;
    }

    // Type-based adjustments
    if (violation.violationType === 'multiple_persons') {
      action = 'terminate';
      confidence = 95;
      reasoning = 'Multiple persons detected - immediate termination required for exam security';
    }

    if (violation.confidence < 70) {
      confidence *= 0.8; // Reduce confidence for uncertain AI detections
    }

    return {
      action,
      reasoning,
      confidence: Math.round(confidence),
      evidence: [
        `AI detection confidence: ${violation.confidence}%`,
        `Violation type: ${violation.violationType}`,
        `Severity level: ${violation.severity}`
      ]
    };
  }

  /**
   * Calculate alternative recommendations
   */
  private async calculateAlternativeRecommendations(violation: ViolationEvent): Promise<AIRecommendation['recommendations']['alternatives']> {
    const alternatives = [];
    
    // Conservative option
    alternatives.push({
      action: 'monitor',
      reasoning: 'Continue monitoring without immediate action - may be false positive or minor issue',
      confidence: 60,
      pros: ['Avoids disrupting candidate if false positive', 'Allows benefit of doubt'],
      cons: ['May miss genuine violation', 'Could escalate if ignored']
    });

    // Aggressive option
    alternatives.push({
      action: 'immediate_intervention',
      reasoning: 'Immediate proctor intervention to assess situation directly',
      confidence: 70,
      pros: ['Quick resolution', 'Direct human assessment', 'Prevents escalation'],
      cons: ['May be disruptive', 'Resource intensive', 'Could cause anxiety']
    });

    // Balanced option
    alternatives.push({
      action: 'graduated_response',
      reasoning: 'Escalate response gradually - warning first, then stronger measures if needed',
      confidence: 85,
      pros: ['Balanced approach', 'Allows for correction', 'Maintains fairness'],
      cons: ['May take longer to resolve', 'Could give multiple chances to violators']
    });

    return alternatives;
  }

  /**
   * Gather context factors for recommendation
   */
  private async gatherContextFactors(sessionId: string, violation: ViolationEvent): Promise<AIRecommendation['contextFactors']> {
    try {
      // Get session context from database
      const sessionResult = await this.db.query(`
        SELECT exam_type, duration, time_remaining 
        FROM p7_sessions 
        WHERE session_id = $1
      `, [sessionId]);

      // Get candidate history
      const historyResult = await this.db.query(`
        SELECT COUNT(*) as violation_count, 
               ARRAY_AGG(violation_type) as past_violations
        FROM p7_violations 
        WHERE candidate_id = $1 
        AND created_at > NOW() - INTERVAL '30 days'
      `, [violation.candidateId]);

      const sessionData = sessionResult.rows[0] || {};
      const historyData = historyResult.rows[0] || {};

      return {
        examType: sessionData.exam_type || 'standard',
        timeRemaining: sessionData.time_remaining || 3600,
        candidateHistory: {
          priorViolations: parseInt(historyData.violation_count) || 0,
          violationTypes: historyData.past_violations || []
        },
        violationSeverity: violation.severity
      };

    } catch (error) {
      this.logger.error('Failed to gather context factors:', error);
      return {
        examType: 'standard',
        timeRemaining: 3600,
        candidateHistory: { priorViolations: 0, violationTypes: [] },
        violationSeverity: violation.severity
      };
    }
  }

  /**
   * Push recommendations to relevant proctors
   */
  private async pushRecommendationToProctors(recommendation: AIRecommendation): Promise<void> {
    try {
      // Get proctors monitoring this session
      const proctors = await this.getProctorsForSession(recommendation.sessionId);
      
      for (const proctorId of proctors) {
        await this.pushRealtimeNotification(
          recommendation.sessionId,
          [proctorId],
          'ai_recommendation',
          {
            title: 'AI Recommendation Available',
            message: `Primary: ${recommendation.recommendations.primary.action} (${recommendation.recommendations.primary.confidence}% confidence)`,
            actionable: true,
            recommendations: [
              recommendation.recommendations.primary.reasoning,
              ...recommendation.recommendations.alternatives.map(alt => `Alt: ${alt.action} - ${alt.reasoning}`)
            ]
          },
          'medium'
        );
      }
    } catch (error) {
      this.logger.error('Failed to push recommendations to proctors:', error);
    }
  }

  /**
   * Collect human feedback on AI recommendations
   * REQ-026: Feedback collection for AI improvement
   */
  async collectRecommendationFeedback(
    recommendationId: string,
    proctorId: string,
    feedback: {
      rating: number;
      comments: string;
      implemented: boolean;
      selectedOption?: string;
    }
  ): Promise<boolean> {
    try {
      // Store feedback in database
      await this.db.query(`
        UPDATE p7_ai_recommendations 
        SET human_feedback = $2
        WHERE recommendation_id = $1
      `, [recommendationId, JSON.stringify({
        proctorId,
        ...feedback,
        providedAt: new Date()
      })]);

      // Add to learning pipeline if implemented
      if (feedback.implemented) {
        await this.addToLearningPipeline(recommendationId, feedback);
      }

      this.logger.info(`📝 Recommendation feedback collected: ${recommendationId} (${feedback.rating}/5)`);
      
      return true;

    } catch (error) {
      this.logger.error('Failed to collect recommendation feedback:', error);
      return false;
    }
  }

  // Helper methods and utilities

  private getAutoExpireTime(priority: string): number {
    const expireTimes = {
      low: 300000,      // 5 minutes
      medium: 180000,   // 3 minutes 
      high: 60000,      // 1 minute
      critical: 30000   // 30 seconds
    };

    return expireTimes[priority] || 180000;
  }

  private async sendCriticalNotificationBackup(notification: RealtimeNotification): Promise<void> {
    try {
      // In a real system, this could send SMS, email, or push to mobile app
      this.logger.warn(`🚨 Critical notification backup needed: ${notification.notificationId}`);
      
      // Store as pending critical notification
      await this.redis.setex(
        `critical_notification:${notification.proctorId}`,
        300, // 5 minutes
        JSON.stringify(notification)
      );

    } catch (error) {
      this.logger.error('Failed to send critical notification backup:', error);
    }
  }

  private async createCollaborationWorkspace(collaboration: CollaborationSession): Promise<void> {
    try {
      // Create shared workspace in WebSocket rooms
      const workspaceRoom = `collaboration_${collaboration.collaborationId}`;
      
      // Initialize workspace with session context
      await this.websocketManager.createRoom(workspaceRoom, {
        sessionId: collaboration.sessionId,
        participants: collaboration.participants.map(p => p.proctorId),
        permissions: collaboration.participants.reduce((acc, p) => {
          acc[p.proctorId] = p.permissions;
          return acc;
        }, {} as any)
      });

    } catch (error) {
      this.logger.error('Failed to create collaboration workspace:', error);
    }
  }

  private async sendCollaborationInvite(collaboration: CollaborationSession, proctorId: string): Promise<void> {
    try {
      await this.websocketManager.sendToProctor(proctorId, {
        type: 'collaboration_invite',
        collaborationId: collaboration.collaborationId,
        sessionId: collaboration.sessionId,
        initiator: collaboration.participants[0].proctorId,
        role: collaboration.participants.find(p => p.proctorId === proctorId)?.role,
        permissions: collaboration.participants.find(p => p.proctorId === proctorId)?.permissions
      });
    } catch (error) {
      this.logger.error('Failed to send collaboration invite:', error);
    }
  }

  private async initializeSharedAnnotations(collaborationId: string, sessionId: string): Promise<void> {
    try {
      // Initialize shared annotation system
      await this.redis.set(
        `annotations:${collaborationId}`,
        JSON.stringify({
          sessionId,
          annotations: [],
          cursors: {},
          selections: {}
        })
      );
    } catch (error) {
      this.logger.error('Failed to initialize shared annotations:', error);
    }
  }

  private async sendCollaborationState(collaboration: CollaborationSession, proctorId: string): Promise<void> {
    try {
      await this.websocketManager.sendToProctor(proctorId, {
        type: 'collaboration_state',
        collaboration: {
          collaborationId: collaboration.collaborationId,
          sessionId: collaboration.sessionId,
          participants: collaboration.participants,
          sharedState: collaboration.sharedState,
          status: collaboration.status
        }
      });
    } catch (error) {
      this.logger.error('Failed to send collaboration state:', error);
    }
  }

  private async broadcastToCollaborators(
    collaboration: CollaborationSession,
    message: any,
    excludeProctor?: string
  ): Promise<void> {
    try {
      for (const participant of collaboration.participants) {
        if (excludeProctor && participant.proctorId === excludeProctor) continue;
        
        await this.websocketManager.sendToProctor(participant.proctorId, {
          type: 'collaboration_broadcast',
          collaborationId: collaboration.collaborationId,
          ...message
        });
      }
    } catch (error) {
      this.logger.error('Failed to broadcast to collaborators:', error);
    }
  }

  private async broadcastConsensusDecision(collaboration: CollaborationSession): Promise<void> {
    try {
      const decision = collaboration.sharedState.consensusDecision;
      if (!decision) return;

      // Broadcast to all participants
      await this.broadcastToCollaborators(collaboration, {
        type: 'consensus_reached',
        decision
      });

      // Notify session about collaborative decision
      await this.websocketManager.sendToSession(collaboration.sessionId, {
        type: 'collaborative_decision',
        collaborationId: collaboration.collaborationId,
        decision,
        participants: collaboration.participants.map(p => p.proctorId)
      });

    } catch (error) {
      this.logger.error('Failed to broadcast consensus decision:', error);
    }
  }

  private async getProctorsForSession(sessionId: string): Promise<string[]> {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT proctor_id 
        FROM p7_session_assignments 
        WHERE session_id = $1 AND status = 'active'
      `, [sessionId]);

      return result.rows.map(row => row.proctor_id);
    } catch (error) {
      this.logger.error('Failed to get proctors for session:', error);
      return [];
    }
  }

  private async addToLearningPipeline(recommendationId: string, feedback: any): Promise<void> {
    try {
      await this.redis.lpush('ai_learning_queue', JSON.stringify({
        type: 'recommendation_feedback',
        recommendationId,
        feedback,
        timestamp: new Date()
      }));
    } catch (error) {
      this.logger.error('Failed to add to learning pipeline:', error);
    }
  }

  // Database operations

  private async storeNotification(notification: RealtimeNotification): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_realtime_notifications (
          notification_id, session_id, proctor_id, type, priority, 
          content, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        notification.notificationId,
        notification.sessionId,
        notification.proctorId,
        notification.type,
        notification.priority,
        JSON.stringify(notification.content),
        notification.timestamp
      ]);
    } catch (error) {
      this.logger.error('Failed to store notification:', error);
    }
  }

  private async logNotificationPush(notification: RealtimeNotification): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_notification_logs (
          notification_id, proctor_id, pushed_at, priority, type
        ) VALUES ($1, $2, NOW(), $3, $4)
      `, [
        notification.notificationId,
        notification.proctorId,
        notification.priority,
        notification.type
      ]);
    } catch (error) {
      this.logger.error('Failed to log notification push:', error);
    }
  }

  private async storeCollaborationSession(collaboration: CollaborationSession): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_collaborations (
          collaboration_id, session_id, participants, shared_state, 
          created_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        collaboration.collaborationId,
        collaboration.sessionId,
        JSON.stringify(collaboration.participants),
        JSON.stringify(collaboration.sharedState),
        collaboration.createdAt,
        collaboration.status
      ]);
    } catch (error) {
      this.logger.error('Failed to store collaboration session:', error);
    }
  }

  private async updateCollaborationState(collaborationId: string, sharedState: any): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_collaborations 
        SET shared_state = $2, updated_at = NOW()
        WHERE collaboration_id = $1
      `, [collaborationId, JSON.stringify(sharedState)]);
    } catch (error) {
      this.logger.error('Failed to update collaboration state:', error);
    }
  }

  private async storeAIRecommendation(recommendation: AIRecommendation): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO p7_ai_recommendations (
          recommendation_id, session_id, violation_id, generated_at,
          confidence, recommendations, context_factors
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        recommendation.recommendationId,
        recommendation.sessionId,
        recommendation.violationId,
        recommendation.generatedAt,
        recommendation.confidence,
        JSON.stringify(recommendation.recommendations),
        JSON.stringify(recommendation.contextFactors)
      ]);
    } catch (error) {
      this.logger.error('Failed to store AI recommendation:', error);
    }
  }

  /**
   * Start notification processor for cleanup and management
   */
  private startNotificationProcessor(): void {
    // Clean up old notifications every minute
    setInterval(async () => {
      try {
        await this.cleanupExpiredNotifications();
      } catch (error) {
        this.logger.error('Notification cleanup error:', error);
      }
    }, 60000); // 1 minute
  }

  private async cleanupExpiredNotifications(): Promise<void> {
    try {
      // Remove notifications older than 1 hour from queue
      for (const [proctorId, notifications] of this.notificationQueue.entries()) {
        const cutoffTime = new Date(Date.now() - 3600000); // 1 hour ago
        
        const validNotifications = notifications.filter(n => n.timestamp > cutoffTime);
        
        if (validNotifications.length !== notifications.length) {
          this.notificationQueue.set(proctorId, validNotifications);
        }
        
        if (validNotifications.length === 0) {
          this.notificationQueue.delete(proctorId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired notifications:', error);
    }
  }

  /**
   * Get collaboration statistics for dashboard
   */
  async getCollaborationStatistics(tenantId: string): Promise<{
    activeCollaborations: number;
    totalCollaborations: number;
    averageParticipants: number;
    consensusRate: number;
    averageResolutionTime: number;
  }> {
    try {
      const [active, total, consensus, timing] = await Promise.all([
        this.db.query(`
          SELECT COUNT(*) as count FROM p7_collaborations 
          WHERE status = 'active'
        `),
        
        this.db.query(`
          SELECT COUNT(*) as count,
                 AVG(jsonb_array_length(participants)) as avg_participants
          FROM p7_collaborations 
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `),
        
        this.db.query(`
          SELECT COUNT(CASE WHEN shared_state->>'consensusDecision' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as rate
          FROM p7_collaborations 
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `),
        
        this.db.query(`
          SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
          FROM p7_collaborations 
          WHERE status = 'concluded' 
          AND created_at > NOW() - INTERVAL '24 hours'
        `)
      ]);

      return {
        activeCollaborations: parseInt(active.rows[0]?.count || 0),
        totalCollaborations: parseInt(total.rows[0]?.count || 0),
        averageParticipants: parseFloat(total.rows[0]?.avg_participants || 0),
        consensusRate: parseFloat(consensus.rows[0]?.rate || 0),
        averageResolutionTime: parseFloat(timing.rows[0]?.avg_duration || 0)
      };

    } catch (error) {
      this.logger.error('Failed to get collaboration statistics:', error);
      return {
        activeCollaborations: 0,
        totalCollaborations: 0,
        averageParticipants: 0,
        consensusRate: 0,
        averageResolutionTime: 0
      };
    }
  }
}