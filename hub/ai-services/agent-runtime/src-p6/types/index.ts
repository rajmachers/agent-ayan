import { Request } from 'express';

// Express Request Extensions
export interface AgentRequest extends Request {
  agentManager: any; // Will be typed more specifically when AgentManager is imported
  sessionId?: string;
  agentId?: string;
}

export interface SessionData {
  id: string;
  external_id?: string;
  delivery_id: string;
  candidate_id: string;
  room_id: string;
  status: 'created' | 'active' | 'completed' | 'interrupted' | 'failed';
  credibility_score?: number;
  risk_level?: 'low' | 'medium' | 'high';
  started_at?: Date;
  ended_at?: Date;
  exam?: {
    id: string;
    title: string;
    duration_min: number;
    addons_config: ExamAddonsConfig;
    metrics_config: ExamMetricsConfig;
    rules_config: ExamRulesConfig;
  };
  org_id: string;
}

export interface ExamAddonsConfig {
  face_verify: boolean;
  id_verify: boolean;
  env_scan: boolean;
  screen_record: boolean;
  browser_lock: boolean;
}

export interface ExamMetricsConfig {
  face_detection_weight: number;
  browser_violation_weight: number;
  audio_violation_weight: number;
  motion_violation_weight: number;
}

export interface ExamRulesConfig {
  allow_calculator: boolean;
  allow_notes: boolean;
  allow_breaks: boolean;
  max_violations: number;
}

export interface ViolationData {
  session_id: string;
  code: string;
  type: 'browser' | 'camera' | 'audio' | 'behavior' | 'screen';
  severity: number;
  confidence: number;
  weight: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface AgentStatus {
  id: string;
  session_id: string;
  room_id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connected_at?: Date;
  last_heartbeat: Date;
  capabilities: {
    video_processing: boolean;
    audio_processing: boolean;
    screen_recording: boolean;
  };
  metrics: {
    frames_processed: number;
    violations_detected: number;
    uptime_seconds: number;
  };
}

export interface ProcessingFrame {
  data: Buffer;
  width: number;
  height: number;
  timestamp: number;
  session_id: string;
  source: 'camera' | 'screen';
}

export interface AIServiceResponse {
  violations: Array<{
    code: string;
    type: string;
    severity: number;
    confidence: number;
    metadata: Record<string, any>;
  }>;
  processing_time_ms: number;
  model_version?: string;
}

export interface WebhookPayload {
  event: string;
  session_id: string;
  agent_id: string;
  timestamp: number;
  data: Record<string, any>;
}