#!/usr/bin/env node

const { WebSocket, WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

class SessionManager {
  constructor(port = 8181) {
    this.sessions = new Map();
    this.clients = new Map();
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();
    // Start idle checker interval (every 60 seconds)
    this._idleInterval = setInterval(() => this._checkIdleSessions(), 60000);
    // Start retention cleanup (every 10 minutes)
    this._retentionInterval = setInterval(() => this._cleanupRetention(), 600000);
    // Start decision engine evaluation (every 10 seconds)
    this._decisionInterval = setInterval(() => this._evaluateAllSessions(), 10000);

    // Platform settings (configurable via admin)
    this.settings = {
      evidence: {
        storageMode: 'inline',  // 'inline' (base64 in-memory) or 'minio' (S3 upload)
        captureScreenshots: true,
        captureWebcamFrames: true,
        captureAudioClips: true,
        retentionDays: 1,       // how many days to keep evidence data
        maxEvidenceSizeKB: 200, // max per-evidence payload
      },
      // Phase 6: Decision autonomy thresholds
      decisionEngine: {
        enabled: true,
        autoPauseThreshold: 40,      // pause exam at this credibility %
        autoTerminateThreshold: 15,   // terminate at this %
        autoFlagThreshold: 50,        // flag session for proctor review
        noFaceTimeoutMs: 60000,       // pause after 60s no face
        multipleFacesMaxCount: 3,     // lock after 3 multiple_faces events
        notifyProctorThreshold: 30,   // push notification below this %
        mode: 'autonomous',           // 'autonomous' | 'copilot' (suggest only)
      }
    };

    // Phase 6: Action log for all autonomous decisions
    this.actionLog = [];
    // Phase 6: Cohort baselines per exam
    this.cohortBaselines = new Map();
    // Phase 6: Adaptive weights per exam
    this.adaptiveWeights = new Map();

    console.log(`🚀 Session Manager WebSocket Server running on port ${port}`);
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = randomUUID();
      const url = new URL(req.url || '', `http://localhost`);
      const clientType = url.searchParams.get('type');
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const sessionId = url.searchParams.get('sessionId') || undefined;

      const client = {
        id: clientId,
        ws,
        type: clientType,
        organizationId,
        sessionId
      };

      this.clients.set(clientId, client);
      console.log(`📱 ${clientType} client connected: ${clientId}`);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        // When a candidate disconnects, mark their session as disconnected
        const disconnectedClient = this.clients.get(clientId);
        if (disconnectedClient && disconnectedClient.type === 'candidate' && disconnectedClient.sessionId) {
          const session = this.sessions.get(disconnectedClient.sessionId);
          if (session && session.status === 'active') {
            session.lastActivity = new Date();
            // Don't end it immediately — idle checker will handle status transitions
            console.log(`📱 Candidate disconnected, session ${session.sessionId} will be monitored for idle`);
          }
        }
        this.clients.delete(clientId);
        console.log(`📱 Client disconnected: ${clientId}`);
      });

      // Send current sessions to admin clients
      if (clientType === 'admin') {
        this.sendSessionsToAdmin(clientId);
      }
    });
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'session:start':
        this.startSession(message.data, clientId);
        break;
      case 'session:update':
        this.updateSession(message.data, clientId);
        break;
      case 'session:end':
        this.endSession(message.sessionId, clientId);
        break;
      case 'session:heartbeat':
        this._handleHeartbeat(message.sessionId, message.data);
        break;
      case 'violation:trigger':
        this.triggerViolation(message.sessionId, message.data);
        break;
      case 'violation:batch':
        this._handleViolationBatch(message.sessionId, message.data);
        break;
      case 'admin:request_sessions':
        this.sendSessionsToAdmin(clientId);
        break;
      case 'admin:get_settings':
        this._sendSettings(clientId);
        break;
      case 'admin:update_settings':
        this._updateSettings(message.data, clientId);
        break;
      // Phase 6: Admin manual controls
      case 'admin:pause_session':
        this._adminPauseSession(message.sessionId, message.reason, clientId);
        break;
      case 'admin:resume_session':
        this._adminResumeSession(message.sessionId, clientId);
        break;
      case 'admin:terminate_session':
        this._adminTerminateSession(message.sessionId, message.reason, clientId);
        break;
      case 'admin:lock_session':
        this._adminLockSession(message.sessionId, message.reason, clientId);
        break;
      case 'admin:get_action_log':
        this._sendActionLog(clientId, message.sessionId);
        break;
      case 'admin:get_decision_settings':
        this._sendDecisionSettings(clientId);
        break;
      case 'admin:update_decision_settings':
        this._updateDecisionSettings(message.data, clientId);
        break;
      default:
        console.warn('❓ Unknown message type:', message.type);
    }
  }

  startSession(sessionData, clientId) {
    // Dedup: if same candidate created a session within last 3 seconds, just return existing
    const recentSession = Array.from(this.sessions.values()).find(
      s => s.candidateId === sessionData.candidateId &&
           s.organizationId === sessionData.organizationId &&
           s.status === 'active' &&
           (Date.now() - new Date(s.startedAt).getTime()) < 3000
    );
    if (recentSession) {
      console.log(`⚠️ Dedup: returning existing session ${recentSession.sessionId} (created <3s ago)`);
      const client = this.clients.get(clientId);
      if (client) {
        client.sessionId = recentSession.sessionId;
        client.ws.send(JSON.stringify({
          type: 'session:started',
          sessionId: recentSession.sessionId,
          shortId: recentSession.shortId,
          data: recentSession
        }));
      }
      return;
    }

    // Mark any existing active sessions for this candidate as abandoned
    for (const [id, session] of this.sessions) {
      if (session.candidateId === sessionData.candidateId &&
          session.organizationId === sessionData.organizationId &&
          (session.status === 'active' || session.status === 'idle-yellow' || session.status === 'idle-amber' || session.status === 'idle-red')) {
        session.status = 'abandoned';
        session.completedAt = new Date();
        console.log(`🔄 Marked old session ${id} as abandoned for candidate ${sessionData.candidateId}`);
        this.broadcastToAdmins({ type: 'session:updated', data: session });
      }
    }

    // Generate short ID for display (matches widget format)
    const shortId = Math.random().toString(36).slice(2, 10);
    const sessionId = randomUUID();
    const now = new Date();
    const session = {
      sessionId,
      shortId,
      candidateId: sessionData.candidateId,
      examId: sessionData.examId,
      organizationId: sessionData.organizationId,
      status: 'active',
      startedAt: now,
      lastActivity: now,
      score: 0,
      credibilityScore: 100,
      riskLevel: 'low',
      violations: [],
      currentQuestion: 0,
      totalQuestions: sessionData.totalQuestions || 20,
      metadata: sessionData.metadata || {}
    };

    this.sessions.set(sessionId, session);
    
    // Update client with session ID
    const client = this.clients.get(clientId);
    if (client) {
      client.sessionId = sessionId;
      client.ws.send(JSON.stringify({
        type: 'session:started',
        sessionId,
        shortId,
        data: session
      }));
    }

    // Notify all admin clients
    this.broadcastToAdmins({
      type: 'session:new',
      data: session
    });

    console.log(`🎯 New session started: ${sessionId} (${shortId}) for ${sessionData.candidateId}`);
  }

  updateSession(updateData, clientId) {
    const client = this.clients.get(clientId);
    if (!client?.sessionId) return;

    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    // Update session data
    Object.assign(session, updateData);
    session.lastActivity = new Date();

    // Broadcast update to admins
    this.broadcastToAdmins({
      type: 'session:updated',
      data: session
    });
  }

  endSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.completedAt = new Date();

    // Phase 6: Update cohort baseline with this session's data
    this._updateCohortBaseline(session);

    this.broadcastToAdmins({
      type: 'session:ended',
      data: session
    });

    console.log(`🏁 Session ended: ${sessionId}`);
  }

  _handleHeartbeat(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Only mark as real user activity if user actually interacted
    const hasRealActivity = data && data.hasUserActivity;
    if (hasRealActivity) {
      session.lastActivity = new Date();
      // If session was idle, restore to active
      if (session.status.startsWith('idle-')) {
        session.status = 'active';
        console.log(`💚 Session ${sessionId} restored to active (user activity detected)`);
        this.broadcastToAdmins({ type: 'session:updated', data: session });
      }
    }
    // Always update lastHeartbeat so we know WS is alive
    session.lastHeartbeat = new Date();
  }

  _checkIdleSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.status === 'completed' || session.status === 'abandoned') continue;

      const lastAct = session.lastActivity ? new Date(session.lastActivity).getTime() : new Date(session.startedAt).getTime();
      const idleMinutes = (now - lastAct) / 60000;

      let newStatus = 'active';
      if (idleMinutes >= 15) newStatus = 'idle-red';
      else if (idleMinutes >= 10) newStatus = 'idle-amber';
      else if (idleMinutes >= 5) newStatus = 'idle-yellow';

      if (newStatus !== session.status) {
        const oldStatus = session.status;
        session.status = newStatus;
        console.log(`⏱️  Session ${id} status: ${oldStatus} → ${newStatus} (idle ${Math.round(idleMinutes)}m)`);
        this.broadcastToAdmins({ type: 'session:updated', data: session });
      }
    }
  }

  triggerViolation(sessionId, violationData) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Only reset idle on user-initiated events (browser-monitor), NOT on AI-generated events
    const isUserAction = violationData.source === 'browser-monitor';
    if (isUserAction) {
      session.lastActivity = new Date();
      if (session.status.startsWith('idle-')) {
        session.status = 'active';
      }
    }

    const violation = {
      id: randomUUID(),
      type: violationData.type,
      severity: violationData.severity || 'warning',
      timestamp: violationData.timestamp || new Date().toISOString(),
      description: violationData.description,
      confidence: violationData.confidence || Math.floor(Math.random() * 20 + 75),
      source: violationData.source || 'ai-proctor',
      metadata: violationData.metadata,
      evidence: this._processEvidence(violationData.evidence)
    };

    session.violations.push(violation);

    // Update credibility score — use same penalties as SDK
    const penalty = violation.severity === 'critical' ? 15 : 
                   violation.severity === 'warning' ? 5 : 2;
    session.credibilityScore = Math.max(10, session.credibilityScore - penalty);
    
    // Update risk level
    if (session.credibilityScore < 40) session.riskLevel = 'critical';
    else if (session.credibilityScore < 60) session.riskLevel = 'high';
    else if (session.credibilityScore < 80) session.riskLevel = 'medium';
    else session.riskLevel = 'low';

    // Phase 6: Apply adaptive weight from cohort baseline
    const adaptiveResult = this._getAdaptiveWeight(session, violation.type);
    const adaptiveWeight = adaptiveResult ? adaptiveResult.factor : 1.0;
    if (adaptiveWeight !== 1.0) {
      const adjustedPenalty = Math.round(penalty * adaptiveWeight);
      const diff = adjustedPenalty - penalty;
      if (diff !== 0) {
        session.credibilityScore = Math.max(10, session.credibilityScore - diff);
        violation.adaptiveWeight = adaptiveWeight;
        violation.adaptiveReason = adaptiveResult?.reason;
      }
    }

    console.log(`🚨 Violation: ${violation.type} | Session: ${sessionId} | Credibility: ${session.credibilityScore}% | Source: ${violation.source} | AdaptiveW: ${adaptiveWeight.toFixed(2)}`);

    // Phase 6: Async LLM classification enrichment
    this._enrichViolationWithLLM(session, violation).catch(() => {});

    // Broadcast violation to all relevant clients
    this.broadcastToAdmins({
      type: 'violation:new',
      sessionId,
      data: violation
    });

    // Send updated session data to admins
    this.broadcastToAdmins({
      type: 'session:updated',
      data: session
    });

    // Send credibility sync back to candidate
    const candidateClient = Array.from(this.clients.values()).find(
      c => c.type === 'candidate' && c.sessionId === sessionId
    );
    
    if (candidateClient) {
      candidateClient.ws.send(JSON.stringify({
        type: 'violation:alert',
        data: {
          message: `Violation detected: ${violation.description}`,
          severity: violation.severity,
          type: violation.type,
          credibilityScore: session.credibilityScore,
          violationCount: session.violations.length,
          timestamp: violation.timestamp
        }
      }));
    }
  }

  _handleViolationBatch(sessionId, violations) {
    if (!Array.isArray(violations) || violations.length === 0) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    let hasUserAction = false;
    for (const violationData of violations) {
      if (violationData.source === 'browser-monitor') hasUserAction = true;

      const violation = {
        id: randomUUID(),
        type: violationData.type,
        severity: violationData.severity || 'warning',
        timestamp: violationData.timestamp || new Date().toISOString(),
        description: violationData.description,
        confidence: violationData.confidence || Math.floor(Math.random() * 20 + 75),
        source: violationData.source || 'ai-proctor',
        metadata: violationData.metadata,
        evidence: this._processEvidence(violationData.evidence)
      };

      session.violations.push(violation);

      const penalty = violation.severity === 'critical' ? 15 :
                     violation.severity === 'warning' ? 5 : 2;
      session.credibilityScore = Math.max(10, session.credibilityScore - penalty);

      console.log(`🚨 Violation: ${violation.type} | Session: ${sessionId} | Credibility: ${session.credibilityScore}% | Source: ${violation.source}`);
    }

    // Update risk level
    if (session.credibilityScore < 40) session.riskLevel = 'critical';
    else if (session.credibilityScore < 60) session.riskLevel = 'high';
    else if (session.credibilityScore < 80) session.riskLevel = 'medium';
    else session.riskLevel = 'low';

    // Only reset idle on user-initiated browser events
    if (hasUserAction) {
      session.lastActivity = new Date();
      if (session.status.startsWith('idle-')) {
        session.status = 'active';
      }
    }

    // Single broadcast for the whole batch
    this.broadcastToAdmins({ type: 'session:updated', data: session });

    // Send credibility sync back to candidate
    const candidateClient = Array.from(this.clients.values()).find(
      c => c.type === 'candidate' && c.sessionId === sessionId
    );
    if (candidateClient) {
      candidateClient.ws.send(JSON.stringify({
        type: 'violation:alert',
        data: {
          message: `${violations.length} violation(s) recorded`,
          severity: violations[violations.length - 1].severity,
          type: violations[violations.length - 1].type,
          credibilityScore: session.credibilityScore,
          violationCount: session.violations.length,
          timestamp: new Date().toISOString()
        }
      }));
    }

    console.log(`📦 Batch: ${violations.length} violations for session ${sessionId} | Credibility: ${session.credibilityScore}%`);
  }

  // Process and optionally store evidence from violation payloads
  _processEvidence(evidence) {
    if (!evidence) return null;
    const settings = this.settings.evidence;
    console.log(`📎 Processing evidence: type=${evidence.type}, format=${evidence.format}, hasData=${!!evidence.data}`);

    // Check if evidence type is enabled
    if ((evidence.type === 'screenshot_metadata' || evidence.type === 'screenshot') && !settings.captureScreenshots) return null;
    if (evidence.type === 'webcam_frame' && !settings.captureWebcamFrames) return null;
    if (evidence.type === 'audio_clip' && !settings.captureAudioClips) return null;

    // Size check for base64 payloads
    if (evidence.data && typeof evidence.data === 'string') {
      const sizeKB = Math.round(evidence.data.length * 0.75 / 1024); // base64 overhead
      if (sizeKB > settings.maxEvidenceSizeKB) {
        console.log(`⚠ Evidence too large (${sizeKB}KB > ${settings.maxEvidenceSizeKB}KB limit), storing metadata only`);
        return { type: evidence.type, format: evidence.format, truncated: true, originalSizeKB: sizeKB };
      }
    }

    if (settings.storageMode === 'inline') {
      // Store directly in the violation object (in-memory)
      return {
        type: evidence.type,
        format: evidence.format || 'unknown',
        data: evidence.data || null,
        durationMs: evidence.durationMs || null,
        capturedAt: new Date().toISOString()
      };
    }

    // storageMode === 'minio' — placeholder for S3/MinIO upload
    // In production: upload evidence.data to MinIO, return URL reference
    console.log(`📁 MinIO storage mode — would upload ${evidence.type} to object storage`);
    return {
      type: evidence.type,
      format: evidence.format || 'unknown',
      storageMode: 'minio',
      storagePath: `evidence/${new Date().toISOString().slice(0,10)}/${randomUUID()}.${evidence.format === 'image/jpeg' ? 'jpg' : evidence.format === 'audio/webm' ? 'webm' : 'json'}`,
      capturedAt: new Date().toISOString(),
      durationMs: evidence.durationMs || null
    };
  }

  // Phase 6: Enrich violation with LLM classification from agent-reasoning service
  async _enrichViolationWithLLM(session, violation) {
    try {
      const recentViolations = session.violations.slice(-10).map(v => ({
        type: v.type, severity: v.severity, timestamp: v.timestamp, confidence: v.confidence
      }));

      const res = await fetch('http://localhost:4105/api/v1/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violation: {
            type: violation.type,
            severity: violation.severity,
            confidence: violation.confidence,
            description: violation.description,
            source: violation.source
          },
          sessionContext: {
            sessionId: session.id,
            credibilityScore: session.credibilityScore,
            riskLevel: session.riskLevel,
            violationCount: session.violations.length,
            recentViolations,
            duration: Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000)
          }
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const classification = data.data;
      violation.llmClassification = {
        classification: classification.classification,
        category: classification.category,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        suggestedSeverity: classification.suggestedSeverity,
        suggestedAction: classification.suggestedAction,
        model: classification.model,
        classifiedAt: classification.classifiedAt || new Date().toISOString()
      };

      console.log(`🧠 LLM classified: ${violation.type} → ${classification.classification} | Cat: ${classification.category} | Action: ${classification.suggestedAction}`);

      // Broadcast enriched violation to admins
      this.broadcastToAdmins({
        type: 'violation:enriched',
        sessionId: session.id,
        data: { violationId: violation.id, llmClassification: violation.llmClassification }
      });
    } catch (err) {
      // Non-critical — LLM enrichment failure shouldn't affect violation processing
    }
  }

  // Send current settings to admin client
  _sendSettings(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.ws.send(JSON.stringify({
      type: 'settings:current',
      data: this.settings
    }));
  }

  // Update settings from admin
  _updateSettings(data, clientId) {
    if (!data) return;
    // Deep merge evidence settings
    if (data.evidence) {
      Object.assign(this.settings.evidence, data.evidence);
    }
    console.log(`⚙️ Settings updated:`, JSON.stringify(this.settings.evidence));
    // Broadcast updated settings to all admins
    this.broadcastToAdmins({ type: 'settings:updated', data: this.settings });
    // Acknowledge to requesting client
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.send(JSON.stringify({ type: 'settings:saved', data: this.settings }));
    }
  }

  // Cleanup old sessions and evidence based on retention period
  _cleanupRetention() {
    const retentionMs = this.settings.evidence.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      const createdAt = new Date(session.startedAt).getTime();
      if (createdAt < cutoff && (session.status === 'completed' || session.status === 'abandoned')) {
        // Strip evidence from old violations to free memory
        for (const v of session.violations) {
          if (v.evidence && v.evidence.data) {
            v.evidence = { type: v.evidence.type, format: v.evidence.format, expired: true, capturedAt: v.evidence.capturedAt };
          }
        }
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Retention cleanup: stripped evidence from ${cleaned} expired sessions (>${this.settings.evidence.retentionDays}d old)`);
    }
  }

  // =================================================================
  // PHASE 6: COHORT BASELINE + ADAPTIVE WEIGHTS
  // =================================================================

  _getCohortKey(session) {
    return `${session.examId}::${session.organizationId}`;
  }

  _updateCohortBaseline(session) {
    const key = this._getCohortKey(session);
    if (!this.cohortBaselines.has(key)) {
      this.cohortBaselines.set(key, {
        examId: session.examId,
        organizationId: session.organizationId,
        sessionCount: 0,
        violationTypeMeans: {},
        violationTypeStddevs: {},
        avgCredibilityScore: 100,
        avgViolationCount: 0,
        sessionScores: [],
        violationCounts: [],
        updatedAt: null,
      });
    }

    const baseline = this.cohortBaselines.get(key);
    baseline.sessionCount++;

    // Track scores
    baseline.sessionScores.push(session.credibilityScore);
    if (baseline.sessionScores.length > 200) baseline.sessionScores = baseline.sessionScores.slice(-200);
    baseline.avgCredibilityScore = Math.round(
      baseline.sessionScores.reduce((a, b) => a + b, 0) / baseline.sessionScores.length
    );

    // Track violation counts
    baseline.violationCounts.push(session.violations.length);
    if (baseline.violationCounts.length > 200) baseline.violationCounts = baseline.violationCounts.slice(-200);
    baseline.avgViolationCount = Math.round(
      baseline.violationCounts.reduce((a, b) => a + b, 0) / baseline.violationCounts.length * 10
    ) / 10;

    // Track violation type frequencies
    const typeCounts = {};
    for (const v of session.violations) {
      typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
    }

    for (const [type, count] of Object.entries(typeCounts)) {
      if (!baseline.violationTypeMeans[type]) {
        baseline.violationTypeMeans[type] = { sum: 0, count: 0, values: [] };
      }
      const stat = baseline.violationTypeMeans[type];
      stat.sum += count;
      stat.count++;
      stat.values.push(count);
      if (stat.values.length > 200) stat.values = stat.values.slice(-200);
    }

    // Compute standard deviations
    for (const [type, stat] of Object.entries(baseline.violationTypeMeans)) {
      const mean = stat.sum / stat.count;
      const variance = stat.values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / stat.values.length;
      baseline.violationTypeStddevs[type] = { mean, stddev: Math.sqrt(variance) };
    }

    baseline.updatedAt = new Date().toISOString();
    console.log(`📊 Cohort baseline updated: ${key} (${baseline.sessionCount} sessions, avg score: ${baseline.avgCredibilityScore}%)`);
  }

  _getAdaptiveWeight(session, violationType) {
    const key = this._getCohortKey(session);
    const baseline = this.cohortBaselines.get(key);
    if (!baseline || !baseline.violationTypeStddevs[violationType]) {
      // No baseline → use default weights
      return null;
    }

    const stats = baseline.violationTypeStddevs[violationType];
    if (stats.stddev === 0 || baseline.sessionCount < 5) return null;

    // Count this violation type in current session
    const typeCount = session.violations.filter(v => v.type === violationType).length;
    const zScore = (typeCount - stats.mean) / stats.stddev;

    // Adjust penalty based on z-score
    // If this is common behavior (z < 1): reduce weight
    // If this is rare (z > 2): increase weight
    if (zScore < 0.5) return { factor: 0.5, reason: 'common in cohort' };
    if (zScore < 1.0) return { factor: 0.75, reason: 'typical for cohort' };
    if (zScore > 2.5) return { factor: 1.5, reason: 'very rare in cohort' };
    if (zScore > 1.5) return { factor: 1.25, reason: 'uncommon in cohort' };
    return null; // normal range, use default
  }

  getCohortBaseline(examId, organizationId) {
    return this.cohortBaselines.get(`${examId}::${organizationId}`) || null;
  }

  getAllCohortBaselines() {
    return Array.from(this.cohortBaselines.values());
  }

  // =================================================================
  // PHASE 6: DECISION ENGINE — Autonomous session evaluation
  // =================================================================

  _evaluateAllSessions() {
    if (!this.settings.decisionEngine.enabled) return;

    for (const [id, session] of this.sessions) {
      if (session.status === 'completed' || session.status === 'abandoned' || session.status === 'terminated') continue;
      if (session.status === 'paused' || session.status === 'locked') continue;

      this._evaluateSession(session);
    }
  }

  _evaluateSession(session) {
    const cfg = this.settings.decisionEngine;
    const score = session.credibilityScore;
    const violations = session.violations || [];
    const now = Date.now();

    // Auto-terminate check
    if (score <= cfg.autoTerminateThreshold && session.status !== 'terminated') {
      this._executeAction(session, 'terminate', `Credibility score (${score}%) fell below terminate threshold (${cfg.autoTerminateThreshold}%)`, true);
      return;
    }

    // Auto-pause check
    if (score <= cfg.autoPauseThreshold && session.status === 'active') {
      this._executeAction(session, 'pause', `Credibility score (${score}%) fell below pause threshold (${cfg.autoPauseThreshold}%)`, true);
      return;
    }

    // No face timeout check
    const noFaceViolations = violations.filter(v => v.type === 'no_face_detected');
    if (noFaceViolations.length > 0) {
      const lastNoFace = new Date(noFaceViolations[noFaceViolations.length - 1].timestamp).getTime();
      const consecutiveNoFace = noFaceViolations.filter(v => now - new Date(v.timestamp).getTime() < cfg.noFaceTimeoutMs).length;
      if (consecutiveNoFace >= 3 && session.status === 'active') {
        this._executeAction(session, 'pause', `Face not detected for extended period (${consecutiveNoFace} events in ${cfg.noFaceTimeoutMs / 1000}s)`, true);
        return;
      }
    }

    // Multiple faces lock check
    const multipleFaces = violations.filter(v => v.type === 'multiple_faces');
    if (multipleFaces.length >= cfg.multipleFacesMaxCount && session.status === 'active') {
      this._executeAction(session, 'lock', `Multiple faces detected ${multipleFaces.length} times (limit: ${cfg.multipleFacesMaxCount})`, true);
      return;
    }

    // Auto-flag check
    if (score <= cfg.autoFlagThreshold && !session._flagged) {
      session._flagged = true;
      session._flaggedAt = new Date().toISOString();
      this._logAction(session, 'flag', `Session flagged: credibility ${score}% below ${cfg.autoFlagThreshold}%`, true);
      this.broadcastToAdmins({ type: 'session:flagged', data: session, reason: `Credibility ${score}% below threshold` });
      console.log(`🚩 Session ${session.sessionId} flagged (score: ${score}%)`);
    }

    // Proctor notification check
    if (score <= cfg.notifyProctorThreshold && !session._proctorNotified) {
      session._proctorNotified = true;
      this._notifyProctors(session, `Critical: Session ${session.shortId} credibility at ${score}%`);
    }

    // Early high-risk detection (drop to HIGH within 5 minutes)
    const sessionAge = (now - new Date(session.startedAt).getTime()) / 60000;
    if (sessionAge <= 5 && score < 50 && !session._earlyRiskFlagged) {
      session._earlyRiskFlagged = true;
      this._logAction(session, 'early_risk_flag', `High risk within first ${Math.round(sessionAge)} minutes — credibility ${score}%`, true);
      this._notifyProctors(session, `⚡ Early risk: ${session.shortId} dropped to ${score}% in ${Math.round(sessionAge)}min`);
    }
  }

  _executeAction(session, action, reason, isAutomatic) {
    const cfg = this.settings.decisionEngine;

    // In copilot mode, only suggest — don't execute
    if (cfg.mode === 'copilot' && isAutomatic) {
      this._logAction(session, `suggest_${action}`, `[COPILOT] Suggested: ${reason}`, true);
      this.broadcastToAdmins({
        type: 'agent:suggestion',
        sessionId: session.sessionId,
        data: { action, reason, sessionShortId: session.shortId, credibilityScore: session.credibilityScore }
      });
      return;
    }

    switch (action) {
      case 'pause':
        session.status = 'paused';
        session._pausedAt = new Date().toISOString();
        session._pauseReason = reason;
        this._sendToCandidate(session.sessionId, { type: 'session:pause', data: { reason, canResume: true } });
        break;
      case 'terminate':
        session.status = 'terminated';
        session.completedAt = new Date();
        session._terminateReason = reason;
        this._sendToCandidate(session.sessionId, { type: 'session:terminate', data: { reason } });
        break;
      case 'lock':
        session.status = 'locked';
        session._lockedAt = new Date().toISOString();
        session._lockReason = reason;
        this._sendToCandidate(session.sessionId, { type: 'session:lock', data: { reason } });
        break;
    }

    this._logAction(session, action, reason, isAutomatic);
    this.broadcastToAdmins({ type: 'session:updated', data: session });
    this.broadcastToAdmins({
      type: 'agent:action',
      sessionId: session.sessionId,
      data: { action, reason, isAutomatic, credibilityScore: session.credibilityScore, timestamp: new Date().toISOString() }
    });

    console.log(`🤖 Agent ${action}: session ${session.sessionId} | ${reason}`);
  }

  _logAction(session, action, reason, isAutomatic) {
    const entry = {
      id: randomUUID(),
      sessionId: session.sessionId,
      sessionShortId: session.shortId,
      action,
      reason,
      isAutomatic,
      credibilityScore: session.credibilityScore,
      timestamp: new Date().toISOString(),
    };
    this.actionLog.push(entry);
    // Keep last 1000 actions
    if (this.actionLog.length > 1000) this.actionLog = this.actionLog.slice(-1000);
    return entry;
  }

  _sendToCandidate(sessionId, message) {
    const candidateClient = Array.from(this.clients.values()).find(
      c => c.type === 'candidate' && c.sessionId === sessionId
    );
    if (candidateClient) {
      try { candidateClient.ws.send(JSON.stringify(message)); } catch (e) { /* ignore */ }
    }
  }

  _notifyProctors(session, message) {
    this.broadcastToAdmins({
      type: 'proctor:notification',
      data: {
        title: 'Risk Alert',
        message,
        sessionId: session.sessionId,
        shortId: session.shortId,
        severity: session.credibilityScore < 25 ? 'critical' : 'high',
        timestamp: new Date().toISOString(),
      }
    });
    console.log(`📢 Proctor notification: ${message}`);
  }

  // Admin manual controls
  _adminPauseSession(sessionId, reason, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return;
    this._executeAction(session, 'pause', reason || 'Paused by proctor', false);
  }

  _adminResumeSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session || (session.status !== 'paused' && session.status !== 'locked')) return;

    session.status = 'active';
    session._resumedAt = new Date().toISOString();
    this._sendToCandidate(sessionId, { type: 'session:resume', data: { message: 'Session resumed by proctor' } });
    this._logAction(session, 'resume', 'Resumed by proctor', false);
    this.broadcastToAdmins({ type: 'session:updated', data: session });
    console.log(`▶️ Session ${sessionId} resumed by admin`);
  }

  _adminTerminateSession(sessionId, reason, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'terminated' || session.status === 'completed') return;
    this._executeAction(session, 'terminate', reason || 'Terminated by proctor', false);
  }

  _adminLockSession(sessionId, reason, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return;
    this._executeAction(session, 'lock', reason || 'Locked by proctor', false);
  }

  _sendActionLog(clientId, sessionId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    const log = sessionId
      ? this.actionLog.filter(a => a.sessionId === sessionId)
      : this.actionLog.slice(-100);
    client.ws.send(JSON.stringify({ type: 'agent:action_log', data: log }));
  }

  _sendDecisionSettings(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.ws.send(JSON.stringify({ type: 'decision:settings', data: this.settings.decisionEngine }));
  }

  _updateDecisionSettings(data, clientId) {
    if (!data) return;
    Object.assign(this.settings.decisionEngine, data);
    console.log(`⚙️ Decision engine settings updated:`, JSON.stringify(this.settings.decisionEngine));
    this.broadcastToAdmins({ type: 'decision:settings_updated', data: this.settings.decisionEngine });
  }

  sendSessionsToAdmin(clientId) {
    const client = this.clients.get(clientId);
    if (!client || client.type !== 'admin') return;

    const sessions = Array.from(this.sessions.values()).filter(session => {
      return !client.organizationId || session.organizationId === client.organizationId;
    });

    client.ws.send(JSON.stringify({
      type: 'sessions:list',
      data: sessions
    }));
  }

  broadcastToAdmins(message) {
    this.clients.forEach(client => {
      if (client.type === 'admin') {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('❌ Error sending to admin client:', error);
        }
      }
    });
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

// Start the session manager
console.log('🚀 Starting Agentic AI Proctoring Session Manager...');

const sessionManager = new SessionManager(8181);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down session manager...');
  clearInterval(sessionManager._idleInterval);
  clearInterval(sessionManager._retentionInterval);
  clearInterval(sessionManager._decisionInterval);
  sessionManager.wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Gracefully shutting down session manager...');
  clearInterval(sessionManager._idleInterval);
  clearInterval(sessionManager._retentionInterval);
  clearInterval(sessionManager._decisionInterval);
  sessionManager.wss.close();
  process.exit(0);
});

console.log('✅ Session Manager is running on port 8181');
console.log('📡 WebSocket endpoint: ws://localhost:8181');
console.log('🎯 Ready to handle candidate and admin connections');
console.log('\nPress Ctrl+C to stop...');

module.exports = { SessionManager };