// ─────────────────────────────────────────────
// @ayan/service-sdk — Hub Client for Spokes
// Backend SDK: spoke services use this to call hub APIs.
// ─────────────────────────────────────────────

import type {
  ExamConfig,
  Session,
  VisionResult,
  AudioResult,
  BehaviorResult,
  AgentDecision,
  EntryRequest,
  ProctorEfficiencyMetrics,
} from '@ayan/types';

export class HubClient {
  private gatewayUrl: string;
  private spokeId: string;
  private authToken?: string;

  constructor(config: { gatewayUrl: string; spokeId: string; authToken?: string }) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/$/, '');
    this.spokeId = config.spokeId;
    this.authToken = config.authToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Spoke-Id': this.spokeId,
    };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    const res = await fetch(`${this.gatewayUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hub API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Configuration ──
  async getExamMode(examId: string): Promise<ExamConfig> {
    return this.request(`/api/config/exam-mode/${examId}`);
  }

  // ── Sessions ──
  async createSession(data: {
    candidateId: string;
    examId: string;
    organizationId: string;
  }): Promise<Session> {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ ...data, spokeId: this.spokeId }),
    });
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request(`/api/sessions/${sessionId}`);
  }

  async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ── AI Analysis ──
  async analyzeFrame(sessionId: string, frameData: string): Promise<VisionResult> {
    return this.request('/api/vision/api/analyze/frame', {
      method: 'POST',
      body: JSON.stringify({ sessionId, frameData, spokeId: this.spokeId }),
    });
  }

  async analyzeAudio(sessionId: string, audioChunk: string): Promise<AudioResult> {
    return this.request('/api/vision/api/analyze/audio', {
      method: 'POST',
      body: JSON.stringify({ sessionId, audioChunk, spokeId: this.spokeId }),
    });
  }

  async analyzeBehavior(sessionId: string, poseData: unknown, gazeData: unknown): Promise<BehaviorResult> {
    return this.request('/api/vision/api/analyze/behavior', {
      method: 'POST',
      body: JSON.stringify({ sessionId, poseData, gazeData, spokeId: this.spokeId }),
    });
  }

  // ── Agent Runtime ──
  async evaluateSession(sessionId: string, signals: unknown): Promise<AgentDecision> {
    return this.request('/api/agent/api/agent/evaluate', {
      method: 'POST',
      body: JSON.stringify({ sessionId, signals }),
    });
  }

  // ── Gatekeeper (Hybrid Mode) ──
  async requestEntry(data: {
    sessionId: string;
    candidateId: string;
    examId: string;
    identityEvidence?: unknown;
  }): Promise<{ entryId: string; status: string }> {
    return this.request('/api/gatekeeper/api/gatekeeper/entry/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApprovalQueue(): Promise<EntryRequest[]> {
    return this.request('/api/gatekeeper/api/gatekeeper/queue');
  }

  async decideEntry(data: {
    entryId: string;
    decision: 'approved' | 'denied';
    proctorId: string;
    reason?: string;
  }): Promise<void> {
    await this.request('/api/gatekeeper/api/gatekeeper/decide', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Analytics ──
  async getAIAccuracy(): Promise<ProctorEfficiencyMetrics> {
    return this.request('/api/learning/api/learning/accuracy');
  }
}

export default HubClient;
