import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

interface Session {
  sessionId: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  status: 'active' | 'completed' | 'terminated';
  startedAt: Date;
  completedAt?: Date;
  score: number;
  credibilityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  violations: Violation[];
  currentQuestion?: number;
  totalQuestions?: number;
  metadata: any;
}

interface Violation {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  description: string;
  confidence: number;
  source: string;
  metadata?: any;
}

interface Client {
  id: string;
  ws: WebSocket;
  type: 'admin' | 'candidate';
  organizationId?: string;
  sessionId?: string;
}

class SessionManager {
  private sessions = new Map<string, Session>();
  private clients = new Map<string, Client>();
  private wss: WebSocketServer;
  
  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();
    console.log(`🚀 Session Manager WebSocket Server running on port ${port}`);
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = randomUUID();
      const url = new URL(req.url || '', `http://localhost`);
      const clientType = url.searchParams.get('type') as 'admin' | 'candidate';
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const sessionId = url.searchParams.get('sessionId') || undefined;

      const client: Client = {
        id: clientId,
        ws,
        type: clientType,
        organizationId,
        sessionId
      };

      this.clients.set(clientId, client);
      console.log(`📱 ${clientType} client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`📱 Client disconnected: ${clientId}`);
      });

      // Send current sessions to admin clients
      if (clientType === 'admin') {
        this.sendSessionsToAdmin(clientId);
      }
    });
  }

  private handleMessage(clientId: string, message: any) {
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
      case 'violation:trigger':
        this.triggerViolation(message.sessionId, message.data);
        break;
      case 'admin:request_sessions':
        this.sendSessionsToAdmin(clientId);
        break;
      default:
        console.warn('❓ Unknown message type:', message.type);
    }
  }

  private startSession(sessionData: any, clientId: string) {
    const sessionId = randomUUID();
    const session: Session = {
      sessionId,
      candidateId: sessionData.candidateId,
      examId: sessionData.examId,
      organizationId: sessionData.organizationId,
      status: 'active',
      startedAt: new Date(),
      score: 0,
      credibilityScore: 95,
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
        data: session
      }));
    }

    // Notify all admin clients
    this.broadcastToAdmins({
      type: 'session:new',
      data: session
    });

    console.log(`🎯 New session started: ${sessionId} for ${sessionData.candidateId}`);
  }

  private updateSession(updateData: any, clientId: string) {
    const client = this.clients.get(clientId);
    if (!client?.sessionId) return;

    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    // Update session data
    Object.assign(session, updateData);

    // Broadcast update to admins
    this.broadcastToAdmins({
      type: 'session:updated',
      data: session
    });
  }

  private endSession(sessionId: string, clientId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.completedAt = new Date();

    // Calculate final scores
    const violationPenalty = session.violations.reduce((total, v) => {
      switch (v.severity) {
        case 'critical': return total + 15;
        case 'warning': return total + 8;
        case 'info': return total + 3;
        default: return total;
      }
    }, 0);

    session.credibilityScore = Math.max(25, 95 - violationPenalty);
    
    if (session.credibilityScore < 60) session.riskLevel = 'critical';
    else if (session.credibilityScore < 80) session.riskLevel = 'high';
    else if (session.credibilityScore < 90) session.riskLevel = 'medium';
    else session.riskLevel = 'low';

    this.broadcastToAdmins({
      type: 'session:ended',
      data: session
    });

    console.log(`🏁 Session ended: ${sessionId}`);
  }

  public triggerViolation(sessionId: string, violationData: any) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const violation: Violation = {
      id: randomUUID(),
      type: violationData.type,
      severity: violationData.severity || 'warning',
      timestamp: new Date(),
      description: violationData.description,
      confidence: violationData.confidence || Math.floor(Math.random() * 20 + 75),
      source: violationData.source || 'ai-proctor',
      metadata: violationData.metadata
    };

    session.violations.push(violation);

    // Update credibility score
    const penalty = violation.severity === 'critical' ? 15 : 
                   violation.severity === 'warning' ? 8 : 3;
    session.credibilityScore = Math.max(25, session.credibilityScore - penalty);
    
    // Update risk level
    if (session.credibilityScore < 60) session.riskLevel = 'critical';
    else if (session.credibilityScore < 80) session.riskLevel = 'high';
    else if (session.credibilityScore < 90) session.riskLevel = 'medium';

    // Broadcast violation to all relevant clients
    this.broadcastToAdmins({
      type: 'violation:new',
      sessionId,
      data: violation
    });

    // Send to candidate if warranted
    const candidateClient = Array.from(this.clients.values()).find(
      c => c.type === 'candidate' && c.sessionId === sessionId
    );
    
    if (candidateClient && violation.severity === 'critical') {
      candidateClient.ws.send(JSON.stringify({
        type: 'violation:warning',
        data: {
          message: 'Please ensure you follow exam guidelines',
          severity: violation.severity
        }
      }));
    }

    console.log(`🚨 Violation triggered: ${violation.type} in session ${sessionId}`);
  }

  private sendSessionsToAdmin(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client || client.type !== 'admin') return;

    const sessions = Array.from(this.sessions.values()).filter(session => {
      // Super admin sees all, org admin sees only their org
      return !client.organizationId || session.organizationId === client.organizationId;
    });

    client.ws.send(JSON.stringify({
      type: 'sessions:list',
      data: sessions
    }));
  }

  private broadcastToAdmins(message: any) {
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

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}

// Global session manager instance
let sessionManager: SessionManager;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

export { SessionManager, type Session, type Violation, type Client };