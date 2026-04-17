/**
 * Phase 7 WebSocket Service - Real-time Communication Server
 * Handles proctor-candidate messaging, system notifications, and live updates
 * Port: 12801
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import Redis from 'ioredis';

// Load environment variables
dotenv.config();

// Import Redis managers
// Note: For now, we'll implement basic Redis operations directly
// import { 
//   SessionAssignmentManager, 
//   ProctorCapacityManager, 
//   GatekeeperQueueManager 
// } from '../../../phase7-redis-manager/src/redisManager';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: 'proctor' | 'candidate' | 'admin';
  proctorId?: string;
  candidateId?: string;
  sessionId?: string;
}

interface ProctorMessage {
  messageId: string;
  sessionId: string;
  proctorId: string;
  candidateId: string;
  messageText: string;
  messageType: 'instruction' | 'warning' | 'rule_clarification' | 'technical_help' | 'violation_alert';
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  requiresAcknowledgment: boolean;
  timestamp: string;
}

class WebSocketService {
  private app: express.Application = express();
  private httpServer: any;
  private io: SocketIOServer;
  private logger: winston.Logger;
  private port: number;
  private redis: Redis;
  private pubSubRedis: Redis;

  // Connection tracking
  private proctorConnections = new Map<string, string>(); // proctorId -> socketId
  private candidateConnections = new Map<string, string>(); // candidateId -> socketId
  private sessionConnections = new Map<string, Set<string>>(); // sessionId -> Set<socketId>

  constructor() {
    this.port = parseInt(process.env.PORT || '3000');
    this.setupLogger();
    this.setupRedis();
    this.setupExpress();
    this.setupSocketIO();
    this.setupEventHandlers();
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: '/app/logs/websocket-service.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  private setupRedis(): void {
    // Main Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '12631'),
      db: 0,
      connectTimeout: 2000,
      maxRetriesPerRequest: 3
    });

    // Pub/Sub Redis connection
    this.pubSubRedis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '12631'),
      db: 1, // Use separate DB for pub/sub
      connectTimeout: 2000,
      maxRetriesPerRequest: 3
    });

    // Subscribe to system events
    this.pubSubRedis.subscribe(
      'proctor_assignment',
      'session_status_change', 
      'emergency_alert',
      'system_notification'
    );

    this.pubSubRedis.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });
  }

  private setupExpress(): void {
    this.app = express();
    this.httpServer = createServer(this.app);

    // Middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: [
        'http://localhost:12101', // Proctor Dashboard
        'http://localhost:3000',   // Local development
        process.env.CORS_ORIGINS?.split(',') || []
      ].flat(),
      credentials: true
    }));
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'websocket-service-p7',
        connections: {
          proctors: this.proctorConnections.size,
          candidates: this.candidateConnections.size,
          sessions: this.sessionConnections.size
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupSocketIO(): void {
    this.io = new SocketIOServer(this.httpServer, {
      path: '/ws',
      cors: {
        origin: [
          'http://localhost:12101',
          'http://localhost:3000',
          process.env.CORS_ORIGINS?.split(',') || []
        ].flat(),
        methods: ['GET', 'POST'],
        credentials: true
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
      }
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'phase7_jwt_secret_2026') as any;
        
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;

        if (decoded.role === 'proctor') {
          socket.proctorId = decoded.proctorId;
        } else if (decoded.role === 'candidate') {
          socket.candidateId = decoded.candidateId;
          socket.sessionId = decoded.sessionId;
        }

        next();

      } catch (error) {
        this.logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleClientConnection(socket);
    });
  }

  private handleClientConnection(socket: AuthenticatedSocket): void {
    const clientInfo = {
      socketId: socket.id,
      userId: socket.userId,
      role: socket.userRole,
      proctorId: socket.proctorId,
      candidateId: socket.candidateId,
      sessionId: socket.sessionId
    };

    this.logger.info('Client connected:', clientInfo);

    // Track connections
    if (socket.userRole === 'proctor' && socket.proctorId) {
      this.proctorConnections.set(socket.proctorId, socket.id);
      
      // Update proctor websocket ID in Redis
      this.updateProctorWebSocketId(socket.proctorId, socket.id);
      
      // Join proctor-specific room
      socket.join(`proctor:${socket.proctorId}`);

      // Send current assignments
      this.sendProctorAssignments(socket);

    } else if (socket.userRole === 'candidate' && socket.candidateId && socket.sessionId) {
      this.candidateConnections.set(socket.candidateId, socket.id);
      
      // Track session connection
      if (!this.sessionConnections.has(socket.sessionId)) {
        this.sessionConnections.set(socket.sessionId, new Set());
      }
      this.sessionConnections.get(socket.sessionId)!.add(socket.id);
      
      // Join session-specific room
      socket.join(`session:${socket.sessionId}`);
      
      // Notify proctor that candidate is online
      this.notifyProctorCandidateOnline(socket.sessionId, socket.candidateId);
    }

    // Set up event handlers for this socket
    this.setupSocketEventHandlers(socket);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Phase 7 WebSocket service',
      clientInfo,
      timestamp: new Date().toISOString()
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleClientDisconnection(socket);
    });
  }

  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    
    // Proctor sends message to candidate
    socket.on('proctor_message', async (data) => {
      if (socket.userRole !== 'proctor') return;
      
      await this.handleProctorMessage(socket, data);
    });

    // Candidate acknowledges proctor message
    socket.on('message_acknowledgment', async (data) => {
      if (socket.userRole !== 'candidate') return;
      
      await this.handleMessageAcknowledgment(socket, data);
    });

    // Proctor requests session update
    socket.on('request_session_update', async (data) => {
      if (socket.userRole !== 'proctor') return;
      
      await this.sendSessionUpdate(socket, data.sessionId);
    });

    // Heartbeat for connection monitoring
    socket.on('heartbeat', () => {
      socket.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
    });

    // Proctor status update
    socket.on('proctor_status_update', async (data) => {
      if (socket.userRole !== 'proctor') return;
      
      await this.handleProctorStatusUpdate(socket, data);
    });

    // Join/leave session room (for ghost proctors)
    socket.on('monitor_session', async (data) => {
      if (socket.userRole !== 'proctor') return;
      
      await this.handleMonitorSession(socket, data.sessionId, data.action);
    });
  }

  private async handleProctorMessage(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { sessionId, candidateId, messageText, messageType = 'instruction', urgency = 'normal', requiresAcknowledgment = false } = data;

      if (!sessionId || !candidateId || !messageText) {
        socket.emit('error', { message: 'Missing required fields for message' });
        return;
      }

      // Create message
      const message: ProctorMessage = {
        messageId: uuidv4(),
        sessionId,
        proctorId: socket.proctorId!,
        candidateId,
        messageText,
        messageType,
        urgency,
        requiresAcknowledgment,
        timestamp: new Date().toISOString()
      };

      // Store message in Redis
      await this.redis.hset(`message:${message.messageId}`, {
        sessionId: message.sessionId,
        proctorId: message.proctorId,
        candidateId: message.candidateId,
        messageText: message.messageText,
        messageType: message.messageType,
        urgency: message.urgency,
        requiresAcknowledgment: message.requiresAcknowledgment,
        timestamp: message.timestamp,
        delivered: false,
        acknowledged: false
      });
      await this.redis.expire(`message:${message.messageId}`, 3600); // 1 hour TTL

      // Send to candidate
      const candidateSocketId = this.candidateConnections.get(candidateId);
      if (candidateSocketId) {
        this.io.to(candidateSocketId).emit('proctor_message', message);
        
        // Mark as delivered
      await this.redis.hset(`message:${message.messageId}`, 'delivered', 'true');
        this.logger.info('Message delivered to candidate:', {
          messageId: message.messageId,
          sessionId,
          candidateId
        });
      } else {
        // Candidate offline - store for later delivery
        await this.redis.lpush(`candidate:${candidateId}:pending_messages`, message.messageId);
        
        this.logger.warn('Candidate offline - message queued:', {
          messageId: message.messageId,
          candidateId
        });
      }

      // Confirm to proctor
      socket.emit('message_sent', {
        messageId: message.messageId,
        delivered: candidateSocketId ? true : false,
        timestamp: message.timestamp
      });

    } catch (error) {
      this.logger.error('Handle proctor message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleMessageAcknowledgment(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { messageId } = data;

      if (!messageId) {
        socket.emit('error', { message: 'Message ID required for acknowledgment' });
        return;
      }

      // Update message in Redis
      await this.redis.hset(`message:${messageId}`, {
        acknowledged: true,
        acknowledgedAt: new Date().toISOString()
      });

      // Get message details
      const messageData = await this.redis.hgetall(`message:${messageId}`);
      
      // Notify proctor
      const proctorSocketId = this.proctorConnections.get(messageData.proctorId);
      if (proctorSocketId) {
        this.io.to(proctorSocketId).emit('message_acknowledged', {
          messageId,
          candidateId: socket.candidateId,
          acknowledgedAt: new Date().toISOString()
        });
      }

      this.logger.info('Message acknowledged by candidate:', {
        messageId,
        candidateId: socket.candidateId
      });

    } catch (error) {
      this.logger.error('Handle message acknowledgment error:', error);
    }
  }

  private async sendProctorAssignments(socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!socket.proctorId) return;

      // Get current assignments from Redis
      const sessionIds = await this.redis.smembers(`proctor:${socket.proctorId}:sessions`);
      const assignments = [];

      for (const sessionId of sessionIds) {
        const assignmentData = await this.redis.hgetall(`session:${sessionId}`);
        if (assignmentData && assignmentData.candidateId) {
          assignments.push({
            sessionId,
            candidateId: assignmentData.candidateId,
            status: assignmentData.status || 'assigned',
            model: assignmentData.model || 'basic',
            complexityScore: parseFloat(assignmentData.complexityScore) || 0.5,
            assignedAt: assignmentData.assignedAt,
            isOnline: this.candidateConnections.has(assignmentData.candidateId)
          });
        }
      }

      socket.emit('current_assignments', {
        proctorId: socket.proctorId,
        assignments,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Send proctor assignments error:', error);
    }
  }

  private async updateProctorWebSocketId(proctorId: string, socketId: string): Promise<void> {
    try {
      // Store proctor websocket mapping in Redis
      await this.redis.hset(`proctor:${proctorId}`, {
        websocketId: socketId,
        status: 'available',
        lastHeartbeat: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Update proctor websocket ID error:', error);
    }
  }

  private async notifyProctorCandidateOnline(sessionId: string, candidateId: string): Promise<void> {
    try {
      const assignmentData = await this.redis.hgetall(`session:${sessionId}`);
      if (assignmentData && assignmentData.proctorId) {
        const proctorSocketId = this.proctorConnections.get(assignmentData.proctorId);
        if (proctorSocketId) {
          this.io.to(proctorSocketId).emit('candidate_online', {
            sessionId,
            candidateId,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.logger.error('Notify proctor candidate online error:', error);
    }
  }

  private async sendSessionUpdate(socket: AuthenticatedSocket, sessionId: string): Promise<void> {
    try {
      const assignmentData = await this.redis.hgetall(`session:${sessionId}`);
      if (!assignmentData || !assignmentData.candidateId) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const sessionUpdate = {
        sessionId,
        candidateId: assignmentData.candidateId,
        status: assignmentData.status || 'assigned',
        model: assignmentData.model || 'basic',
        complexityScore: parseFloat(assignmentData.complexityScore) || 0.5,
        isOnline: this.candidateConnections.has(assignmentData.candidateId),
        lastUpdate: assignmentData.assignedAt,
        timestamp: new Date().toISOString()
      };

      socket.emit('session_update', sessionUpdate);

    } catch (error) {
      this.logger.error('Send session update error:', error);
      socket.emit('error', { message: 'Failed to get session update' });
    }
  }

  private async handleProctorStatusUpdate(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { status, maxCandidates } = data;
      
      if (!socket.proctorId) return;

      // Update proctor status in Redis
      await this.redis.hset(`proctor:${socket.proctorId}`, {
        status: status || 'available',
        maxCandidates: maxCandidates || 2,
        websocketId: socket.id,
        lastHeartbeat: new Date().toISOString()
      });

      socket.emit('status_updated', {
        status: status || 'available',
        maxCandidates: maxCandidates || 2,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Handle proctor status update error:', error);
    }
  }

  private async handleMonitorSession(socket: AuthenticatedSocket, sessionId: string, action: 'join' | 'leave'): Promise<void> {
    try {
      if (action === 'join') {
        socket.join(`session:${sessionId}`);
        
        if (!this.sessionConnections.has(sessionId)) {
          this.sessionConnections.set(sessionId, new Set());
        }
        this.sessionConnections.get(sessionId)!.add(socket.id);
        
        this.logger.info('Proctor joined session monitoring:', {
          proctorId: socket.proctorId,
          sessionId
        });
        
      } else if (action === 'leave') {
        socket.leave(`session:${sessionId}`);
        
        const sessionSockets = this.sessionConnections.get(sessionId);
        if (sessionSockets) {
          sessionSockets.delete(socket.id);
          if (sessionSockets.size === 0) {
            this.sessionConnections.delete(sessionId);
          }
        }
        
        this.logger.info('Proctor left session monitoring:', {
          proctorId: socket.proctorId,
          sessionId
        });
      }

    } catch (error) {
      this.logger.error('Handle monitor session error:', error);
    }
  }

  private handleRedisMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);
      
      switch (channel) {
        case 'proctor_assignment':
          this.handleProctorAssignmentUpdate(data);
          break;
          
        case 'session_status_change':
          this.handleSessionStatusChange(data);
          break;
          
        case 'emergency_alert':
          this.handleEmergencyAlert(data);
          break;
          
        case 'system_notification':
          this.handleSystemNotification(data);
          break;
      }
      
    } catch (error) {
      this.logger.error('Handle Redis message error:', error);
    }
  }

  private handleProctorAssignmentUpdate(data: any): void {
    const { proctorId, sessionId, action } = data;
    
    const proctorSocketId = this.proctorConnections.get(proctorId);
    if (proctorSocketId) {
      this.io.to(proctorSocketId).emit('assignment_update', {
        action, // 'assigned', 'removed', 'status_changed'
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }

  private handleSessionStatusChange(data: any): void {
    const { sessionId, newStatus, proctorId, candidateId } = data;
    
    // Notify session participants
    this.io.to(`session:${sessionId}`).emit('session_status_change', {
      sessionId,
      newStatus,
      timestamp: new Date().toISOString()
    });
  }

  private handleEmergencyAlert(data: any): void {
    const { level, message, affectedProctors } = data;
    
    if (affectedProctors && affectedProctors.length > 0) {
      // Send to specific proctors
      affectedProctors.forEach((proctorId: string) => {
        const socketId = this.proctorConnections.get(proctorId);
        if (socketId) {
          this.io.to(socketId).emit('emergency_alert', {
            level,
            message,
            timestamp: new Date().toISOString()
          });
        }
      });
    } else {
      // Broadcast to all proctors
      this.proctorConnections.forEach((socketId) => {
        this.io.to(socketId).emit('emergency_alert', {
          level,
          message,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  private handleSystemNotification(data: any): void {
    const { targetRole, message, urgency } = data;
    
    if (targetRole === 'proctor') {
      this.proctorConnections.forEach((socketId) => {
        this.io.to(socketId).emit('system_notification', {
          message,
          urgency,
          timestamp: new Date().toISOString()
        });
      });
    } else if (targetRole === 'candidate') {
      this.candidateConnections.forEach((socketId) => {
        this.io.to(socketId).emit('system_notification', {
          message,
          urgency,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  private handleClientDisconnection(socket: AuthenticatedSocket): void {
    const clientInfo = {
      socketId: socket.id,
      userId: socket.userId,
      role: socket.userRole,
      proctorId: socket.proctorId,
      candidateId: socket.candidateId
    };

    this.logger.info('Client disconnected:', clientInfo);

    // Clean up connections
    if (socket.userRole === 'proctor' && socket.proctorId) {
      this.proctorConnections.delete(socket.proctorId);
      
      // Update proctor status to offline
      this.updateProctorOfflineStatus(socket.proctorId);
      
    } else if (socket.userRole === 'candidate' && socket.candidateId && socket.sessionId) {
      this.candidateConnections.delete(socket.candidateId);
      
      // Remove from session tracking
      const sessionSockets = this.sessionConnections.get(socket.sessionId);
      if (sessionSockets) {
        sessionSockets.delete(socket.id);
        if (sessionSockets.size === 0) {
          this.sessionConnections.delete(socket.sessionId);
        }
      }
      
      // Notify proctor that candidate went offline
      this.notifyProctorCandidateOffline(socket.sessionId, socket.candidateId);
    }
  }

  private async updateProctorOfflineStatus(proctorId: string): Promise<void> {
    try {
      // Update proctor status to offline
      await this.redis.hset(`proctor:${proctorId}`, {
        status: 'offline',
        websocketId: '',
        lastHeartbeat: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Update proctor offline status error:', error);
    }
  }

  private async notifyProctorCandidateOffline(sessionId: string, candidateId: string): Promise<void> {
    try {
      const assignmentData = await this.redis.hgetall(`session:${sessionId}`);
      if (assignmentData && assignmentData.proctorId) {
        const proctorSocketId = this.proctorConnections.get(assignmentData.proctorId);
        if (proctorSocketId) {
          this.io.to(proctorSocketId).emit('candidate_offline', {
            sessionId,
            candidateId,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.logger.error('Notify proctor candidate offline error:', error);
    }
  }

  public async start(): Promise<void> {
    try {
      // Test Redis connections
      await this.redis.ping();
      await this.pubSubRedis.ping();
      this.logger.info('✅ Redis connections established');

      // Start server
      this.httpServer.listen(this.port, () => {
        this.logger.info(`🚀 Phase 7 WebSocket Service started on port ${this.port}`);
        this.logger.info(`📡 WebSocket endpoint: ws://localhost:${this.port}/ws`);
        this.logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

    } catch (error) {
      this.logger.error('Failed to start WebSocket service:', error);
      process.exit(1);
    }
  }

  private async shutdown(signal: string): Promise<void> {
    this.logger.info(`📴 Received ${signal}, shutting down gracefully...`);
    
    // Close all socket connections
    this.io.close();
    
    // Close Redis connections
    this.redis.disconnect();
    this.pubSubRedis.disconnect();
    
    // Close HTTP server
    this.httpServer.close(() => {
      this.logger.info('✅ WebSocket service shut down complete');
      process.exit(0);
    });
  }
}

// Start the service
const webSocketService = new WebSocketService();
webSocketService.start().catch((error) => {
  console.error('Failed to start WebSocket service:', error);
  process.exit(1);
});

export default WebSocketService;