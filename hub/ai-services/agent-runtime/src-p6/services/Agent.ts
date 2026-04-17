import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LiveKitClient } from './LiveKitClient';
import { AIServiceClient } from './AIServiceClient';
import { WebhookClient } from './WebhookClient';
import { SessionData, ViolationData, AgentStatus, ProcessingFrame } from '../types';
import { executeQuery } from '../utils/database';
import { cache } from '../utils/redis';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface AgentEvents {
  statusChanged: (status: AgentStatus) => void;
  violationDetected: (violation: ViolationData) => void;
  sessionUpdated: (session: SessionData) => void;
  error: (error: Error) => void;
}

export class Agent extends EventEmitter {
  private id: string;
  private liveKitClient: LiveKitClient;
  private aiService: AIServiceClient;
  private webhookClient: WebhookClient;
  private status: AgentStatus;
  private frameProcessingQueue: ProcessingFrame[] = [];
  private isProcessingFrames = false;
  private metricsInterval?: NodeJS.Timeout;
  private startTime: Date;

  constructor(
    private sessionData: SessionData
  ) {
    super();
    
    this.id = uuidv4();
    this.startTime = new Date();
    
    // Initialize status
    this.status = {
      id: this.id,
      session_id: sessionData.id,
      room_id: sessionData.room_id,
      status: 'connecting',
      last_heartbeat: new Date(),
      capabilities: {
        video_processing: sessionData.exam?.addons_config.face_verify || false,
        audio_processing: true,
        screen_recording: sessionData.exam?.addons_config.screen_record || false,
      },
      metrics: {
        frames_processed: 0,
        violations_detected: 0,
        uptime_seconds: 0,
      },
    };
    
    // Initialize clients
    this.liveKitClient = new LiveKitClient(
      sessionData.id,
      sessionData.room_id,
      this.id
    );
    
    this.aiService = new AIServiceClient();
    this.webhookClient = new WebhookClient();
    
    this.setupEventHandlers();
    this.startMetricsCollection();
  }

  private setupEventHandlers() {
    // LiveKit event handlers
    this.liveKitClient.on('connected', () => {
      this.updateStatus('connected');
      this.notifySessionStarted();
    });

    this.liveKitClient.on('disconnected', (reason) => {
      this.updateStatus('disconnected');
      logger.warn('LiveKit disconnected', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        reason,
      });
    });

    this.liveKitClient.on('videoFrame', (frame, participant, track) => {
      if (this.status.capabilities.video_processing) {
        this.queueFrameForProcessing({
          data: frame,
          width: 640, // Would get from track metadata
          height: 480,
          timestamp: Date.now(),
          session_id: this.sessionData.id,
          source: track.source?.toString().includes('screen') ? 'screen' : 'camera',
        });
      }
    });

    this.liveKitClient.on('audioData', (data, participant, track) => {
      if (this.status.capabilities.audio_processing) {
        this.processAudioData(data, participant.identity);
      }
    });

    this.liveKitClient.on('error', (error) => {
      this.updateStatus('error');
      this.emit('error', error);
    });

    // AI Service event handlers
    this.aiService.on('violationDetected', (violations) => {
      this.handleViolations(violations);
    });

