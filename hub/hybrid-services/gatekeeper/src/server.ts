/**
 * Phase 7 Gatekeeper Service - Multi-Stage Entry Protocol
 * Advanced Model: Human-in-the-Loop Entry with ID Verification
 * REQ-025: Multi-Stage Entry Protocol with candidate waiting room (PENDING_APPROVAL state)
 * REQ-026: Live stream initiation and high-res ID capture by proctor
 * Port: 12102
 */

import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import { Pool } from 'pg';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

// Load environment variables
dotenv.config();

// Import route modules
import healthRoutes from './routes/health';
import entryRoutes from './routes/entry';
import verificationRoutes from './routes/verification';
import approvalRoutes from './routes/approval';
import streamRoutes from './routes/stream';

// Multi-stage entry states
export enum EntryState {
  INITIAL = 'INITIAL',
  WAITING_ROOM = 'WAITING_ROOM', 
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ID_VERIFICATION = 'ID_VERIFICATION',
  LIVE_STREAM_SETUP = 'LIVE_STREAM_SETUP',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_EXAM = 'IN_EXAM'
}

// ID verification flagging system (REQ-027)
export enum VerificationFlag {
  GREEN = 'GREEN',     // AI cleared - low risk
  AMBER = 'AMBER',     // AI flagged - requires human review
  RED = 'RED',         // AI rejected - high risk
  PENDING = 'PENDING'  // Processing
}

interface CandidateSession {
  candidateId: string;
  sessionId: string;
  entryState: EntryState;
  proctorId?: string;
  verificationFlag: VerificationFlag;
  idDocuments: string[];
  liveStreamUrl?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  metadata: any;
}

class GatekeeperService {
  private app: express.Application = express();
  private logger: winston.Logger;
  private port: number;
  private dbPool: Pool;
  private redis: Redis;
  private upload: multer.Multer;

  // Entry queue tracking
  private waitingRoom = new Map<string, CandidateSession>();
  private pendingApproval = new Map<string, CandidateSession>();

