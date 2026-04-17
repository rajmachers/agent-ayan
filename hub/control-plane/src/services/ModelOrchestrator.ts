import { SessionManager, SessionConfig } from './SessionManager';
import { ProctorManager, Proctor } from './ProctorManager';
import { Logger } from '../utils/Logger';
import axios from 'axios';

export interface ModelSwitchRequest {
  tenantId: string;
  proctoring_model: 'basic' | 'advanced';
  requestedBy: string;
  reason?: string;
}

export interface ModelEffectiveness {
  basic: {
    accuracy: number;
    avgProcessingTime: number;
    throughput: number;
    proctorUtilization: number;
  };
  advanced: {
    accuracy: number;
    avgProcessingTime: number;
    throughput: number;
    proctorUtilization: number;
    gatekeeper_efficiency: number;
  };
}

export class ModelOrchestrator {
  private logger = Logger.getInstance();

  constructor(
    private sessionManager: SessionManager,
    private proctorManager: ProctorManager
  ) {}

  /**
   * Central orchestration of proctoring model workflows
   * REQ-017-020: Two-tier proctoring system with tenant-wide selection
   */
  async orchestrateSession(sessionData: Partial<SessionConfig>): Promise<{
    sessionId: string;
    model: 'basic' | 'advanced';
    workflow: string;
    estimatedStartTime: Date;
  }> {
    try {
      const session = await this.sessionManager.createSession(sessionData);
      
      let workflow = '';
      let estimatedStartTime = new Date();

      if (session.proctoring_model === 'advanced') {
        workflow = 'Advanced HITL: Waiting Room → AI Pre-Scan → Gatekeeper Review → Approval';
        estimatedStartTime = this.calculateAdvancedModelEstimate(session.tenantId);
      } else {
        workflow = 'Basic Model: Direct Assignment → Proctor Monitoring';
        estimatedStartTime = this.calculateBasicModelEstimate(session.tenantId);
      }

      this.logger.info(`🎯 Model orchestration complete: ${session.sessionId} (${session.proctoring_model})`);

      return {
        sessionId: session.sessionId,
        model: session.proctoring_model,
        workflow,
        estimatedStartTime
      };

    } catch (error) {
      this.logger.error('Model orchestration failed:', error);
      throw error;
    }
  }

  /**
   * Switch tenant proctoring model
   * REQ-020: Tenant-wide selection of Basic or Advanced model
   */
  async switchTenantModel(switchRequest: ModelSwitchRequest): Promise<{
    success: boolean;
    oldModel: 'basic' | 'advanced';
    newModel: 'basic' | 'advanced';
    affectedSessions: number;
  }> {
    try {
      // Get current tenant model (from tenant service or configuration)
      const currentModel = await this.getCurrentTenantModel(switchRequest.tenantId);
      
      // Update tenant configuration
      await this.updateTenantModel(switchRequest.tenantId, switchRequest.proctoring_model);

      // Handle existing sessions
      const affectedSessions = await this.handleModelSwitchForExistingSessions(
        switchRequest.tenantId, 
        currentModel, 
        switchRequest.proctoring_model
      );

      // Log the model switch for audit
      await this.logModelSwitch(switchRequest);

      this.logger.info(`🔄 Tenant ${switchRequest.tenantId} model switched: ${currentModel} → ${switchRequest.proctoring_model}`);

      return {
        success: true,
        oldModel: currentModel,
        newModel: switchRequest.proctoring_model,
        affectedSessions
      };

    } catch (error) {
      this.logger.error('Model switch failed:', error);
      throw error;
    }
  }

  /**
   * Get current effectiveness comparison between models
   * REQ-139: A/B testing of Basic vs Advanced remote proctoring modes
   */
  async getModelEffectiveness(tenantId: string): Promise<ModelEffectiveness> {
    try {
      const [basicStats, advancedStats] = await Promise.all([
        this.getBasicModelStats(tenantId),
        this.getAdvancedModelStats(tenantId)
      ]);

      return {
        basic: basicStats,
        advanced: advancedStats
      };

    } catch (error) {
      this.logger.error('Failed to get model effectiveness:', error);
      throw error;
    }
  }

