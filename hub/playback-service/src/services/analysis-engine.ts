/**
 * Analysis Engine
 * Orchestrates video and audio processing through AI services
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { extendedConfig as config } from '../config';
import { AIIntegrationService, AIAnalysisResult, Violation } from './ai-integration';
import { StorageService } from './storage';
import { DatabaseService } from './database';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface AnalysisJob {
  id: string;
  sessionId: string;
  participantId: string;
  type: 'full_analysis' | 'real_time' | 'highlight_detection';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: AnalysisResult;
}

export interface AnalysisResult {
  sessionId: string;
  totalViolations: number;
  processingTimeMs: number;
  violations: Violation[];
  timeline: TimelineSegment[];
  statistics: AnalysisStatistics;
}

export interface TimelineSegment {
  startTime: number;
  endTime: number;
  violations: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dominantViolationType?: string;
}

export interface AnalysisStatistics {
  totalFrames: number;
  analyzedFrames: number;
  audioChunks: number;
  averageConfidence: number;
  violationDensity: number; // violations per minute
  coverage: number; // percentage of session analyzed
  qualityScore: number; // overall analysis quality (0-100)
}

interface VideoChunk {
  frameData: string;
  audioData?: string;
  timestamp: number;
  frameNumber: number;
}

export class AnalysisEngine extends EventEmitter {
  private aiService: AIIntegrationService;
  private storageService: StorageService;
  private databaseService: DatabaseService;
  private activeJobs: Map<string, AnalysisJob> = new Map();
  private processingQueue: AnalysisJob[] = [];
  private isProcessing: boolean = false;

  constructor(
    aiService: AIIntegrationService,
    storageService: StorageService,
    databaseService: DatabaseService
  ) {
    super();
    this.aiService = aiService;
    this.storageService = storageService;
    this.databaseService = databaseService;
  }

  async analyzeSession(
    sessionId: string,
    participantId: string,
    type: 'full_analysis' | 'real_time' | 'highlight_detection' = 'full_analysis'
  ): Promise<string> {
    const jobId = uuidv4();
    
    const job: AnalysisJob = {
      id: jobId,
      sessionId,
      participantId,
      type,
      status: 'pending',
      progress: 0
    };

    this.activeJobs.set(jobId, job);
    this.processingQueue.push(job);
    
    // Store job in database
    await this.storeAnalysisJob(job);
    
    logger.info('Analysis job created:', {
      jobId,
      sessionId,
      type,
      queueLength: this.processingQueue.length
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return jobId;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const job = this.processingQueue.shift()!;
        await this.processAnalysisJob(job);
      }
    } catch (error) {
      logger.error('Error in queue processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processAnalysisJob(job: AnalysisJob): Promise<void> {
    try {
      job.status = 'processing';
      job.startedAt = new Date();
      job.progress = 0;

      await this.updateJobStatus(job);
      this.emit('job:started', job);

      logger.info('Processing analysis job:', { jobId: job.id, sessionId: job.sessionId });

      // Get recording file path
      const recordingPath = await this.getRecordingPath(job.sessionId);
      if (!recordingPath) {
        throw new Error('Recording not found');
      }

      // Process video into chunks
      const chunks = await this.extractVideoChunks(recordingPath, job);
      logger.info(`Extracted ${chunks.length} video chunks for analysis`);

      // Analyze chunks
      const violations: Violation[] = [];
      const processingStartTime = Date.now();
      let analyzedFrames = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Analyze frame (vision + behavior)
          const [visionResult, behaviorResult, audioResult] = await Promise.allSettled([
            this.aiService.analyzeFrame({
              frameData: chunk.frameData,
              timestamp: chunk.timestamp,
              sessionId: job.sessionId,
              participantId: job.participantId
            }),
            // this.aiService.analyzeBehavior({ ... }), // Enable when behavior service is ready
            Promise.resolve({ violations: [], confidence: 0, processingTimeMs: 0 }),
            // Analyze audio if available
            chunk.audioData ? this.aiService.analyzeAudio({
              audioData: chunk.audioData,
              timestamp: chunk.timestamp,
              sessionId: job.sessionId,
              participantId: job.participantId
            }) : Promise.resolve({ violations: [], confidence: 0, processingTimeMs: 0 })
          ]);

          // Collect violations from all services
          if (visionResult.status === 'fulfilled') {
            violations.push(...visionResult.value.violations);
          }
          if (behaviorResult.status === 'fulfilled') {
            violations.push(...behaviorResult.value.violations);
          }
          if (audioResult.status === 'fulfilled') {
            violations.push(...audioResult.value.violations);
          }

          analyzedFrames++;
          job.progress = Math.round((i + 1) / chunks.length * 100);

          // Update progress periodically
          if (i % 10 === 0) {
            await this.updateJobStatus(job);
            this.emit('job:progress', job);
          }

        } catch (error) {
          logger.warn(`Failed to analyze chunk ${i}:`, error);
        }
      }

      const processingTimeMs = Date.now() - processingStartTime;

      // Generate timeline and statistics
      const timeline = this.generateTimeline(violations, chunks.length * config.chunkDurationSeconds);
      const statistics = this.calculateStatistics(chunks.length, analyzedFrames, violations, processingTimeMs);

      // Store violations in database
      await this.storeViolations(job.sessionId, violations);

      // Create result
      job.result = {
        sessionId: job.sessionId,
        totalViolations: violations.length,
        processingTimeMs,
        violations,
        timeline,
        statistics
      };

      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;

      await this.updateJobStatus(job);
      this.emit('job:completed', job);

      logger.info('Analysis job completed:', {
        jobId: job.id,
        sessionId: job.sessionId,
        violations: violations.length,
        processingTimeMs
      });

    } catch (error) {
      logger.error('Analysis job failed:', { jobId: job.id, error });
      
      job.status = 'failed';
      job.error = (error as Error).message;
      job.progress = 0;
      
      await this.updateJobStatus(job);
      this.emit('job:failed', job);
    }
  }

  private async extractVideoChunks(videoPath: string, job: AnalysisJob): Promise<VideoChunk[]> {
    return new Promise((resolve, reject) => {
      const chunks: VideoChunk[] = [];
      const chunkDuration = config.chunkDurationSeconds;
      let frameNumber = 0;

      ffmpeg(videoPath)
        .videoFilters([
          `fps=1/${chunkDuration}`, // Extract one frame per chunk duration
          'scale=640:480' // Resize for faster processing
        ])
        .format('image2pipe')
        .outputOption('-vcodec png')
        .on('error', (error) => {
          logger.error('FFmpeg error:', error);
          reject(error);
        })
        .on('end', () => {
          logger.info(`Extracted ${chunks.length} frames from video`);
          resolve(chunks);
        })
        .pipe()
        .on('data', (chunk: Buffer) => {
          const timestamp = frameNumber * chunkDuration * 1000; // Convert to ms
          const frameData = chunk.toString('base64');
          
          chunks.push({
            frameData,
            timestamp,
            frameNumber
          });
          
          frameNumber++;
        });
    });
  }

  private generateTimeline(violations: Violation[], durationSeconds: number): TimelineSegment[] {
    const segmentDuration = 60; // 1-minute segments
    const totalSegments = Math.ceil(durationSeconds / segmentDuration);
    const timeline: TimelineSegment[] = [];

    for (let i = 0; i < totalSegments; i++) {
      const startTime = i * segmentDuration * 1000;
      const endTime = Math.min((i + 1) * segmentDuration * 1000, durationSeconds * 1000);
      
      const segmentViolations = violations.filter(v => 
        v.timestamp >= startTime && v.timestamp < endTime
      );

      const riskLevel = this.calculateRiskLevel(segmentViolations);
      const dominantType = this.getDominantViolationType(segmentViolations);

      timeline.push({
        startTime,
        endTime,
        violations: segmentViolations.length,
        riskLevel,
        dominantViolationType: dominantType
      });
    }

    return timeline;
  }

  private calculateStatistics(
    totalChunks: number,
    analyzedFrames: number,
    violations: Violation[],
    processingTimeMs: number
  ): AnalysisStatistics {
    const avgConfidence = violations.length > 0 ? 
      violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length : 0;
    
    const durationMinutes = (totalChunks * config.chunkDurationSeconds) / 60;
    const violationDensity = violations.length / Math.max(durationMinutes, 1);
    
    const coverage = totalChunks > 0 ? (analyzedFrames / totalChunks) * 100 : 0;
    
    // Quality score based on coverage, confidence, and processing success
    const qualityScore = Math.round(
      (coverage * 0.4) + 
      (avgConfidence * 100 * 0.4) + 
      (Math.min(processingTimeMs / 1000 / 60, 10) / 10 * 20) // Processing efficiency
    );

    return {
      totalFrames: totalChunks,
      analyzedFrames,
      audioChunks: analyzedFrames, // Same as frames for now
      averageConfidence: avgConfidence,
      violationDensity,
      coverage,
      qualityScore
    };
  }

  private calculateRiskLevel(violations: Violation[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'low';
    
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) return 'critical';
    if (highCount > 1) return 'high';
    if (highCount > 0 || violations.length > 3) return 'medium';
    return 'low';
  }

  private getDominantViolationType(violations: Violation[]): string | undefined {
    if (violations.length === 0) return undefined;
    
    const typeCounts = violations.reduce((counts, v) => {
      counts[v.type] = (counts[v.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  private async getRecordingPath(sessionId: string): Promise<string | null> {
    try {
      const result = await this.databaseService.query(
        'SELECT file_path FROM recordings WHERE session_id = $1',
        [sessionId]
      );
      return result.rows[0]?.file_path || null;
    } catch (error) {
      logger.error('Failed to get recording path:', error);
      return null;
    }
  }

  private async storeAnalysisJob(job: AnalysisJob): Promise<void> {
    await this.databaseService.query(
      `INSERT INTO analysis_jobs (id, session_id, job_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [job.id, job.sessionId, job.type, job.status, new Date()]
    );
  }

  private async updateJobStatus(job: AnalysisJob): Promise<void> {
    await this.databaseService.query(
      `UPDATE analysis_jobs 
       SET status = $1, started_at = $2, completed_at = $3, error_message = $4, result = $5
       WHERE id = $6`,
      [
        job.status,
        job.startedAt || null,
        job.completedAt || null,
        job.error || null,
        job.result ? JSON.stringify(job.result) : null,
        job.id
      ]
    );
  }

  private async storeViolations(sessionId: string, violations: Violation[]): Promise<void> {
    if (violations.length === 0) return;

    const query = `
      INSERT INTO violations (
        id, session_id, participant_id, violation_code, violation_type,
        severity, confidence, description, timestamp_ms, duration_ms,
        ai_service, evidence_urls, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    for (const violation of violations) {
      await this.databaseService.query(query, [
        violation.id,
        sessionId,
        '', // participant_id - would need to be passed in
        violation.code,
        violation.type,
        violation.severity,
        violation.confidence,
        violation.description,
        violation.timestamp,
        violation.duration || null,
        violation.aiService,
        violation.evidence || [],
        JSON.stringify(violation.metadata || {})
      ]);
    }

    logger.info(`Stored ${violations.length} violations for session ${sessionId}`);
  }

  getJobStatus(jobId: string): AnalysisJob | undefined {
    return this.activeJobs.get(jobId);
  }

  getAllJobs(): AnalysisJob[] {
    return Array.from(this.activeJobs.values());
  }
}