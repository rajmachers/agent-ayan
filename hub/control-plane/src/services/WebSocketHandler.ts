import { Server as SocketIOServer, Socket } from 'socket.io';
import { SessionManager } from './SessionManager';
import { ProctorManager } from './ProctorManager';
import { Logger } from '../utils/Logger';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: 'proctor' | 'candidate' | 'admin';
  tenantId?: string;
}

export class WebSocketHandler {
  private logger = Logger.getInstance();
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'phase7-proctor-secret';

  constructor(
    private io: SocketIOServer,
    private sessionManager: SessionManager,
    private proctorManager: ProctorManager
  ) {
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('No authentication token');
        }

        const decoded = jwt.verify(token, this.JWT_SECRET) as any;
        socket.userId = decoded.proctorId || decoded.candidateId || decoded.adminId;
        socket.userType = decoded.type?.includes('proctor') ? 'proctor' : 
                         decoded.type?.includes('candidate') ? 'candidate' : 'admin';
        socket.tenantId = decoded.tenantId;

        next();
      } catch (error) {
        this.logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    this.logger.info(`🔌 WebSocket connected: ${socket.userType} ${socket.userId}`);

    // Join appropriate rooms based on user type
    if (socket.userType === 'proctor' && socket.tenantId) {
      socket.join(`proctor:${socket.tenantId}`);
      socket.join(`proctor:${socket.userId}`);
      this.handleProctorEvents(socket);
    } else if (socket.userType === 'candidate') {
      socket.join(`candidate:${socket.userId}`);
      this.handleCandidateEvents(socket);
    } else if (socket.userType === 'admin' && socket.tenantId) {
      socket.join(`admin:${socket.tenantId}`);
      this.handleAdminEvents(socket);
    }

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  private handleProctorEvents(socket: AuthenticatedSocket): void {
    const proctorId = socket.userId!;

    // Proctor status update
    socket.on('proctor:status', async (data: { status: 'ACTIVE' | 'BUSY' | 'OFFLINE' }) => {
      try {
        await this.proctorManager.updateProctorStatus(proctorId, data.status);
        
        // Notify admin dashboard
        this.io.to(`admin:${socket.tenantId}`).emit('proctor:status:updated', {
          proctorId,
          status: data.status,
          timestamp: new Date()
        });

        this.logger.info(`📊 Proctor ${proctorId} status updated: ${data.status}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Gatekeeper approval (Advanced Model)
    socket.on('gatekeeper:approve', async (data: { sessionId: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) => {
      try {
        if (data.decision === 'APPROVE') {
          await this.sessionManager.updateSessionStatus(data.sessionId, 'APPROVED');
          await this.sessionManager.assignProctor(data.sessionId, proctorId);
        } else {
          await this.sessionManager.updateSessionStatus(data.sessionId, 'REJECTED');
          await this.sessionManager.updateSessionMetadata(data.sessionId, {
            rejection_reason: data.reason || 'Rejected by proctor'
          });
        }

        // Notify candidate
        this.io.to(`candidate:${data.sessionId}`).emit('session:status', {
          status: data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          message: data.decision === 'APPROVE' ? 'Session approved! Starting exam...' : `Session rejected: ${data.reason}`
        });

        // Update proctor efficiency metrics
        const approvalTime = Date.now(); // In real implementation, calculate from queue time
        await this.proctorManager.updateProctorEfficiency(proctorId, {
          approvalTime: 45, // Average approval time in seconds
          sessionsCompleted: data.decision === 'APPROVE' ? 1 : 0
        });

        this.logger.info(`🚪 Gatekeeper decision by ${proctorId}: ${data.decision} for session ${data.sessionId}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to process decision' });
        this.logger.error('Gatekeeper approval error:', error);
      }
    });

    // Session monitoring events
    socket.on('session:monitor', async (data: { sessionId: string; action: string; details?: any }) => {
      try {
        // Log monitoring action
        this.logger.info(`👀 Proctor ${proctorId} monitoring session ${data.sessionId}: ${data.action}`);

        // Broadcast to admin dashboard
        this.io.to(`admin:${socket.tenantId}`).emit('session:activity', {
          sessionId: data.sessionId,
          proctorId,
          action: data.action,
          details: data.details,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to log monitoring action' });
      }
    });

    // Real-time messaging to candidates (Advanced Model)
    socket.on('proctor:message', async (data: { sessionId: string; message: string; type: 'WARNING' | 'INFO' | 'INSTRUCTION' }) => {
      try {
        // Send directive chat to candidate (REQ-028)
        this.io.to(`candidate:${data.sessionId}`).emit('proctor:directive', {
          message: data.message,
          type: data.type,
          proctorId,
          timestamp: new Date()
        });

        this.logger.info(`💬 Proctor ${proctorId} sent message to session ${data.sessionId}: ${data.type}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
  }

  private handleCandidateEvents(socket: AuthenticatedSocket): void {
    const candidateId = socket.userId!;

    // Session status requests
    socket.on('candidate:status', async (data: { sessionId: string }) => {
      try {
        const session = await this.sessionManager.getSession(data.sessionId);
        if (session && session.candidateId === candidateId) {
          socket.emit('session:status', {
            status: session.status,
            proctoring_model: session.proctoring_model,
            metadata: session.metadata
          });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to get session status' });
      }
    });

    // ID document upload for Advanced Model
    socket.on('candidate:id_upload', async (data: { sessionId: string; documentData: string; documentType: string }) => {
      try {
        // Trigger AI pre-scanning for Advanced Model
        this.logger.info(`📄 ID document uploaded for session ${data.sessionId}`);

        // Update session metadata
        await this.sessionManager.updateSessionMetadata(data.sessionId, {
          id_document_uploaded: true,
          document_type: data.documentType,
          upload_timestamp: new Date()
        });

        // Notify Gatekeeper if Advanced Model
        const session = await this.sessionManager.getSession(data.sessionId);
        if (session?.proctoring_model === 'advanced') {
          this.io.to(`proctor:${session.tenantId}`).emit('gatekeeper:document_ready', {
            sessionId: data.sessionId,
            candidateId,
            documentType: data.documentType,
            ai_scan_result: 'PENDING'
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to process document upload' });
      }
    });

    // Heartbeat for session monitoring
    socket.on('candidate:heartbeat', async (data: { sessionId: string }) => {
      try {
        // Update last seen timestamp
        socket.emit('heartbeat:ack', { timestamp: new Date() });
      } catch (error) {
        this.logger.error('Heartbeat error:', error);
      }
    });
  }

  private handleAdminEvents(socket: AuthenticatedSocket): void {
    const adminId = socket.userId!;
    const tenantId = socket.tenantId!;

    // Dashboard data requests
    socket.on('admin:dashboard', async () => {
      try {
        const [readiness, queueStatus, proctorStats] = await Promise.all([
          this.proctorManager.getReadinessDashboard(tenantId),
          this.getQueueStatus(tenantId),
          this.getProctorStatistics(tenantId)
        ]);

        socket.emit('dashboard:data', {
          readiness,
          queueStatus,
          proctorStats,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to get dashboard data' });
      }
    });

    // Model switch events
    socket.on('admin:model_switch', async (data: { proctoring_model: 'basic' | 'advanced'; reason?: string }) => {
      try {
        // This would integrate with the Model Orchestrator
        this.logger.info(`🔄 Admin ${adminId} requested model switch to ${data.proctoring_model}`);

        // Broadcast to all connected proctors
        this.io.to(`proctor:${tenantId}`).emit('model:switched', {
          new_model: data.proctoring_model,
          switched_by: adminId,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to switch model' });
      }
    });

    // Real-time statistics subscription
    socket.on('admin:subscribe_stats', () => {
      // Admin joins statistics room for real-time updates
      socket.join(`stats:${tenantId}`);
      this.logger.info(`📊 Admin ${adminId} subscribed to real-time stats`);
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    this.logger.info(`🔌 WebSocket disconnected: ${socket.userType} ${socket.userId}`);

    if (socket.userType === 'proctor') {
      // Update proctor status to offline after grace period
      setTimeout(async () => {
        try {
          await this.proctorManager.updateProctorStatus(socket.userId!, 'OFFLINE');
        } catch (error) {
          this.logger.error('Failed to update proctor status on disconnect:', error);
        }
      }, 30000); // 30 second grace period
    }
  }

  // Utility methods

  private async getQueueStatus(tenantId: string): Promise<{
    waiting_room: number;
    gatekeeper_queue: number;
    pending_basic: number;
    in_progress: number;
  }> {
    try {
      const [waitingRoom, gatekeeperQueue, pendingBasic, inProgress] = await Promise.all([
        this.sessionManager.getSessionsByStatus(tenantId, 'WAITING_ROOM'),
        this.sessionManager.getSessionsByStatus(tenantId, 'PENDING_APPROVAL'),
        this.sessionManager.getSessionsByStatus(tenantId, 'PENDING'),
        this.sessionManager.getSessionsByStatus(tenantId, 'IN_PROGRESS')
      ]);

      return {
        waiting_room: waitingRoom.length,
        gatekeeper_queue: gatekeeperQueue.length,
        pending_basic: pendingBasic.length,
        in_progress: inProgress.length
      };

    } catch (error) {
      this.logger.error('Failed to get queue status:', error);
      return { waiting_room: 0, gatekeeper_queue: 0, pending_basic: 0, in_progress: 0 };
    }
  }

  private async getProctorStatistics(tenantId: string): Promise<{
    total: number;
    active: number;
    busy: number;
    offline: number;
    efficiency: { super: number; regular: number; slow: number };
  }> {
    try {
      const proctors = await this.proctorManager.getActiveProctors(tenantId);
      
      const stats = {
        total: proctors.length,
        active: proctors.filter(p => p.status === 'ACTIVE').length,
        busy: proctors.filter(p => p.status === 'BUSY').length,
        offline: proctors.filter(p => p.status === 'OFFLINE').length,
        efficiency: {
          super: proctors.filter(p => p.efficiency.rank === 'SUPER_PROCTOR').length,
          regular: proctors.filter(p => p.efficiency.rank === 'REGULAR').length,
          slow: proctors.filter(p => p.efficiency.rank === 'SLOW_PROCTOR').length
        }
      };

      return stats;

    } catch (error) {
      this.logger.error('Failed to get proctor statistics:', error);
      return { total: 0, active: 0, busy: 0, offline: 0, efficiency: { super: 0, regular: 0, slow: 0 } };
    }
  }

  // Public methods for external services to emit events

  public notifySessionUpdate(sessionId: string, status: string, metadata?: any): void {
    this.io.to(`candidate:${sessionId}`).emit('session:status', {
      status,
      metadata,
      timestamp: new Date()
    });
  }

  public notifyProctorAssignment(proctorId: string, sessionId: string, sessionData: any): void {
    this.io.to(`proctor:${proctorId}`).emit('session:assigned', {
      sessionId,
      sessionData,
      timestamp: new Date()
    });
  }

  public broadcastModelSwitch(tenantId: string, newModel: string): void {
    this.io.to(`admin:${tenantId}`).emit('model:switched', {
      new_model: newModel,
      timestamp: new Date()
    });
  }

  public sendGatekeeperNotification(tenantId: string, sessionData: any): void {
    this.io.to(`proctor:${tenantId}`).emit('gatekeeper:new_session', {
      sessionData,
      timestamp: new Date()
    });
  }
}