    this.aiService.on('error', (error) => {
      logger.error('AI service error', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        error: error.message,
      });
    });
  }

  private queueFrameForProcessing(frame: ProcessingFrame) {
    // Limit queue size to prevent memory issues
    if (this.frameProcessingQueue.length > 10) {
      this.frameProcessingQueue.shift(); // Remove oldest frame
    }
    
    this.frameProcessingQueue.push(frame);
    
    if (!this.isProcessingFrames) {
      this.processFrameQueue();
    }
  }

  private async processFrameQueue() {
    this.isProcessingFrames = true;
    
    while (this.frameProcessingQueue.length > 0) {
      const frame = this.frameProcessingQueue.shift();
      if (!frame) continue;
      
      try {
        await this.processFrame(frame);
        this.status.metrics.frames_processed++;
      } catch (error) {
        logger.error('Frame processing error', {
          agentId: this.id,
          sessionId: this.sessionData.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    this.isProcessingFrames = false;
  }

  private async processFrame(frame: ProcessingFrame) {
    try {
      // Send frame to AI service for analysis
      const violations = await this.aiService.analyzeFrame(frame);
      
      if (violations.length > 0) {
        await this.handleViolations(violations);
      }
    } catch (error) {
      logger.error('Failed to process frame', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        frameTimestamp: frame.timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async processAudioData(data: Buffer, participantId: string) {
    try {
      // Send audio data to AI service for analysis
      const violations = await this.aiService.analyzeAudio(data, {
        sessionId: this.sessionData.id,
        participantId,
        timestamp: Date.now(),
      });
      
      if (violations.length > 0) {
        await this.handleViolations(violations);
      }
    } catch (error) {
      logger.error('Failed to process audio', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        participantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleViolations(violations: ViolationData[]) {
    for (const violation of violations) {
      try {
        // Store violation in database
        await executeQuery(
          `INSERT INTO violations (
            session_id, code, type, severity, confidence, weight, metadata, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id`,
          [
            violation.session_id,
            violation.code,
            violation.type,
            violation.severity,
            violation.confidence,
            violation.weight,
            JSON.stringify(violation.metadata),
            violation.timestamp,
          ],
          this.sessionData.org_id
        );

        // Update metrics
        this.status.metrics.violations_detected++;

        // Cache violation for real-time access
        await cache.setJSON(
          cache.sessionKey(this.sessionData.id, `violation:${Date.now()}`),
          violation,
          3600 // 1 hour
        );

        // Notify via webhook
        await this.webhookClient.sendViolationEvent({
          event: 'violation_detected',
          session_id: this.sessionData.id,
          agent_id: this.id,
          timestamp: Date.now(),
          data: violation,
        });

        // Emit event
        this.emit('violationDetected', violation);

        logger.info('Violation detected and processed', {
          agentId: this.id,
          sessionId: this.sessionData.id,
          violationCode: violation.code,
          violationType: violation.type,
          severity: violation.severity,
          confidence: violation.confidence,
        });
      } catch (error) {
        logger.error('Failed to process violation', {
          agentId: this.id,
          sessionId: this.sessionData.id,
          violationCode: violation.code,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private updateStatus(status: AgentStatus['status']) {
    this.status.status = status;
    this.status.last_heartbeat = new Date();
    
    if (status === 'connected' && !this.status.connected_at) {
      this.status.connected_at = new Date();
    }
    
    // Cache status for API access
    cache.setJSON(
      cache.agentKey(this.id, 'status'),
      this.status,
      300 // 5 minutes
    );
    
    this.emit('statusChanged', this.status);
  }

  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      // Update uptime
      this.status.metrics.uptime_seconds = Math.floor(
        (Date.now() - this.startTime.getTime()) / 1000
      );
      
      // Update heartbeat
      this.status.last_heartbeat = new Date();
      
      // Cache updated metrics
      cache.setJSON(
        cache.agentKey(this.id, 'metrics'),
        this.status.metrics,
        60 // 1 minute
      );
      
      logger.debug('Agent metrics updated', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        metrics: this.status.metrics,
      });
    }, 30000); // Update every 30 seconds
  }

  private async notifySessionStarted() {
    try {
      // Update session status to active
      await executeQuery(
        'UPDATE sessions SET status = $1, started_at = NOW() WHERE id = $2',
        ['active', this.sessionData.id],
        this.sessionData.org_id
      );

      // Send webhook notification
      await this.webhookClient.sendSessionEvent({
        event: 'session_started',
        session_id: this.sessionData.id,
        agent_id: this.id,
        timestamp: Date.now(),
        data: {
          room_id: this.sessionData.room_id,
          capabilities: this.status.capabilities,
        },
      });

      logger.info('Session started notification sent', {
        agentId: this.id,
        sessionId: this.sessionData.id,
      });
    } catch (error) {
      logger.error('Failed to notify session started', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async start(): Promise<void> {
    logger.info('Starting agent', {
      agentId: this.id,
      sessionId: this.sessionData.id,
      roomId: this.sessionData.room_id,
    });
    
    try {
      // Connect to LiveKit room
      await this.liveKitClient.connect();
      
      logger.info('Agent started successfully', {
        agentId: this.id,
        sessionId: this.sessionData.id,
      });
    } catch (error) {
      logger.error('Failed to start agent', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.updateStatus('error');
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping agent', {
      agentId: this.id,
      sessionId: this.sessionData.id,
    });
    
    try {
      // Clear intervals
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      // Disconnect from LiveKit
      await this.liveKitClient.disconnect();
      
      // Update session status
      await executeQuery(
        'UPDATE sessions SET status = $1, ended_at = NOW() WHERE id = $2',
        ['completed', this.sessionData.id],
        this.sessionData.org_id
      );
      
      // Send final webhook
      await this.webhookClient.sendSessionEvent({
        event: 'session_ended',
        session_id: this.sessionData.id,
        agent_id: this.id,
        timestamp: Date.now(),
        data: {
          final_metrics: this.status.metrics,
        },
      });
      
      this.updateStatus('disconnected');
      
      logger.info('Agent stopped successfully', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        finalMetrics: this.status.metrics,
      });
    } catch (error) {
      logger.error('Error stopping agent', {
        agentId: this.id,
        sessionId: this.sessionData.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  getId(): string {
    return this.id;
  }

  getStatus(): AgentStatus {
    return { ...this.status };
  }

  getSessionData(): SessionData {
    return this.sessionData;
  }

  isActive(): boolean {
    return this.status.status === 'connected';
  }
}