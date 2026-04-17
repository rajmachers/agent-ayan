import { EventEmitter } from 'events';
import { Agent } from './Agent';
import { SessionData, AgentStatus } from '../types';
import { executeQuery } from '../utils/database';
import { cache } from '../utils/redis';
import { logger } from '../utils/logger';

export interface AgentManagerEvents {
  agentStarted: (agentId: string, sessionId: string) => void;
  agentStopped: (agentId: string, sessionId: string) => void;
  agentError: (agentId: string, error: Error) => void;
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private sessionToAgent: Map<string, string> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.startCleanupProcess();
  }

  private startCleanupProcess() {
    // Clean up stale agents every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleAgents();
    }, 5 * 60 * 1000);
  }

  private async cleanupStaleAgents() {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [agentId, agent] of this.agents.entries()) {
      const status = agent.getStatus();
      const lastHeartbeat = new Date(status.last_heartbeat).getTime();

      if (now - lastHeartbeat > staleThreshold) {
        logger.warn('Cleaning up stale agent', {
          agentId,
          sessionId: status.session_id,
          lastHeartbeat: status.last_heartbeat,
        });

        try {
          await this.stopAgent(status.session_id, 'Stale agent cleanup');
        } catch (error) {
          logger.error('Failed to cleanup stale agent', {
            agentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  async startAgent(sessionId: string): Promise<string> {
    // Check if agent already exists for this session
    const existingAgentId = this.sessionToAgent.get(sessionId);
    if (existingAgentId) {
      const existingAgent = this.agents.get(existingAgentId);
      if (existingAgent && existingAgent.isActive()) {
        logger.info('Agent already active for session', {
          sessionId,
          agentId: existingAgentId,
        });
        return existingAgentId;
      }
      
      // Clean up inactive agent
      await this.removeAgent(existingAgentId);
    }

    // Get session data from database
    const sessionData = await this.getSessionData(sessionId);
    if (!sessionData) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Create and start new agent
    const agent = new Agent(sessionData);
    const agentId = agent.getId();

    // Set up event handlers
    agent.on('statusChanged', (status: AgentStatus) => {
      this.handleAgentStatusChange(agentId, status);
    });

    agent.on('violationDetected', (violation) => {
      logger.info('Violation detected by agent', {
        agentId,
        sessionId,
        violationCode: violation.code,
        violationType: violation.type,
      });
    });

    agent.on('error', (error: Error) => {
      logger.error('Agent error', {
        agentId,
        sessionId,
        error: error.message,
      });
      this.emit('agentError', agentId, error);
      
      // Auto-restart agent if it fails
      this.handleAgentRestart(sessionId, error);
    });

    // Store agent
    this.agents.set(agentId, agent);
    this.sessionToAgent.set(sessionId, agentId);

    try {
      // Start the agent
      await agent.start();
      
      // Store agent info in database
      await this.storeAgentInfo(agentId, sessionData);
      
      this.emit('agentStarted', agentId, sessionId);
      
      logger.info('Agent started successfully', {
        agentId,
        sessionId,
        roomId: sessionData.room_id,
      });
      
      return agentId;
    } catch (error) {
      // Clean up on failure
      await this.removeAgent(agentId);
      throw error;
    }
  }

  async stopAgent(sessionId: string, reason?: string): Promise<void> {
    const agentId = this.sessionToAgent.get(sessionId);
    if (!agentId) {
      logger.warn('No agent found for session', { sessionId });
      return;
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn('Agent not found in manager', { agentId, sessionId });
      this.sessionToAgent.delete(sessionId);
      return;
    }

    try {
      await agent.stop();
      
      logger.info('Agent stopped', {
        agentId,
        sessionId,
        reason: reason || 'Manual stop',
      });
    } catch (error) {
      logger.error('Error stopping agent', {
        agentId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await this.removeAgent(agentId);
      this.emit('agentStopped', agentId, sessionId);
    }
  }

  private async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      const sessionId = agent.getSessionData().id;
      this.sessionToAgent.delete(sessionId);
      
      // Clean up cache
      await cache.del(cache.agentKey(agentId, 'status'));
      await cache.del(cache.agentKey(agentId, 'metrics'));
    }
    
    this.agents.delete(agentId);
  }

  private async handleAgentStatusChange(agentId: string, status: AgentStatus) {
    logger.debug('Agent status changed', {
      agentId,
      sessionId: status.session_id,
      status: status.status,
    });

    // Update agent status in database
    try {
      await executeQuery(
        `INSERT INTO agent_status (agent_id, session_id, status, metrics, updated_at) 
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (agent_id) DO UPDATE SET 
         status = $3, metrics = $4, updated_at = NOW()`,
        [
          agentId,
          status.session_id,
          status.status,
          JSON.stringify(status.metrics),
        ]
      );
    } catch (error) {
      logger.error('Failed to update agent status in database', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleAgentRestart(sessionId: string, error: Error): Promise<void> {
    const maxRestarts = 3;
    const restartKey = cache.sessionKey(sessionId, 'restart_count');
    
    try {
      const restartCount = parseInt(await cache.get(restartKey) || '0');
      
      if (restartCount >= maxRestarts) {
        logger.error('Max restart attempts reached for session', {
          sessionId,
          restartCount,
          error: error.message,
        });
        return;
      }

      logger.info('Attempting to restart failed agent', {
        sessionId,
        restartCount: restartCount + 1,
        maxRestarts,
      });

      // Increment restart count with 1 hour expiry
      await cache.set(restartKey, (restartCount + 1).toString(), 3600);

      // Wait a bit before restart
      setTimeout(async () => {
        try {
          await this.startAgent(sessionId);
          logger.info('Agent restarted successfully', { sessionId });
        } catch (restartError) {
          logger.error('Failed to restart agent', {
            sessionId,
            error: restartError instanceof Error ? restartError.message : 'Unknown error',
          });
        }
      }, 5000); // Wait 5 seconds
    } catch (cacheError) {
      logger.error('Failed to handle agent restart', {
        sessionId,
        error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
      });
    }
  }

  private async getSessionData(sessionId: string): Promise<SessionData | null> {
    try {
      const result = await executeQuery(
        `SELECT 
          s.id, s.external_id, s.delivery_id, s.candidate_id, s.room_id, 
          s.status, s.credibility_score, s.risk_level, s.started_at, s.ended_at,
          e.id as exam_id, e.title as exam_title, e.duration_min, 
          e.addons_config, e.metrics_config, e.rules_config, e.org_id
        FROM sessions s
        JOIN deliveries d ON s.delivery_id = d.id
        JOIN batches b ON d.batch_id = b.id
        JOIN exams e ON b.exam_id = e.id
        WHERE s.id = $1`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        external_id: row.external_id,
        delivery_id: row.delivery_id,
        candidate_id: row.candidate_id,
        room_id: row.room_id,
        status: row.status,
        credibility_score: row.credibility_score,
        risk_level: row.risk_level,
        started_at: row.started_at,
        ended_at: row.ended_at,
        exam: {
          id: row.exam_id,
          title: row.exam_title,
          duration_min: row.duration_min,
          addons_config: row.addons_config,
          metrics_config: row.metrics_config,
          rules_config: row.rules_config,
        },
        org_id: row.org_id,
      };
    } catch (error) {
      logger.error('Failed to get session data', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private async storeAgentInfo(agentId: string, session: SessionData): Promise<void> {
    try {
      await executeQuery(
        `INSERT INTO agent_instances (
          id, session_id, room_id, started_at, capabilities
        ) VALUES ($1, $2, $3, NOW(), $4)`,
        [
          agentId,
          session.id,
          session.room_id,
          JSON.stringify({
            video_processing: session.exam?.addons_config.face_verify || false,
            audio_processing: true,
            screen_recording: session.exam?.addons_config.screen_record || false,
          }),
        ],
        session.org_id
      );
    } catch (error) {
      logger.error('Failed to store agent info', {
        agentId,
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  getAgent(sessionId: string): Agent | null {
    const agentId = this.sessionToAgent.get(sessionId);
    return agentId ? this.agents.get(agentId) || null : null;
  }

  getAgentById(agentId: string): Agent | null {
    return this.agents.get(agentId) || null;
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgentCount(): number {
    return Array.from(this.agents.values()).filter(agent => agent.isActive()).length;
  }

  async getAgentStatus(sessionId: string): Promise<AgentStatus | null> {
    const agent = this.getAgent(sessionId);
    return agent ? agent.getStatus() : null;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down agent manager', {
      activeAgents: this.agents.size,
    });

    // Stop cleanup process
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop all agents
    const stopPromises = Array.from(this.sessionToAgent.keys()).map(sessionId =>
      this.stopAgent(sessionId, 'Manager shutdown')
    );

    await Promise.all(stopPromises);

    logger.info('Agent manager shutdown complete');
  }
}