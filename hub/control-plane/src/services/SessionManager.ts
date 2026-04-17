import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface SessionConfig {
  sessionId: string;
  candidateId: string;
  examId: string;
  tenantId: string;
  proctoring_model: 'basic' | 'advanced';
  proctor_ratio: number;
  status: 'PENDING' | 'PENDING_APPROVAL' | 'WAITING_ROOM' | 'AI_SCANNING' | 'APPROVED' | 'IN_PROGRESS' | 'REJECTED' | 'COMPLETED';
  assignedProctorId?: string;
  createdAt: Date;
  approvedAt?: Date;
  metadata: {
    candidateName: string;
    examTitle: string;
    duration: number;
    complexity_score?: number;
    ai_pre_scan_result?: 'GREEN' | 'AMBER' | 'RED';
    rejection_reason?: string;
    id_document_uploaded?: boolean;
    document_type?: string;
    upload_timestamp?: Date;
  };
}

export interface ProctorAssignment {
  proctorId: string;
  currentLoad: number;
  maxCapacity: number;
  assignedSessions: string[];
  status: 'ACTIVE' | 'BUSY' | 'OFFLINE';
}

export class SessionManager {
  private logger = Logger.getInstance();

  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection
  ) {}

  /**
   * Creates a new exam session with appropriate model workflow
   * REQ-025: Multi-Stage Entry Protocol for Advanced Model
   * REQ-021: Standard routing for Basic Model  
   */
  async createSession(sessionData: Partial<SessionConfig>): Promise<SessionConfig> {
    try {
      const sessionId = uuidv4();
      const session: SessionConfig = {
        sessionId,
        candidateId: sessionData.candidateId!,
        examId: sessionData.examId!,
        tenantId: sessionData.tenantId!,
        proctoring_model: sessionData.proctoring_model || 'basic',
        proctor_ratio: sessionData.proctor_ratio || 15,
        status: sessionData.proctoring_model === 'advanced' ? 'PENDING_APPROVAL' : 'PENDING',
        createdAt: new Date(),
        metadata: sessionData.metadata!
      };

      // Store in database
      await this.db.query(`
        INSERT INTO p7_sessions (
          session_id, candidate_id, exam_id, tenant_id, 
          proctoring_model, proctor_ratio, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        session.sessionId, session.candidateId, session.examId, session.tenantId,
        session.proctoring_model, session.proctor_ratio, session.status,
        JSON.stringify(session.metadata), session.createdAt
      ]);

      // Cache in Redis for real-time access
      await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));

      // Advanced Model: Route to Gatekeeper for multi-stage entry
      if (session.proctoring_model === 'advanced') {
        await this.initiateAdvancedModelWorkflow(session);
      } else {
        // Basic Model: Direct proctor assignment
        await this.initiateBasicModelWorkflow(session);
      }

      this.logger.info(`✅ Session created: ${sessionId} (${session.proctoring_model} model)`);
      return session;

    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Advanced Model Workflow: Multi-stage entry with AI pre-scanning
   * REQ-025: Multi-Stage Entry Protocol with candidate waiting room
   * REQ-027: AI pre-scanning of ID documents with Green/Amber flagging
   */
  private async initiateAdvancedModelWorkflow(session: SessionConfig): Promise<void> {
    try {
      // Step 1: Move candidate to waiting room
      await this.updateSessionStatus(session.sessionId, 'WAITING_ROOM');

      // Step 2: Trigger AI pre-scanning
      await this.triggerAIPreScanning(session);

      // Step 3: Queue for Gatekeeper review
      await this.queueForGatekeeperReview(session);

      this.logger.info(`🚪 Advanced model workflow initiated for session: ${session.sessionId}`);

    } catch (error) {
      this.logger.error('Failed to initiate advanced model workflow:', error);
      throw error;
    }
  }

  /**
   * Basic Model Workflow: Direct proctor assignment
   * REQ-021: Route cases based on proctor availability and current load
   */
  private async initiateBasicModelWorkflow(session: SessionConfig): Promise<void> {
    try {
      // Find available proctor based on load balancing
      const availableProctor = await this.findAvailableProctor(session.tenantId, session.proctor_ratio);
      
      if (availableProctor) {
        await this.assignProctor(session.sessionId, availableProctor.proctorId);
        await this.updateSessionStatus(session.sessionId, 'APPROVED');
        this.logger.info(`👥 Basic model: Session ${session.sessionId} assigned to proctor ${availableProctor.proctorId}`);
      } else {
        // Queue for next available proctor
        await this.queueForProctorAvailability(session);
        this.logger.info(`⏳ Basic model: Session ${session.sessionId} queued for proctor availability`);
      }

    } catch (error) {
      this.logger.error('Failed to initiate basic model workflow:', error);
      throw error;
    }
  }

  /**
   * AI Pre-scanning for Advanced Model
   * REQ-027: AI pre-scanning of ID documents with Green/Amber flagging system
   */
  private async triggerAIPreScanning(session: SessionConfig): Promise<void> {
    try {
      // Update status to scanning
      await this.updateSessionStatus(session.sessionId, 'AI_SCANNING');

      // Call P7 AI Vision Service for document analysis
      const aiScanResponse = await axios.post(`http://localhost:13101/api/pre-scan`, {
        sessionId: session.sessionId,
        candidateId: session.candidateId,
        documentType: 'ID',
        analysisLevel: 'ENHANCED'
      });

      const scanResult = aiScanResponse.data.flagColor; // 'GREEN', 'AMBER', 'RED'
      
      // Update session with AI scan result
      await this.updateSessionMetadata(session.sessionId, {
        ai_pre_scan_result: scanResult,
        complexity_score: aiScanResponse.data.complexityScore
      });

      this.logger.info(`🤖 AI Pre-scan completed for ${session.sessionId}: ${scanResult} flag`);

    } catch (error) {
      this.logger.error('AI pre-scanning failed:', error);
      // Continue workflow even if AI scanning fails
      await this.updateSessionMetadata(session.sessionId, {
        ai_pre_scan_result: 'AMBER'
      });
    }
  }

  /**
   * Queue session for Gatekeeper review (Advanced Model)
   * REQ-038: Pre-Flight controls: [Watch Live] [Capture ID] [Approve] [Reject with Reason]
   */
  private async queueForGatekeeperReview(session: SessionConfig): Promise<void> {
    try {
      // Add to Gatekeeper priority queue
      const queuePosition = await this.redis.lpush(`gatekeeper:queue:${session.tenantId}`, session.sessionId);
      
      // Notify Gatekeeper service
      await axios.post(`http://localhost:12102/api/queue/notify`, {
        sessionId: session.sessionId,
        priority: session.metadata.complexity_score || 5,
        queuePosition
      });

      this.logger.info(`🚪 Session ${session.sessionId} queued for Gatekeeper review (position: ${queuePosition})`);

    } catch (error) {
      this.logger.error('Failed to queue for Gatekeeper review:', error);
      throw error;
    }
  }

  /**
   * Find available proctor based on load balancing
   * REQ-035: Load balancer querying active proctors where Current_Load < Configured_Ratio
   */
  async findAvailableProctor(tenantId: string, requiredRatio: number): Promise<ProctorAssignment | null> {
    try {
      const proctors = await this.db.query(`
        SELECT proctor_id, current_load, max_capacity, assigned_sessions, status
        FROM p7_proctors 
        WHERE tenant_id = $1 
        AND status = 'ACTIVE' 
        AND current_load < $2
        ORDER BY current_load ASC
        LIMIT 1
      `, [tenantId, requiredRatio]);

      if (proctors.rows.length === 0) {
        return null;
      }

      const proctor = proctors.rows[0];
      return {
        proctorId: proctor.proctor_id,
        currentLoad: proctor.current_load,
        maxCapacity: proctor.max_capacity,
        assignedSessions: proctor.assigned_sessions || [],
        status: proctor.status
      };

    } catch (error) {
      this.logger.error('Failed to find available proctor:', error);
      return null;
    }
  }

  /**
   * Assign proctor to session
   * REQ-036: Random assignment of Candidate_UUID to Proctor_ID on session start
   */
  async assignProctor(sessionId: string, proctorId: string): Promise<void> {
    try {
      // Update session with proctor assignment
      await this.db.query(`
        UPDATE p7_sessions 
        SET assigned_proctor_id = $1, approved_at = NOW()
        WHERE session_id = $2
      `, [proctorId, sessionId]);

      // Update proctor load
      await this.db.query(`
        UPDATE p7_proctors 
        SET current_load = current_load + 1,
            assigned_sessions = array_append(assigned_sessions, $1)
        WHERE proctor_id = $2
      `, [sessionId, proctorId]);

      // Update Redis cache
      const sessionData = await this.getSession(sessionId);
      if (sessionData) {
        sessionData.assignedProctorId = proctorId;
        sessionData.approvedAt = new Date();
        await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(sessionData));
      }

      this.logger.info(`✅ Proctor ${proctorId} assigned to session ${sessionId}`);

    } catch (error) {
      this.logger.error('Failed to assign proctor:', error);
      throw error;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: SessionConfig['status']): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_sessions SET status = $1 WHERE session_id = $2
      `, [status, sessionId]);

      // Update Redis cache
      const cachedSession = await this.redis.get(`session:${sessionId}`);
      if (cachedSession) {
        const session = JSON.parse(cachedSession);
        session.status = status;
        await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));
      }

      this.logger.info(`📊 Session ${sessionId} status updated to: ${status}`);

    } catch (error) {
      this.logger.error('Failed to update session status:', error);
      throw error;
    }
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(sessionId: string, metadata: Partial<SessionConfig['metadata']>): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.metadata = { ...session.metadata, ...metadata };
        
        await this.db.query(`
          UPDATE p7_sessions SET metadata = $1 WHERE session_id = $2
        `, [JSON.stringify(session.metadata), sessionId]);

        await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));
      }

    } catch (error) {
      this.logger.error('Failed to update session metadata:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionConfig | null> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(`session:${sessionId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to database
      const result = await this.db.query(`
        SELECT * FROM p7_sessions WHERE session_id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const session: SessionConfig = {
        sessionId: row.session_id,
        candidateId: row.candidate_id,
        examId: row.exam_id,
        tenantId: row.tenant_id,
        proctoring_model: row.proctoring_model,
        proctor_ratio: row.proctor_ratio,
        status: row.status,
        assignedProctorId: row.assigned_proctor_id,
        createdAt: row.created_at,
        approvedAt: row.approved_at,
        metadata: row.metadata
      };

      // Cache for future requests
      await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));

      return session;

    } catch (error) {
      this.logger.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Queue session for proctor availability (Basic Model)
   */
  private async queueForProctorAvailability(session: SessionConfig): Promise<void> {
    try {
      await this.redis.lpush(`proctor:queue:${session.tenantId}`, session.sessionId);
      this.logger.info(`⏳ Session ${session.sessionId} queued for proctor availability`);
    } catch (error) {
      this.logger.error('Failed to queue for proctor availability:', error);
      throw error;
    }
  }

  /**
   * Get sessions by tenant and status
   */
  async getSessionsByStatus(tenantId: string, status: SessionConfig['status']): Promise<SessionConfig[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM p7_sessions 
        WHERE tenant_id = $1 AND status = $2 
        ORDER BY created_at ASC
      `, [tenantId, status]);

      return result.rows.map(row => ({
        sessionId: row.session_id,
        candidateId: row.candidate_id,
        examId: row.exam_id,
        tenantId: row.tenant_id,
        proctoring_model: row.proctoring_model,
        proctor_ratio: row.proctor_ratio,
        status: row.status,
        assignedProctorId: row.assigned_proctor_id,
        createdAt: row.created_at,
        approvedAt: row.approved_at,
        metadata: row.metadata
      }));

    } catch (error) {
      this.logger.error('Failed to get sessions by status:', error);
      return [];
    }
  }
}