// ─────────────────────────────────────────────
// @ayan/types — Shared type definitions
// Hub-Spoke communication contract
// ─────────────────────────────────────────────

// ── Exam Configuration ──
export type ExamMode = 'auto-proctor' | 'hybrid-proctor';

export interface ExamConfig {
  examMode: ExamMode;
  requiresHumanApproval: boolean;
  aiComplexityThreshold: number;
}

// ── Sessions ──
export type SessionStatus =
  | 'pending'
  | 'waiting-approval'
  | 'active'
  | 'paused'
  | 'terminated'
  | 'completed';

export interface Session {
  id: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  spokeId: string;
  status: SessionStatus;
  startedAt: string;
  updatedAt?: string;
}

// ── AI Analysis Results ──
export interface VisionResult {
  sessionId: string;
  spokeId: string;
  timestamp: string;
  faceDetected: boolean;
  faceCount: number;
  gazeDirection: string;
  objectsDetected: string[];
  confidenceScore: number;
  violations: Violation[];
  complexityScore: number;
  escalationRequired: boolean;
}

export interface AudioResult {
  sessionId: string;
  spokeId: string;
  timestamp: string;
  speakerCount: number;
  backgroundNoiseLevel: string;
  forbiddenKeywords: string[];
  confidence: number;
  violations: Violation[];
}

export interface BehaviorResult {
  sessionId: string;
  spokeId: string;
  timestamp: string;
  focusScore: number;
  postureStability: number;
  suspiciousMovements: string[];
  riskLevel: 'low' | 'medium' | 'high';
  violations: Violation[];
}

// ── Violations ──
export interface Violation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  timestamp: string;
  evidence?: Record<string, unknown>;
}

// ── Agent Decisions ──
export interface AgentDecision {
  sessionId: string;
  timestamp: string;
  complexityScore: number;
  escalationRequired: boolean;
  action: 'auto-handle' | 'escalate-to-human' | 'pause' | 'terminate' | 'warn';
  reasoning: string;
  confidence: number;
}

// ── Human Decisions ──
export interface HumanDecision {
  sessionId: string;
  proctorId: string;
  decisionType: 'entry-gate' | 'intervention' | 'override' | 'feedback';
  decision: string;
  reason: string;
  timestamp: string;
}

// ── Gatekeeper ──
export interface EntryRequest {
  entryId: string;
  sessionId: string;
  candidateId: string;
  examId: string;
  status: 'pending' | 'approved' | 'denied';
  evidencePayload?: Record<string, unknown>;
  requestedAt: string;
  decidedAt?: string;
}

// ── Proctor Intervention ──
export type InterventionAction = 'pause' | 'resume' | 'warn' | 'terminate' | 'message';

export interface ProctorIntervention {
  sessionId: string;
  proctorId: string;
  action: InterventionAction;
  reason?: string;
  timestamp: string;
}

// ── Analytics ──
export interface ProctorEfficiencyMetrics {
  totalFeedback: number;
  aiCorrect: number;
  aiOverridden: number;
  accuracyPct: number;
  period: string;
  calculatedAt: string;
}

// ── Spoke Registration ──
export interface SpokeConfig {
  spokeId: string;
  name: string;
  description: string;
  hubGatewayUrl: string;
  hubWebsocketUrl: string;
  features: string[];
  examMode: ExamMode;
}

// ── WebSocket Events ──
export interface WSEvent<T = unknown> {
  type: string;
  sessionId?: string;
  payload: T;
  timestamp: string;
}