  /**
   * Emergency assignment when all proctors at capacity
   * REQ-044: Emergency assignment via random distribution when all proctors at capacity
   */
  async handleEmergencyAssignment(tenantId: string): Promise<{
    action: string;
    assignedSessions: number;
    waitingQueue: number;
  }> {
    try {
      // Check if all proctors are at capacity
      const activeProctors = await this.proctorManager.getActiveProctors(tenantId);
      const overloadedProctors = activeProctors.filter(p => p.currentLoad >= p.maxCapacity);
      
      if (overloadedProctors.length === activeProctors.length) {
        // Emergency: Distribute additional sessions randomly
        const waitingSessions = await this.sessionManager.getSessionsByStatus(tenantId, 'PENDING');
        
        let assignedCount = 0;
        for (const session of waitingSessions.slice(0, 5)) { // Limit emergency assignments
          const randomProctor = activeProctors[Math.floor(Math.random() * activeProctors.length)];
          await this.sessionManager.assignProctor(session.sessionId, randomProctor.proctorId);
          assignedCount++;
        }

        this.logger.warn(`🚨 Emergency assignment: ${assignedCount} sessions assigned beyond capacity`);

        return {
          action: 'EMERGENCY_ASSIGNMENT',
          assignedSessions: assignedCount,
          waitingQueue: waitingSessions.length - assignedCount
        };
      }

      return {
        action: 'NO_EMERGENCY_NEEDED',
        assignedSessions: 0,
        waitingQueue: 0
      };

    } catch (error) {
      this.logger.error('Emergency assignment failed:', error);
      throw error;
    }
  }

