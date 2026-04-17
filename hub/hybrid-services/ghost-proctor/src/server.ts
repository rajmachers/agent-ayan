/**
 * Phase 7 Ghost Proctor Service - Advanced Analytics & Supervision
 * Supervisory oversight and emergency management for Advanced Proctoring Model
 * REQ-041: Proctor efficiency ranking identifying "Super Proctors" vs "Slow Proctors"
 * REQ-042: "Ghost" proctor assigned during exam scheduling, can access any session
 * REQ-043: AI pre-vetting based on integrity/credibility score with tenant-configurable thresholds  
 * REQ-044: Emergency assignment via random distribution when all proctors at capacity
 * Port: 12103
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
import { Server as SocketServer } from 'socket.io';
import http from 'http';
import _ from 'lodash';
import moment from 'moment';

// Load environment variables
dotenv.config();

// Import route modules
import healthRoutes from './routes/health';
import supervisoryRoutes from './routes/supervisory';
import analyticsRoutes from './routes/analytics';
import prevettingRoutes from './routes/prevetting';
import emergencyRoutes from './routes/emergency';

// Proctor performance classification
export enum ProctorClassification {
  SUPER = 'super',
  STANDARD = 'standard', 
  SLOW = 'slow',
  TRAINEE = 'trainee'
}

// Credibility risk levels
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Emergency assignment types  
export enum AssignmentType {
  NORMAL = 'normal',
  EMERGENCY = 'emergency',
  OVERFLOW = 'overflow',
  REBALANCE = 'rebalance',
  GHOST_INTERVENTION = 'ghost_intervention'
}

// Performance metric interfaces
interface ProctorPerformance {
  proctorId: string;
  averageApprovalTime: number;
  throughputRate: number;
  accuracyScore: number;
  overrideRate: number;
  efficiencyRank: number;
  classification: ProctorClassification;
  sessionCount: number;
  totalCandidatesProcessed: number;
  rejectionRate: number;
  averageDecisionTime: number;
  lastUpdated: Date;
  weeklyTrend: number;
  monthlyTrend: number;
}

interface CredibilityScore {
  candidateId: string;
  overallScore: number; // 0-100
  factors: {
    documentQuality: number;
    behavioralPatterns: number;
    environmentRisk: number;
    technologyAnomaly: number;
    historicalData: number;
    biometricConsistency: number;
  };
  riskLevel: RiskLevel;
  recommendedAction: 'auto_approve' | 'human_review' | 'reject' | 'enhanced_monitoring';
  tenantThreshold: number;
  confidenceLevel: number;
  detectionReasons: string[];
}

interface EmergencyAssignment {
  assignmentId: string;
  candidateId: string;
  proctorId: string;
  ghostProctorId?: string;
  assignmentType: AssignmentType;
  timestamp: Date;
  reason: string;
  originalProctor?: string;
  priority: number;
  context: {
    totalSlots: number;
    activeAssignments: number;
    utilizationRate: number;
    queueLength: number;
    emergencyLevel: 'normal' | 'warning' | 'critical';
  };
}

class GhostProctorService {
  private app: express.Application;
  private server: http.Server;
  private io: SocketServer;
  private dbPool: Pool;
  private redis: Redis;
  private logger: winston.Logger;
  
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupLogger();
    this.setupDatabase();
    this.setupRedis();
    this.setupSocketIO();
    this.setupExpress();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] [GhostProctor]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/ghost-proctor-service.log' })
      ]
    });
  }

  private setupDatabase(): void {
    this.dbPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '12541'),
      database: process.env.DB_NAME || 'phase7_db',
      user: process.env.DB_USER || 'phase7_user',
      password: process.env.DB_PASSWORD || 'phase7_postgres_2026',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    this.dbPool.on('error', (err) => {
      this.logger.error('Database pool error:', err);
    });
  }

  private setupRedis(): void {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '12631'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.info('Ghost Proctor Service connected to Redis');
    });
  }

  private setupSocketIO(): void {
    this.io = new SocketServer(this.server, {
      cors: {
        origin: [
          'http://localhost:12101', // Proctor Dashboard
          'http://localhost:3000',  // Dev environment
          'https://proctor.dashboard.local'
        ],
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    // Real-time communication for supervisory oversight
    this.io.on('connection', (socket) => {
      this.logger.info('Ghost proctor connected:', socket.id);

      socket.on('join_supervisory', (data) => {
        const { proctorId, role } = data;
        if (role === 'ghost' || role === 'supervisor') {
          socket.join('supervisory');
          this.logger.info(`Ghost proctor ${proctorId} joined supervisory channel`);
        }
      });

      socket.on('monitor_session', (data) => {
        const { sessionId, proctorId } = data;
        socket.join(`session_${sessionId}`);
        this.logger.info(`Ghost proctor ${proctorId} monitoring session ${sessionId}`);
      });

      socket.on('disconnect', () => {
        this.logger.info('Ghost proctor disconnected:', socket.id);
      });
    });
  }

  private setupExpress(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: [
        'http://localhost:12101', // Proctor Dashboard  
        'http://localhost:3000',  // Dev environment
        'https://proctor.dashboard.local'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: any, res: Response, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
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
      req.io = this.io;
      req.ghostService = this;
      next();
    });

    // API routes
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/supervisory', supervisoryRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/prevetting', prevettingRoutes);
    this.app.use('/api/emergency', emergencyRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        service: 'Phase 7 Ghost Proctor Service',
        version: '1.0.0',
        description: 'Advanced Analytics & Supervision for Hybrid Proctoring Model',
        status: 'operational',
        features: [
          'Supervisory session access (REQ-042)',
          'Proctor performance analytics (REQ-041)',
          'AI pre-vetting with credibility scoring (REQ-043)',
          'Emergency assignment management (REQ-044)'
        ],
        classifications: Object.values(ProctorClassification),
        riskLevels: Object.values(RiskLevel),
        assignmentTypes: Object.values(AssignmentType),
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
        service: 'ghost-proctor-service-p7',
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      this.logger.error('Unhandled error:', error);
      
      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        service: 'ghost-proctor-service-p7',
        timestamp: new Date().toISOString()
      });
    });
  }

  // Core business logic methods

  /**
   * Calculate proctor performance metrics (REQ-041)
   */
  public async calculateProctorPerformance(proctorId: string): Promise<ProctorPerformance> {
    try {
      // Get performance data from database and Redis
      const perfQuery = await this.dbPool.query(`
        SELECT 
          COUNT(*) as session_count,
          AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) as avg_approval_time,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
          AVG(CASE WHEN accuracy_score IS NOT NULL THEN accuracy_score ELSE 0 END) as avg_accuracy
        FROM exam_sessions 
        WHERE proctor_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
      `, [proctorId]);

      const metrics = perfQuery.rows[0];
      const sessionCount = parseInt(metrics.session_count) || 0;
      const totalProcessed = parseInt(metrics.approved_count) + parseInt(metrics.rejected_count);
      
      // Calculate key performance indicators
      const averageApprovalTime = parseFloat(metrics.avg_approval_time) || 0;
      const throughputRate = sessionCount > 0 ? totalProcessed / 24 : 0; // per hour
      const accuracyScore = parseFloat(metrics.avg_accuracy) || 0;
      const rejectionRate = totalProcessed > 0 ? parseInt(metrics.rejected_count) / totalProcessed : 0;

      // Get override data from Redis
      const overrideCount = await this.redis.get(`proctor:${proctorId}:overrides:count`) || '0';
      const overrideRate = sessionCount > 0 ? parseInt(overrideCount) / sessionCount : 0;

      // Calculate efficiency rank (composite score)
      const efficiencyScore = this.calculateEfficiencyScore({
        averageApprovalTime,
        throughputRate, 
        accuracyScore,
        rejectionRate,
        overrideRate
      });

      // Determine classification
      const classification = this.classifyProctor(efficiencyScore, {
        averageApprovalTime,
        throughputRate,
        accuracyScore
      });

      const performance: ProctorPerformance = {
        proctorId,
        averageApprovalTime,
        throughputRate,
        accuracyScore,
        overrideRate,
        efficiencyRank: efficiencyScore,
        classification,
        sessionCount,
        totalCandidatesProcessed: totalProcessed,
        rejectionRate,
        averageDecisionTime: averageApprovalTime,
        lastUpdated: new Date(),
        weeklyTrend: 0, // TODO: Calculate trend
        monthlyTrend: 0 // TODO: Calculate trend  
      };

      // Cache performance data
      await this.redis.hset(`proctor:${proctorId}:performance`, {
        ...performance,
        lastUpdated: performance.lastUpdated.toISOString()
      });
      await this.redis.expire(`proctor:${proctorId}:performance`, 3600); // 1 hour cache

      return performance;

    } catch (error) {
      this.logger.error('Error calculating proctor performance:', error);
      throw error;
    }
  }

  /**
   * Calculate efficiency score for proctor ranking  
   */
  private calculateEfficiencyScore(metrics: {
    averageApprovalTime: number;
    throughputRate: number;
    accuracyScore: number;
    rejectionRate: number;
    overrideRate: number;
  }): number {
    const weights = {
      speed: 0.3,      // Lower approval time is better
      throughput: 0.25, // Higher throughput is better  
      accuracy: 0.25,   // Higher accuracy is better
      quality: 0.2     // Lower rejection/override rates are better
    };

    // Normalize metrics to 0-100 scale
    const speedScore = Math.max(0, 100 - (metrics.averageApprovalTime / 60) * 10); // Penalty for >10min
    const throughputScore = Math.min(100, metrics.throughputRate * 4); // Cap at 25 per hour
    const accuracyScore = metrics.accuracyScore;
    const qualityScore = Math.max(0, 100 - (metrics.rejectionRate + metrics.overrideRate) * 100);

    const composite = (
      speedScore * weights.speed +
      throughputScore * weights.throughput +
      accuracyScore * weights.accuracy +
      qualityScore * weights.quality
    );

    return Math.round(composite * 100) / 100;
  }

  /**
   * Classify proctor based on performance metrics
   */
  private classifyProctor(efficiencyScore: number, metrics: any): ProctorClassification {
    if (efficiencyScore >= 85 && metrics.throughputRate >= 15 && metrics.accuracyScore >= 90) {
      return ProctorClassification.SUPER;
    } else if (efficiencyScore >= 70 && metrics.accuracyScore >= 80) {
      return ProctorClassification.STANDARD;
    } else if (efficiencyScore >= 50) {
      return ProctorClassification.SLOW;
    } else {
      return ProctorClassification.TRAINEE;
    }
  }

  /**
   * AI pre-vetting with credibility scoring (REQ-043)
   */
  public async calculateCredibilityScore(candidateId: string, sessionData: any): Promise<CredibilityScore> {
    try {
      // Simulate AI analysis of multiple factors
      const factors = await this.analyzeCredibilityFactors(candidateId, sessionData);
      
      // Calculate weighted overall score
      const weights = {
        documentQuality: 0.25,
        behavioralPatterns: 0.20,
        environmentRisk: 0.15, 
        technologyAnomaly: 0.15,
        historicalData: 0.15,
        biometricConsistency: 0.10
      };

      const overallScore = Object.entries(factors).reduce((score, [factor, value]) => {
        const weight = weights[factor as keyof typeof weights] || 0;
        return score + (value * weight);
      }, 0);

      // Determine risk level and recommended action
      const riskLevel = this.determineRiskLevel(overallScore);
      const recommendedAction = this.getRecommendedAction(overallScore, riskLevel);

      // Get tenant-specific threshold
      const tenantThreshold = await this.getTenantThreshold(sessionData.tenantId);

      const credibilityScore: CredibilityScore = {
        candidateId,
        overallScore: Math.round(overallScore * 100) / 100,
        factors,
        riskLevel,
        recommendedAction,
        tenantThreshold,
        confidenceLevel: this.calculateConfidence(factors),
        detectionReasons: this.getDetectionReasons(factors)
      };

      // Store credibility score  
      await this.redis.hset(`candidate:${candidateId}:credibility`, {
        ...credibilityScore,
        timestamp: new Date().toISOString()
      });
      await this.redis.expire(`candidate:${candidateId}:credibility`, 7200); // 2 hours

      return credibilityScore;

    } catch (error) {
      this.logger.error('Error calculating credibility score:', error);
      throw error;
    }
  }

  /**
   * Analyze credibility factors using AI simulation
   */
  private async analyzeCredibilityFactors(candidateId: string, sessionData: any) {
    // Simulate various AI analysis results (in real implementation, this would call actual AI services)
    const baseFactors = {
      documentQuality: Math.random() * 40 + 60,     // 60-100 range
      behavioralPatterns: Math.random() * 30 + 50,  // 50-80 range  
      environmentRisk: Math.random() * 50 + 30,     // 30-80 range
      technologyAnomaly: Math.random() * 40 + 40,   // 40-80 range
      historicalData: Math.random() * 35 + 60,      // 60-95 range
      biometricConsistency: Math.random() * 20 + 70 // 70-90 range
    };

    // Add some risk scenarios for demonstration
    if (Math.random() < 0.1) { // 10% chance of high risk
      baseFactors.documentQuality = Math.random() * 30 + 20; // Low document quality
      baseFactors.behavioralPatterns = Math.random() * 25 + 15; // Suspicious behavior
    }

    return baseFactors;
  }

  /**
   * Determine risk level from overall score
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.LOW;
    if (score >= 60) return RiskLevel.MEDIUM;
    if (score >= 40) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  /**
   * Get recommended action based on score and risk
   */
  private getRecommendedAction(score: number, risk: RiskLevel): 'auto_approve' | 'human_review' | 'reject' | 'enhanced_monitoring' {
    if (score >= 85 && risk === RiskLevel.LOW) return 'auto_approve';
    if (score >= 70 && risk === RiskLevel.MEDIUM) return 'enhanced_monitoring';
    if (score >= 40) return 'human_review';
    return 'reject';
  }

  /**
   * Get tenant-specific credibility threshold
   */
  private async getTenantThreshold(tenantId: string): Promise<number> {
    const cached = await this.redis.get(`tenant:${tenantId}:credibility_threshold`);
    if (cached) return parseFloat(cached);

    // Default threshold, could be configured per tenant
    const defaultThreshold = 65.0;
    await this.redis.set(`tenant:${tenantId}:credibility_threshold`, defaultThreshold, 'EX', 86400);
    return defaultThreshold;
  }

  /**
   * Calculate confidence level for the assessment
   */
  private calculateConfidence(factors: any): number {
    const variance = Object.values(factors).reduce((acc: number, val: any) => {
      const mean = 70; // Expected mean score
      return acc + Math.pow(Number(val) - mean, 2);
    }, 0) / Object.keys(factors).length;

    // Higher variance = lower confidence
    const confidence = Math.max(60, 100 - Math.sqrt(variance));
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Generate human-readable detection reasons
   */
  private getDetectionReasons(factors: any): string[] {
    const reasons: string[] = [];
    
    if (factors.documentQuality < 50) reasons.push('Low quality ID documents detected');
    if (factors.behavioralPatterns < 40) reasons.push('Unusual behavioral patterns observed');
    if (factors.environmentRisk < 40) reasons.push('High-risk testing environment detected');
    if (factors.technologyAnomaly < 30) reasons.push('Technology anomalies detected');
    if (factors.biometricConsistency < 60) reasons.push('Inconsistent biometric data');
    
    return reasons.length > 0 ? reasons : ['Standard assessment completed'];
  }

  /**
   * Emergency assignment when proctors are at capacity (REQ-044)
   */
  public async handleEmergencyAssignment(candidateId: string, examId: string): Promise<EmergencyAssignment> {
    try {
      // Check current proctor capacity
      const capacity = await this.checkProctorCapacity();
      
      if (capacity.emergencyLevel === 'normal') {
        // Use normal assignment logic
        const assignedProctor = await this.assignAvailableProctor(candidateId);
        return this.createAssignment(candidateId, assignedProctor, AssignmentType.NORMAL, 'Normal assignment');
      }

      // Emergency scenario - find Ghost proctor or create overflow assignment
      if (capacity.emergencyLevel === 'warning' || capacity.emergencyLevel === 'critical') {
        const ghostProctor = await this.findAvailableGhostProctor();
        
        if (ghostProctor) {
          return this.createAssignment(candidateId, ghostProctor, AssignmentType.GHOST_INTERVENTION, 
            'Emergency assignment via Ghost proctor');
        }

        // Last resort - random distribution with overflow
        const overflowProctor = await this.randomAssignmentWithOverflow(candidateId);
        return this.createAssignment(candidateId, overflowProctor, AssignmentType.OVERFLOW,
          'Overflow assignment - all proctors at capacity');
      }

      throw new Error('No available proctors for emergency assignment');

    } catch (error) {
      this.logger.error('Emergency assignment failed:', error);
      throw error;
    }
  }

  /**
   * Check overall proctor capacity status
   */
  private async checkProctorCapacity() {
    const activeProctors = await this.redis.smembers('proctors:active');
    let totalSlots = 0;
    let usedSlots = 0;

    for (const proctorId of activeProctors) {
      const capacity = await this.redis.hget(`proctor:${proctorId}:capacity`, 'max_concurrent') || '5';
      const current = await this.redis.hget(`proctor:${proctorId}:capacity`, 'current_load') || '0';
      
      totalSlots += parseInt(capacity);
      usedSlots += parseInt(current);
    }

    const utilizationRate = totalSlots > 0 ? usedSlots / totalSlots : 0;
    const queueLength = await this.redis.llen('gatekeeper:waiting_room') + 
                       await this.redis.llen('gatekeeper:pending_approval');

    let emergencyLevel: 'normal' | 'warning' | 'critical' = 'normal';
    if (utilizationRate > 0.9) emergencyLevel = 'critical';
    else if (utilizationRate > 0.75) emergencyLevel = 'warning';

    return {
      totalSlots,
      activeAssignments: usedSlots,
      utilizationRate,
      queueLength, 
      emergencyLevel
    };
  }

  /**
   * Find available Ghost proctor for emergency situations
   */
  private async findAvailableGhostProctor(): Promise<string | null> {
    const ghostProctors = await this.redis.smembers('proctors:ghost');
    
    for (const ghostId of ghostProctors) {
      const isActive = await this.redis.sismember('proctors:active', ghostId);
      if (isActive) {
        const currentLoad = await this.redis.hget(`proctor:${ghostId}:capacity`, 'current_load') || '0';
        const maxLoad = await this.redis.hget(`proctor:${ghostId}:capacity`, 'max_concurrent') || '10';
        
        if (parseInt(currentLoad) < parseInt(maxLoad)) {
          return ghostId;
        }
      }
    }

    return null;
  }

  /**
   * Random assignment with overflow handling
   */
  private async randomAssignmentWithOverflow(candidateId: string): Promise<string> {
    const activeProctors = await this.redis.smembers('proctors:active');
    
    if (activeProctors.length === 0) {
      throw new Error('No active proctors available');
    }

    // Random selection
    const selectedProctor = activeProctors[Math.floor(Math.random() * activeProctors.length)];
    
    // Increment their load (create overflow)
    await this.redis.hincrby(`proctor:${selectedProctor}:capacity`, 'current_load', 1);
    
    this.logger.warn('Overflow assignment created', {
      candidateId,
      proctorId: selectedProctor,
      timestamp: new Date().toISOString()
    });

    return selectedProctor;
  }

  /**
   * Assign available proctor using normal logic
   */
  private async assignAvailableProctor(candidateId: string): Promise<string> {
    const activeProctors = await this.redis.smembers('proctors:active');
    
    for (const proctorId of activeProctors) {
      const currentLoad = await this.redis.hget(`proctor:${proctorId}:capacity`, 'current_load') || '0';
      const maxLoad = await this.redis.hget(`proctor:${proctorId}:capacity`, 'max_concurrent') || '5';
      
      if (parseInt(currentLoad) < parseInt(maxLoad)) {
        await this.redis.hincrby(`proctor:${proctorId}:capacity`, 'current_load', 1);
        return proctorId;
      }
    }

    throw new Error('All proctors at capacity');
  }

  /**
   * Create assignment record
   */
  private async createAssignment(
    candidateId: string, 
    proctorId: string, 
    type: AssignmentType, 
    reason: string,
    ghostProctorId?: string
  ): Promise<EmergencyAssignment> {
    const assignmentId = uuidv4();
    const capacity = await this.checkProctorCapacity();
    
    const assignment: EmergencyAssignment = {
      assignmentId,
      candidateId,
      proctorId,
      ghostProctorId,
      assignmentType: type,
      timestamp: new Date(),
      reason,
      priority: type === AssignmentType.EMERGENCY ? 1 : 
                type === AssignmentType.GHOST_INTERVENTION ? 2 :
                type === AssignmentType.OVERFLOW ? 3 : 4,
      context: capacity
    };

    // Store assignment
    await this.redis.hset(`assignment:${assignmentId}`, {
      ...assignment,
      timestamp: assignment.timestamp.toISOString()
    });
    await this.redis.expire(`assignment:${assignmentId}`, 86400); // 24 hours

    // Add to tracking lists
    await this.redis.lpush(`assignments:${type}`, assignmentId);
    await this.redis.expire(`assignments:${type}`, 86400);

    return assignment;
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 12103;
    
    try {
      // Test database connection
      await this.dbPool.query('SELECT NOW()');
      this.logger.info('Ghost Proctor Service connected to database');

      // Test Redis connection  
      await this.redis.ping();
      this.logger.info('Ghost Proctor Service connected to Redis');

      // Start server
      this.server.listen(port, () => {
        this.logger.info(`🚀 Ghost Proctor Service running on port ${port}`);
        this.logger.info('🔍 Features: Supervisory Access | Performance Analytics | AI Pre-vetting | Emergency Assignment');
        this.logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

    } catch (error) {
      this.logger.error('Failed to start Ghost Proctor Service:', error);
      process.exit(1);
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Ghost Proctor Service...');
    
    this.io.close();
    this.server.close();
    await this.dbPool.end();
    this.redis.disconnect();
    
    this.logger.info('Ghost Proctor Service shutdown complete');
  }
}

// Start the service
const ghostService = new GhostProctorService();

process.on('SIGTERM', () => ghostService.shutdown());
process.on('SIGINT', () => ghostService.shutdown());

ghostService.start().catch(err => {
  console.error('Failed to start Ghost Proctor Service:', err);
  process.exit(1);
});

export default GhostProctorService;