  constructor() {
    this.port = parseInt(process.env.PORT || '3000');
    this.setupLogger();
    this.setupDatabase();
    this.setupRedis();
    this.setupMulter();
    this.setupExpress();
    this.setupRoutes();
    this.setupErrorHandling();
    this.startPeriodicCleanup();
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
          filename: '/app/logs/gatekeeper-service.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  private setupDatabase(): void {
    this.dbPool = new Pool({
      host: process.env.DB_HOST || 'phase7-postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'phase7_db',
      user: process.env.DB_USER || 'phase7_user',
      password: process.env.DB_PASSWORD || 'phase7_postgres_2026',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  private setupRedis(): void {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'phase7-redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      connectTimeout: 2000,
      maxRetriesPerRequest: 3
    });
  }

  private setupMulter(): void {
    // Configure multer for ID document uploads (REQ-026)
    const storage = multer.memoryStorage();
    this.upload = multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for high-res ID images
        files: 5 // Maximum 5 ID documents
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed for ID verification'));
        }
      }
    });
  }

  private setupExpress(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: [
        'http://localhost:12101', // Proctor Dashboard
        'http://localhost:12102', // Gatekeeper Service
        'http://localhost:3000',   // Local development
        process.env.CORS_ORIGINS?.split(',') || []
      ].flat(),
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        candidateId: req.headers['x-candidate-id']
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Attach dependencies to request object
    this.app.use((req: any, res: Response, next) => {
      req.db = this.dbPool;
      req.redis = this.redis;
      req.logger = this.logger;
      req.upload = this.upload;
      req.gatekeeperService = this;
      next();
    });

    // API routes
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/entry', entryRoutes);
    this.app.use('/api/verification', verificationRoutes);
    this.app.use('/api/approval', approvalRoutes);
    this.app.use('/api/stream', streamRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        service: 'Phase 7 Gatekeeper Service',
        version: '1.0.0',
        description: 'Multi-Stage Entry Protocol for Advanced Proctoring Model',
        status: 'operational',
        entryStates: Object.values(EntryState),
        verificationFlags: Object.values(VerificationFlag),
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        service: 'gatekeeper-service-p7'
      });
    });

    // Global error handler
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      this.logger.error('Gatekeeper service error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        candidateId: req.headers['x-candidate-id']
      });

      res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : err.message,
        service: 'gatekeeper-service-p7',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      });
    });
  }

  // REQ-025: Multi-Stage Entry Protocol Implementation
  public async initiateCandidateEntry(candidateId: string, examId: string): Promise<CandidateSession> {
    const sessionId = uuidv4();
    
    const session: CandidateSession = {
      candidateId,
      sessionId,
      entryState: EntryState.WAITING_ROOM,
      verificationFlag: VerificationFlag.PENDING,
      idDocuments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { examId }
    };

    // Store in waiting room
    this.waitingRoom.set(candidateId, session);
    
    // Store in Redis for real-time tracking
    await this.redis.hset(`gatekeeper:session:${sessionId}`, {
      candidateId,
      sessionId,
      entryState: EntryState.WAITING_ROOM,
      verificationFlag: VerificationFlag.PENDING,
      createdAt: session.createdAt,
      examId
    });

    // Add to waiting room queue
    await this.redis.lpush('gatekeeper:waiting_room', sessionId);

    this.logger.info('Candidate entry initiated', {
      candidateId,
      sessionId,
      examId,
      entryState: EntryState.WAITING_ROOM
    });

    return session;
  }

  public async transitionToApprovalQueue(sessionId: string, proctorId: string): Promise<boolean> {
    try {
      const sessionData = await this.redis.hgetall(`gatekeeper:session:${sessionId}`);
      if (!sessionData || !sessionData.candidateId) {
        return false;
      }

      // Update session state
      await this.redis.hset(`gatekeeper:session:${sessionId}`, {
        entryState: EntryState.PENDING_APPROVAL,
        proctorId,
        updatedAt: new Date().toISOString()
      });

      // Move from waiting room to approval queue
      await this.redis.lrem('gatekeeper:waiting_room', 1, sessionId);
      await this.redis.lpush('gatekeeper:pending_approval', sessionId);

      // Update in-memory tracking
      const candidateId = sessionData.candidateId;
      if (this.waitingRoom.has(candidateId)) {
        const session = this.waitingRoom.get(candidateId)!;
        session.entryState = EntryState.PENDING_APPROVAL;
        session.proctorId = proctorId;
        session.updatedAt = new Date().toISOString();
        
        this.waitingRoom.delete(candidateId);
        this.pendingApproval.set(candidateId, session);
      }

      this.logger.info('Session transitioned to approval queue', {
        sessionId,
        candidateId,
        proctorId,
        entryState: EntryState.PENDING_APPROVAL
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to transition session to approval queue:', error);
      return false;
    }
  }

  // REQ-027: AI Pre-scanning with Green/Amber flagging
  public async processIdVerification(sessionId: string, documents: Express.Multer.File[]): Promise<VerificationFlag> {
    try {
      // Simulate AI document processing (would integrate with actual AI service)
      const verificationResults = await this.simulateAiDocumentScanning(documents);
      
      let overallFlag = VerificationFlag.GREEN;
      
      // Determine overall verification flag
      if (verificationResults.some(result => result.risk === 'HIGH')) {
        overallFlag = VerificationFlag.RED;
      } else if (verificationResults.some(result => result.risk === 'MEDIUM')) {
        overallFlag = VerificationFlag.AMBER;
      }

      // Update session with verification results
      await this.redis.hset(`gatekeeper:session:${sessionId}`, {
        verificationFlag: overallFlag,
        verificationResults: JSON.stringify(verificationResults),
        idVerificationCompleted: new Date().toISOString()
      });

      this.logger.info('ID verification completed', {
        sessionId,
        overallFlag,
        documentCount: documents.length,
        verificationResults
      });

      return overallFlag;
    } catch (error) {
      this.logger.error('ID verification processing failed:', error);
      return VerificationFlag.RED;
    }
  }

  private async simulateAiDocumentScanning(documents: Express.Multer.File[]) {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    return documents.map((doc, index) => ({
      documentIndex: index,
      fileName: doc.originalname,
      fileSize: doc.size,
      confidence: 0.7 + Math.random() * 0.3,
      risk: Math.random() > 0.8 ? 'HIGH' : Math.random() > 0.5 ? 'MEDIUM' : 'LOW',
      features: {
        faceDetected: Math.random() > 0.1,
        textExtracted: Math.random() > 0.2,
        documentType: ['passport', 'drivers_license', 'national_id'][Math.floor(Math.random() * 3)],
        qualityScore: 0.6 + Math.random() * 0.4
      },
      flags: Math.random() > 0.9 ? ['BLURRY_IMAGE'] : Math.random() > 0.8 ? ['SUSPICIOUS_EDITING'] : []
    }));
  }

  private startPeriodicCleanup(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(async () => {
      try {
        const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
        
        // Clean waiting room
        for (const [candidateId, session] of this.waitingRoom.entries()) {
          if (new Date(session.createdAt).getTime() < cutoffTime) {
            this.waitingRoom.delete(candidateId);
            await this.redis.del(`gatekeeper:session:${session.sessionId}`);
            this.logger.info('Cleaned up expired waiting room session', { candidateId, sessionId: session.sessionId });
          }
        }

        // Clean pending approval
        for (const [candidateId, session] of this.pendingApproval.entries()) {
          if (new Date(session.createdAt).getTime() < cutoffTime) {
            this.pendingApproval.delete(candidateId);
            await this.redis.del(`gatekeeper:session:${session.sessionId}`);
            this.logger.info('Cleaned up expired pending approval session', { candidateId, sessionId: session.sessionId });
          }
        }

      } catch (error) {
        this.logger.error('Cleanup process error:', error);
      }
    }, 5 * 60 * 1000);
  }

  // Getters for route access
  public getWaitingRoom(): Map<string, CandidateSession> {
    return this.waitingRoom;
  }

  public getPendingApproval(): Map<string, CandidateSession> {
    return this.pendingApproval;
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      const client = await this.dbPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.logger.info('✅ Database connection established');

      // Test Redis connection
      await this.redis.ping();
      this.logger.info('✅ Redis connection established');

      // Start server
      this.app.listen(this.port, () => {
        this.logger.info(`🚀 Phase 7 Gatekeeper Service started on port ${this.port}`);
        this.logger.info(`🔗 Health check: http://localhost:${this.port}/api/health`);
        this.logger.info(`🚪 Entry endpoint: http://localhost:${this.port}/api/entry`);
        this.logger.info(`🆔 Verification endpoint: http://localhost:${this.port}/api/verification`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

    } catch (error) {
      this.logger.error('Failed to start Gatekeeper service:', error);
      process.exit(1);
    }
  }

  private async shutdown(signal: string): Promise<void> {
    this.logger.info(`📴 Received ${signal}, shutting down gracefully...`);
    
    // Close database connections
    await this.dbPool.end();
    
    // Close Redis connection
    this.redis.disconnect();
    
    this.logger.info('✅ Gatekeeper service shut down complete');
    process.exit(0);
  }
}

// Start the service
const gatekeeperService = new GatekeeperService();
gatekeeperService.start().catch((error) => {
  console.error('Failed to start Gatekeeper Service:', error);
  process.exit(1);
});

export default GatekeeperService;