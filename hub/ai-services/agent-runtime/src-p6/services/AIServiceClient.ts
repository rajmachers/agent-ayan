import { EventEmitter } from 'events';
import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { ProcessingFrame, ViolationData, AIServiceResponse } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface AIServiceEvents {
  violationDetected: (violations: ViolationData[]) => void;
  error: (error: Error) => void;
}

export class AIServiceClient extends EventEmitter {
  private readonly visionServiceUrl: string;
  private readonly audioServiceUrl: string;
  private readonly behaviorServiceUrl: string;

  constructor() {
    super();
    
    // These would be configurable in production
    this.visionServiceUrl = 'http://localhost:3005'; // ai-vision service
    this.audioServiceUrl = 'http://localhost:3006'; // ai-audio service  
    this.behaviorServiceUrl = 'http://localhost:3007'; // ai-behavior service
  }

  async analyzeFrame(frame: ProcessingFrame): Promise<ViolationData[]> {
    const violations: ViolationData[] = [];
    
    try {
      // Analyze frame with vision AI
      const visionViolations = await this.processVisionFrame(frame);
      violations.push(...visionViolations);
      
      // Analyze behavior patterns if we have enough historical data
      const behaviorViolations = await this.processBehaviorAnalysis(frame);
      violations.push(...behaviorViolations);
      
      return violations;
    } catch (error) {
      logger.error('Frame analysis failed', {
        sessionId: frame.session_id,
        frameTimestamp: frame.timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.emit('error', error instanceof Error ? error : new Error('Frame analysis failed'));
      return [];
    }
  }

  async analyzeAudio(
    audioData: Buffer, 
    metadata: { sessionId: string; participantId: string; timestamp: number }
  ): Promise<ViolationData[]> {
    try {
      const formData = new FormData();
      formData.append('audio', audioData, {
        filename: `audio_${metadata.timestamp}.wav`,
        contentType: 'audio/wav',
      });
      formData.append('session_id', metadata.sessionId);
      formData.append('participant_id', metadata.participantId);
      formData.append('timestamp', metadata.timestamp.toString());

      const response: AxiosResponse<AIServiceResponse> = await axios.post(
        `${this.audioServiceUrl}/analyze`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data',
          },
          timeout: config.agent.aiServiceTimeout,
        }
      );

      return this.transformAIViolations(response.data.violations, metadata.sessionId);
    } catch (error) {
      logger.error('Audio analysis failed', {
        sessionId: metadata.sessionId,
        participantId: metadata.participantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.emit('error', error instanceof Error ? error : new Error('Audio analysis failed'));
      return [];
    }
  }

  private async processVisionFrame(frame: ProcessingFrame): Promise<ViolationData[]> {
    try {
      const formData = new FormData();
      formData.append('image', frame.data, {
        filename: `frame_${frame.timestamp}.jpg`,
        contentType: 'image/jpeg',
      });
      formData.append('session_id', frame.session_id);
      formData.append('source', frame.source);
      formData.append('timestamp', frame.timestamp.toString());
      formData.append('width', frame.width.toString());
      formData.append('height', frame.height.toString());

      const response: AxiosResponse<AIServiceResponse> = await axios.post(
        `${this.visionServiceUrl}/analyze`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data',
          },
          timeout: config.agent.aiServiceTimeout,
        }
      );

      logger.debug('Vision AI analysis completed', {
        sessionId: frame.session_id,
        frameTimestamp: frame.timestamp,
        violationsCount: response.data.violations.length,
        processingTime: response.data.processing_time_ms,
      });

      return this.transformAIViolations(response.data.violations, frame.session_id);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.warn('Vision AI service unavailable', {
            sessionId: frame.session_id,
            service: this.visionServiceUrl,
          });
          return [];
        }
        
        logger.error('Vision AI service error', {
          sessionId: frame.session_id,
          status: error.response?.status,
          message: error.message,
        });
      } else {
        logger.error('Vision analysis error', {
          sessionId: frame.session_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      
      return [];
    }
  }

  private async processBehaviorAnalysis(frame: ProcessingFrame): Promise<ViolationData[]> {
    try {
      const response: AxiosResponse<AIServiceResponse> = await axios.post(
        `${this.behaviorServiceUrl}/analyze`,
        {
          session_id: frame.session_id,
          timestamp: frame.timestamp,
          frame_data: {
            width: frame.width,
            height: frame.height,
            source: frame.source,
          },
        },
        {
          timeout: config.agent.aiServiceTimeout,
        }
      );

      return this.transformAIViolations(response.data.violations, frame.session_id);
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        logger.debug('Behavior AI service unavailable', {
          sessionId: frame.session_id,
        });
        return [];
      }
      
      logger.debug('Behavior analysis failed', {
        sessionId: frame.session_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return [];
    }
  }

  private transformAIViolations(
    aiViolations: AIServiceResponse['violations'],
    sessionId: string
  ): ViolationData[] {
    return aiViolations.map(violation => ({
      session_id: sessionId,
      code: violation.code,
      type: violation.type as ViolationData['type'],
      severity: violation.severity,
      confidence: violation.confidence,
      weight: this.getViolationWeight(violation.code),
      metadata: violation.metadata,
      timestamp: new Date(),
    }));
  }

  private getViolationWeight(code: string): number {
    // Map violation codes to weights - these would come from exam configuration
    const weights: Record<string, number> = {
      // Browser violations
      'b1': 0.3, // Tab switch
      'b2': 0.3, // Window blur
      'b3': 0.5, // Fullscreen exit
      
      // Camera violations  
      'c1': 1.0, // Webcam disabled
      'c2': 0.8, // Face invisible
      'c3': 1.0, // Multiple faces
      'c4': 0.6, // Face covered
      'c5': 0.5, // Looking away
      
      // Audio violations
      'a1': 0.8, // Multiple speakers
      'a2': 0.4, // Background noise
      'a3': 0.6, // Mic muted
      
      // Screen violations
      's1': 0.9, // External display
      's2': 0.7, // Copy/paste
      's3': 0.8, // Screenshot
      
      // Hardware violations
      'h1': 0.9, // Phone detected
      'h2': 0.7, // Earphones
      'h3': 0.6, // Books/notes
    };
    
    return weights[code] || 0.5; // Default weight
  }

  async getServiceHealth(): Promise<{
    vision: boolean;
    audio: boolean;
    behavior: boolean;
  }> {
    const healthChecks = await Promise.allSettled([
      axios.get(`${this.visionServiceUrl}/health`, { timeout: 5000 }),
      axios.get(`${this.audioServiceUrl}/health`, { timeout: 5000 }),
      axios.get(`${this.behaviorServiceUrl}/health`, { timeout: 5000 }),
    ]);

    return {
      vision: healthChecks[0].status === 'fulfilled',
      audio: healthChecks[1].status === 'fulfilled',
      behavior: healthChecks[2].status === 'fulfilled',
    };
  }
}