/**
 * AI Services Integration Layer
 * Handles communication with Vision, Audio, and Behavior AI services
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { extendedConfig as config } from '../config';
import { ServiceUnavailableError } from '../middleware/error-handler';

export interface AIAnalysisResult {
  violations: Violation[];
  confidence: number;
  processingTimeMs: number;
  metadata?: Record<string, any>;
}

export interface Violation {
  id: string;
  code: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  timestamp: number;
  duration?: number;
  evidence?: string[];
  aiService: string;
  metadata?: Record<string, any>;
}

export interface FrameAnalysisChunk {
  frameData: string; // Base64 encoded image
  timestamp: number;
  sessionId: string;
  participantId: string;
}

export interface AudioAnalysisChunk {
  audioData: string; // Base64 encoded audio
  timestamp: number;
  sessionId: string;
  participantId: string;
  sampleRate?: number;
}

class AIServiceClient {
  private client: AxiosInstance;
  private serviceName: string;
  private baseUrl: string;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor(serviceName: string, baseUrl: string) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: config.videoProcessingTimeout * 1000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Setup request/response interceptors
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`AI Service Request [${this.serviceName}]:`, {
          method: config.method,
          url: config.url,
          dataSize: config.data ? JSON.stringify(config.data).length : 0
        });
        return config;
      },
      (error) => {
        logger.error(`AI Service Request Error [${this.serviceName}]:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`AI Service Response [${this.serviceName}]:`, {
          status: response.status,
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        logger.error(`AI Service Error [${this.serviceName}]:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  async healthCheck(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached result if recent
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }

    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      this.isHealthy = response.status === 200;
      this.lastHealthCheck = now;
      return this.isHealthy;
    } catch (error) {
      logger.warn(`Health check failed for ${this.serviceName}:`, error);
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  async post<T = any>(endpoint: string, data: any): Promise<T> {
    if (!await this.healthCheck()) {
      throw new ServiceUnavailableError(`${this.serviceName} service is unavailable`);
    }

    try {
      const response = await this.client.post(endpoint, data);
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new ServiceUnavailableError(`${this.serviceName} service connection failed`);
      }
      throw error;
    }
  }

  get healthy(): boolean {
    return this.isHealthy;
  }
}

export class AIIntegrationService {
  private visionService: AIServiceClient;
  private audioService: AIServiceClient;
  private behaviorService: AIServiceClient;

  constructor() {
    this.visionService = new AIServiceClient('Vision AI', config.aiVisionUrl);
    this.audioService = new AIServiceClient('Audio AI', config.aiAudioUrl);
    this.behaviorService = new AIServiceClient('Behavior AI', config.aiBehaviorUrl);
  }

  async analyzeFrame(chunk: FrameAnalysisChunk): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Analyzing frame chunk:', {
        timestamp: chunk.timestamp,
        sessionId: chunk.sessionId
      });

      const response = await this.visionService.post('/analyze/frame', {
        image: chunk.frameData,
        session_id: chunk.sessionId,
        participant_id: chunk.participantId,
        timestamp: chunk.timestamp
      });

      const violations = this.mapVisionViolations(response.violations || [], 'ai-vision');
      
      return {
        violations,
        confidence: response.confidence || 0.8,
        processingTimeMs: Date.now() - startTime,
        metadata: {
          detections: response.detections,
          objectCount: response.objects?.length || 0,
          processingInfo: response.metadata
        }
      };
    } catch (error) {
      logger.error('Frame analysis failed:', error);
      return {
        violations: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
        metadata: { error: (error as Error).message }
      };
    }
  }

  async analyzeAudio(chunk: AudioAnalysisChunk): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Analyzing audio chunk:', {
        timestamp: chunk.timestamp,
        sessionId: chunk.sessionId
      });

      const response = await this.audioService.post('/analyze/audio', {
        audio: chunk.audioData,
        sample_rate: chunk.sampleRate,
        session_id: chunk.sessionId,
        participant_id: chunk.participantId,
        timestamp: chunk.timestamp
      });

      const violations = this.mapAudioViolations(response.violations || [], 'ai-audio');
      
      return {
        violations,
        confidence: response.confidence || 0.8,
        processingTimeMs: Date.now() - startTime,
        metadata: {
          noiseAnalysis: response.noise_detection,
          speechAnalysis: response.speech_analysis,
          speakerAnalysis: response.speaker_analysis
        }
      };
    } catch (error) {
      logger.error('Audio analysis failed:', error);
      return {
        violations: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
        metadata: { error: (error as Error).message }
      };
    }
  }

  async analyzeBehavior(chunk: FrameAnalysisChunk): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Analyzing behavior chunk:', {
        timestamp: chunk.timestamp,
        sessionId: chunk.sessionId
      });

      const response = await this.behaviorService.post('/analyze/behavior', {
        image: chunk.frameData,
        session_id: chunk.sessionId,
        participant_id: chunk.participantId,
        timestamp: chunk.timestamp
      });

      const violations = this.mapBehaviorViolations(response.violations || [], 'ai-behavior');
      
      return {
        violations,
        confidence: response.confidence || 0.8,
        processingTimeMs: Date.now() - startTime,
        metadata: {
          poseAnalysis: response.pose_analysis,
          faceAnalysis: response.face_analysis,
          gestureAnalysis: response.gesture_analysis
        }
      };
    } catch (error) {
      logger.error('Behavior analysis failed:', error);
      return {
        violations: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
        metadata: { error: (error as Error).message }
      };
    }
  }

  private mapVisionViolations(aiViolations: any[], aiService: string): Violation[] {
    return aiViolations.map((violation, index) => ({
      id: violation.id || `vision_${Date.now()}_${index}`,
      code: violation.code,
      type: violation.type || 'object',
      severity: this.mapSeverity(violation.severity),
      confidence: violation.confidence,
      description: violation.description,
      timestamp: violation.timestamp,
      duration: violation.duration_ms,
      evidence: violation.evidence_urls || [],
      aiService,
      metadata: violation.metadata
    }));
  }

  private mapAudioViolations(aiViolations: any[], aiService: string): Violation[] {
    return aiViolations.map((violation, index) => ({
      id: violation.id || `audio_${Date.now()}_${index}`,
      code: violation.code,
      type: violation.type || 'audio',
      severity: this.mapSeverity(violation.severity),
      confidence: violation.confidence,
      description: violation.description,
      timestamp: violation.timestamp,
      duration: violation.duration_ms,
      evidence: [],
      aiService,
      metadata: violation.metadata
    }));
  }

  private mapBehaviorViolations(aiViolations: any[], aiService: string): Violation[] {
    return aiViolations.map((violation, index) => ({
      id: violation.id || `behavior_${Date.now()}_${index}`,
      code: violation.code,
      type: violation.type || 'behavior',
      severity: this.mapSeverity(violation.severity),
      confidence: violation.confidence,
      description: violation.description,
      timestamp: violation.timestamp,
      duration: violation.duration_ms,
      evidence: violation.evidence_urls || [],
      aiService,
      metadata: violation.metadata
    }));
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  async getServiceStatus(): Promise<{ vision: boolean; audio: boolean; behavior: boolean }> {
    const [vision, audio, behavior] = await Promise.all([
      this.visionService.healthCheck(),
      this.audioService.healthCheck(),
      this.behaviorService.healthCheck()
    ]);

    return { vision, audio, behavior };
  }

  get isReady(): boolean {
    return this.visionService.healthy && this.audioService.healthy;
  }
}