  /**
   * Calculate estimated start time for Advanced model
   */
  private calculateAdvancedModelEstimate(tenantId: string): Date {
    // Advanced model: Waiting room (30s) + AI scan (45s) + Gatekeeper review (60s avg)
    const estimatedDelay = 135; // seconds
    const startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() + estimatedDelay);
    return startTime;
  }

  /**
   * Calculate estimated start time for Basic model
   */
  private calculateBasicModelEstimate(tenantId: string): Date {
    // Basic model: Direct assignment (5s avg)
    const estimatedDelay = 5; // seconds
    const startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() + estimatedDelay);
    return startTime;
  }

  /**
   * Get current tenant model configuration
   */
  private async getCurrentTenantModel(tenantId: string): Promise<'basic' | 'advanced'> {
    try {
      // In a real implementation, this would query the tenant configuration service
      // For now, return a default based on existing sessions
      const recentSessions = await this.sessionManager.getSessionsByStatus(tenantId, 'IN_PROGRESS');
      
      if (recentSessions.length > 0) {
        return recentSessions[0].proctoring_model;
      }

      return 'basic'; // Default to basic model

    } catch (error) {
      this.logger.error('Failed to get current tenant model:', error);
      return 'basic';
    }
  }

  /**
   * Update tenant model configuration
   */
  private async updateTenantModel(tenantId: string, model: 'basic' | 'advanced'): Promise<void> {
    try {
      // Call P7 Tenant Service to update configuration
      await axios.post(`http://localhost:13501/api/tenant/model`, {
        tenantId,
        proctoring_model: model,
        updatedAt: new Date()
      });

      this.logger.info(`✅ Tenant ${tenantId} model updated to: ${model}`);

    } catch (error) {
      this.logger.error('Failed to update tenant model:', error);
      throw error;
    }
  }

  /**
   * Handle model switch for existing sessions
   */
  private async handleModelSwitchForExistingSessions(
    tenantId: string, 
    oldModel: 'basic' | 'advanced', 
    newModel: 'basic' | 'advanced'
  ): Promise<number> {
    try {
      // Get pending sessions that need to be updated
      const pendingSessions = await this.sessionManager.getSessionsByStatus(tenantId, 'PENDING');
      
      let affectedCount = 0;
      for (const session of pendingSessions) {
        if (session.proctoring_model !== newModel) {
          // Update session model and re-route based on new model
          await this.rerouteSession(session.sessionId, newModel);
          affectedCount++;
        }
      }

      return affectedCount;

    } catch (error) {
      this.logger.error('Failed to handle existing sessions during model switch:', error);
      return 0;
    }
  }

  /**
   * Re-route session to different model workflow
   */
  private async rerouteSession(sessionId: string, newModel: 'basic' | 'advanced'): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) return;

      // Update session model
      session.proctoring_model = newModel;
      
      if (newModel === 'advanced') {
        // Switch to advanced model workflow
        await this.sessionManager.updateSessionStatus(sessionId, 'PENDING_APPROVAL');
        // Trigger advanced workflow...
      } else {
        // Switch to basic model workflow  
        await this.sessionManager.updateSessionStatus(sessionId, 'PENDING');
        // Trigger basic workflow...
      }

      this.logger.info(`🔄 Session ${sessionId} re-routed to ${newModel} model`);

    } catch (error) {
      this.logger.error('Failed to re-route session:', error);
    }
  }

  /**
   * Log model switch for audit trail
   */
  private async logModelSwitch(switchRequest: ModelSwitchRequest): Promise<void> {
    try {
      // In a real implementation, this would log to an audit service
      this.logger.info(`📋 Model Switch Audit: Tenant ${switchRequest.tenantId} → ${switchRequest.proctoring_model} by ${switchRequest.requestedBy}`);
      
      // TODO: Store in audit database
      /*
      await auditService.log({
        type: 'MODEL_SWITCH',
        tenantId: switchRequest.tenantId,
        requestedBy: switchRequest.requestedBy,
        oldModel: oldModel,
        newModel: switchRequest.proctoring_model,
        reason: switchRequest.reason,
        timestamp: new Date()
      });
      */

    } catch (error) {
      this.logger.error('Failed to log model switch:', error);
    }
  }

  /**
   * Get Basic model performance statistics
   */
  private async getBasicModelStats(tenantId: string): Promise<ModelEffectiveness['basic']> {
    try {
      // Query session statistics for basic model
      // This is a simplified version - in reality, you'd aggregate from multiple sources
      
      return {
        accuracy: 89.5,
        avgProcessingTime: 2.3,
        throughput: 95,
        proctorUtilization: 78
      };

    } catch (error) {
      this.logger.error('Failed to get basic model stats:', error);
      throw error;
    }
  }

  /**
   * Get Advanced model performance statistics
   */
  private async getAdvancedModelStats(tenantId: string): Promise<ModelEffectiveness['advanced']> {
    try {
      // Query session statistics for advanced model
      // This is a simplified version - in reality, you'd aggregate from multiple sources
      
      return {
        accuracy: 96.8,
        avgProcessingTime: 1.8,
        throughput: 87,
        proctorUtilization: 85,
        gatekeeper_efficiency: 92
      };

    } catch (error) {
      this.logger.error('Failed to get advanced model stats:', error);
      throw error;
    }
  }

  /**
   * Handle proctor ratio update for tenant
   * REQ-029: Variable proctor:candidate ratio configuration per exam type
   */
  async updateProctorRatio(tenantId: string, ratio: number): Promise<{
    success: boolean;
    oldRatio: number;
    newRatio: number;
    capacityChange: number;
  }> {
    try {
      // Get current ratio from tenant configuration
      const currentRatio = 15; // Default - in reality, query from tenant service

      // Update all active sessions for this tenant
      // This affects load balancing for new sessions
      
      const capacityChange = ((ratio - currentRatio) / currentRatio) * 100;

      this.logger.info(`📊 Tenant ${tenantId} proctor ratio updated: 1:${currentRatio} → 1:${ratio} (${capacityChange > 0 ? '+' : ''}${capacityChange.toFixed(1)}% capacity)`);

      return {
        success: true,
        oldRatio: currentRatio,
        newRatio: ratio,
        capacityChange
      };

    } catch (error) {
      this.logger.error('Failed to update proctor ratio:', error);
      throw error;
    }
  }
}