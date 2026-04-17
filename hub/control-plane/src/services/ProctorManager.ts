import { DatabaseConnection } from '../database/DatabaseConnection';
import { RedisConnection } from '../database/RedisConnection';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import axios from 'axios';

export interface Proctor {
  proctorId: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  credentials: string;
  status: 'ACTIVE' | 'BUSY' | 'OFFLINE' | 'SUSPENDED';
  currentLoad: number;
  maxCapacity: number;
  assignedSessions: string[];
  efficiency: {
    avgApprovalTime: number;
    throughput: number;
    accuracy: number;
    rank: 'SUPER_PROCTOR' | 'REGULAR' | 'SLOW_PROCTOR';
  };
  createdAt: Date;
  lastActiveAt?: Date;
}

export interface ProctorCredentials {
  proctorId: string;
  token: string;
  expiresAt: Date;
}

export class ProctorManager {
  private logger = Logger.getInstance();
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'phase7-proctor-secret';

  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection
  ) {}

  /**
   * Register new proctor with auto-generated credentials
   * REQ-033: Proctor Registry with CRUD operations
   * REQ-034: Auto-credential generator with secure email token delivery
   */
  async registerProctor(proctorData: {
    tenantId: string;
    name: string;
    email: string;
    phone?: string;
    maxCapacity?: number;
  }): Promise<{ proctor: Proctor; credentials: ProctorCredentials }> {
    try {
      const proctorId = uuidv4();
      const credentials = this.generateProctorCredentials(proctorId);

      const proctor: Proctor = {
        proctorId,
        tenantId: proctorData.tenantId,
        name: proctorData.name,
        email: proctorData.email,
        phone: proctorData.phone,
        credentials: credentials.token,
        status: 'OFFLINE',
        currentLoad: 0,
        maxCapacity: proctorData.maxCapacity || 15,
        assignedSessions: [],
        efficiency: {
          avgApprovalTime: 0,
          throughput: 0,
          accuracy: 0,
          rank: 'REGULAR'
        },
        createdAt: new Date()
      };

      // Store in database
      await this.db.query(`
        INSERT INTO p7_proctors (
          proctor_id, tenant_id, name, email, phone, credentials, 
          status, current_load, max_capacity, assigned_sessions, 
          efficiency, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        proctor.proctorId, proctor.tenantId, proctor.name, proctor.email, proctor.phone,
        proctor.credentials, proctor.status, proctor.currentLoad, proctor.maxCapacity,
        JSON.stringify(proctor.assignedSessions), JSON.stringify(proctor.efficiency), proctor.createdAt
      ]);

      // Send magic link email
      await this.sendMagicLinkEmail(proctor, credentials);

      this.logger.info(`✅ Proctor registered: ${proctor.name} (${proctorId})`);
      return { proctor, credentials };

    } catch (error) {
      this.logger.error('Failed to register proctor:', error);
      throw new Error('Proctor registration failed');
    }
  }

  /**
   * Bulk CSV proctor upload
   * REQ-031: Bulk CSV proctor upload with automated Magic Link credential delivery
   */
  async bulkRegisterProctors(proctorList: Array<{
    tenantId: string;
    name: string;
    email: string;
    phone?: string;
    maxCapacity?: number;
  }>): Promise<{ success: number; failed: number; results: any[] }> {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const proctorData of proctorList) {
      try {
        const result = await this.registerProctor(proctorData);
        results.push({ success: true, proctor: result.proctor });
        successCount++;
      } catch (error) {
        results.push({ success: false, error: error.message, data: proctorData });
        failedCount++;
      }
    }

    this.logger.info(`📊 Bulk proctor registration: ${successCount} success, ${failedCount} failed`);
    return { success: successCount, failed: failedCount, results };
  }

  /**
   * Generate secure proctor credentials
   * REQ-034: Auto-credential generator with secure email token delivery
   */
  private generateProctorCredentials(proctorId: string): ProctorCredentials {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    const token = jwt.sign(
      { 
        proctorId, 
        type: 'proctor_access',
        iat: Math.floor(Date.now() / 1000)
      },
      this.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return { proctorId, token, expiresAt };
  }

  /**
   * Send magic link email to proctor
   * REQ-034: Automated Magic Link credential delivery
   */
  private async sendMagicLinkEmail(proctor: Proctor, credentials: ProctorCredentials): Promise<void> {
    try {
      const magicLink = `http://localhost:3010/login?token=${credentials.token}`;
      
      // In a real implementation, integrate with email service
      // For now, log the magic link
      this.logger.info(`📧 Magic Link for ${proctor.email}: ${magicLink}`);
      
      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      /*
      await emailService.send({
        to: proctor.email,
        subject: 'Your Phase 7 Proctor Access',
        template: 'proctor-credentials',
        data: {
          name: proctor.name,
          magicLink,
          expiresAt: credentials.expiresAt
        }
      });
      */

    } catch (error) {
      this.logger.error('Failed to send magic link email:', error);
      // Don't throw - proctor is still created, just email failed
    }
  }

  /**
   * Proctor login and status update
   */
  async proctorLogin(token: string): Promise<Proctor | null> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      const proctorId = decoded.proctorId;

      const proctor = await this.getProctor(proctorId);
      if (!proctor) {
        return null;
      }

      // Update status to ACTIVE and last active time
      await this.updateProctorStatus(proctorId, 'ACTIVE');
      
      this.logger.info(`🟢 Proctor logged in: ${proctor.name} (${proctorId})`);
      return proctor;

    } catch (error) {
      this.logger.error('Proctor login failed:', error);
      return null;
    }
  }

  /**
   * Update proctor status
   */
  async updateProctorStatus(proctorId: string, status: Proctor['status']): Promise<void> {
    try {
      await this.db.query(`
        UPDATE p7_proctors 
        SET status = $1, last_active_at = NOW() 
        WHERE proctor_id = $2
      `, [status, proctorId]);

      // Update Redis cache
      const cacheKey = `proctor:${proctorId}`;
      const cachedProctor = await this.redis.get(cacheKey);
      if (cachedProctor) {
        const proctor = JSON.parse(cachedProctor);
        proctor.status = status;
        proctor.lastActiveAt = new Date();
        await this.redis.setex(cacheKey, 3600, JSON.stringify(proctor));
      }

      this.logger.info(`📊 Proctor ${proctorId} status updated to: ${status}`);

    } catch (error) {
      this.logger.error('Failed to update proctor status:', error);
      throw error;
    }
  }

  /**
   * Get proctor by ID
   */
  async getProctor(proctorId: string): Promise<Proctor | null> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(`proctor:${proctorId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to database
      const result = await this.db.query(`
        SELECT * FROM p7_proctors WHERE proctor_id = $1
      `, [proctorId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const proctor: Proctor = {
        proctorId: row.proctor_id,
        tenantId: row.tenant_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        credentials: row.credentials,
        status: row.status,
        currentLoad: row.current_load,
        maxCapacity: row.max_capacity,
        assignedSessions: row.assigned_sessions || [],
        efficiency: row.efficiency,
        createdAt: row.created_at,
        lastActiveAt: row.last_active_at
      };

      // Cache for future requests
      await this.redis.setex(`proctor:${proctorId}`, 3600, JSON.stringify(proctor));

      return proctor;

    } catch (error) {
      this.logger.error('Failed to get proctor:', error);
      return null;
    }
  }

  /**
   * Get active proctors for a tenant
   */
  async getActiveProctors(tenantId: string): Promise<Proctor[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM p7_proctors 
        WHERE tenant_id = $1 AND status IN ('ACTIVE', 'BUSY')
        ORDER BY current_load ASC, efficiency->>'avgApprovalTime' ASC
      `, [tenantId]);

      return result.rows.map(row => ({
        proctorId: row.proctor_id,
        tenantId: row.tenant_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        credentials: row.credentials,
        status: row.status,
        currentLoad: row.current_load,
        maxCapacity: row.max_capacity,
        assignedSessions: row.assigned_sessions || [],
        efficiency: row.efficiency,
        createdAt: row.created_at,
        lastActiveAt: row.last_active_at
      }));

    } catch (error) {
      this.logger.error('Failed to get active proctors:', error);
      return [];
    }
  }

  /**
   * Update proctor efficiency metrics
   * REQ-039: Efficiency ticker showing personal average approval time and throughput
   * REQ-041: Proctor efficiency ranking identifying "Super Proctors" vs "Slow Proctors"
   */
  async updateProctorEfficiency(proctorId: string, metrics: {
    approvalTime?: number;
    sessionsCompleted?: number;
    accuracy?: number;
  }): Promise<void> {
    try {
      const proctor = await this.getProctor(proctorId);
      if (!proctor) return;

      const efficiency = proctor.efficiency;

      // Update metrics
      if (metrics.approvalTime !== undefined) {
        efficiency.avgApprovalTime = (efficiency.avgApprovalTime + metrics.approvalTime) / 2;
      }

      if (metrics.sessionsCompleted !== undefined) {
        efficiency.throughput += metrics.sessionsCompleted;
      }

      if (metrics.accuracy !== undefined) {
        efficiency.accuracy = (efficiency.accuracy + metrics.accuracy) / 2;
      }

      // Calculate rank based on performance
      efficiency.rank = this.calculateProctorRank(efficiency);

      await this.db.query(`
        UPDATE p7_proctors SET efficiency = $1 WHERE proctor_id = $2
      `, [JSON.stringify(efficiency), proctorId]);

      this.logger.info(`📊 Proctor ${proctorId} efficiency updated: ${efficiency.rank}`);

    } catch (error) {
      this.logger.error('Failed to update proctor efficiency:', error);
    }
  }

  /**
   * Calculate proctor rank based on efficiency metrics
   */
  private calculateProctorRank(efficiency: Proctor['efficiency']): Proctor['efficiency']['rank'] {
    const { avgApprovalTime, throughput, accuracy } = efficiency;

    // Super Proctor: Fast approval (< 30s), high throughput (> 50), high accuracy (> 95%)
    if (avgApprovalTime < 30 && throughput > 50 && accuracy > 95) {
      return 'SUPER_PROCTOR';
    }

    // Slow Proctor: Slow approval (> 120s), low throughput (< 20), low accuracy (< 80%)
    if (avgApprovalTime > 120 || throughput < 20 || accuracy < 80) {
      return 'SLOW_PROCTOR';
    }

    return 'REGULAR';
  }

  /**
   * Global "Readiness" dashboard data
   * REQ-032: Global "Readiness" dashboard showing proctor login status vs scheduled candidates
   */
  async getReadinessDashboard(tenantId: string): Promise<{
    totalProctors: number;
    activeProctors: number;
    scheduledCandidates: number;
    capacity: number;
    readinessPercentage: number;
    proctors: Array<{
      proctorId: string;
      name: string;
      status: string;
      currentLoad: number;
      maxCapacity: number;
      efficiency: Proctor['efficiency']['rank'];
    }>;
  }> {
    try {
      const proctors = await this.db.query(`
        SELECT proctor_id, name, status, current_load, max_capacity, efficiency
        FROM p7_proctors WHERE tenant_id = $1
      `, [tenantId]);

      const scheduledCandidates = await this.db.query(`
        SELECT COUNT(*) as count FROM p7_sessions 
        WHERE tenant_id = $1 AND status IN ('PENDING', 'PENDING_APPROVAL', 'WAITING_ROOM')
      `, [tenantId]);

      const totalProctors = proctors.rows.length;
      const activeProctors = proctors.rows.filter(p => p.status === 'ACTIVE').length;
      const totalCapacity = proctors.rows.reduce((sum, p) => sum + (p.max_capacity || 15), 0);
      const scheduledCount = parseInt(scheduledCandidates.rows[0].count);

      const readinessPercentage = totalCapacity > 0 ? Math.min((totalCapacity / scheduledCount) * 100, 100) : 0;

      return {
        totalProctors,
        activeProctors,
        scheduledCandidates: scheduledCount,
        capacity: totalCapacity,
        readinessPercentage,
        proctors: proctors.rows.map(row => ({
          proctorId: row.proctor_id,
          name: row.name,
          status: row.status,
          currentLoad: row.current_load,
          maxCapacity: row.max_capacity,
          efficiency: row.efficiency?.rank || 'REGULAR'
        }))
      };

    } catch (error) {
      this.logger.error('Failed to get readiness dashboard:', error);
      throw error;
    }
  }

  /**
   * "No-Show" alert system
   * REQ-030: "No-Show" alert system 15 minutes before exam start
   */
  async checkNoShowAlerts(tenantId: string): Promise<Array<{
    sessionId: string;
    candidateName: string;
    examTitle: string;
    scheduledTime: Date;
    minutesUntilStart: number;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT session_id, metadata
        FROM p7_sessions 
        WHERE tenant_id = $1 
        AND status IN ('PENDING_APPROVAL', 'WAITING_ROOM')
        AND created_at <= NOW() - INTERVAL '15 minutes'
      `, [tenantId]);

      return result.rows.map(row => {
        const metadata = row.metadata;
        return {
          sessionId: row.session_id,
          candidateName: metadata.candidateName,
          examTitle: metadata.examTitle,
          scheduledTime: new Date(row.created_at),
          minutesUntilStart: 15
        };
      });

    } catch (error) {
      this.logger.error('Failed to check no-show alerts:', error);
      return [];
    }
  }
}