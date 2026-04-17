// ─────────────────────────────────────────────
// @ayan/client-sdk — Browser SDK for Spokes
// Embeddable proctoring widget (iframe-based).
// Spoke frontend apps include this to connect candidates to the hub.
// ─────────────────────────────────────────────

export interface ClientSDKConfig {
  hubGatewayUrl: string;
  hubWebsocketUrl: string;
  spokeId: string;
  sessionId: string;
  candidateId: string;
  examId: string;
  authToken: string;
  containerId?: string;
  theme?: 'dark' | 'light';
  mode?: 'auto-proctor' | 'hybrid-proctor';
}

export class AyanClientSDK {
  private config: ClientSDKConfig;
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, ((data: unknown) => void)[]> = new Map();

  constructor(config: ClientSDKConfig) {
    this.config = config;
  }

  static init(config: ClientSDKConfig): AyanClientSDK {
    return new AyanClientSDK(config);
  }

  async connect(): Promise<void> {
    const wsUrl = `${this.config.hubWebsocketUrl}?token=${this.config.authToken}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({
        type: 'join-session',
        sessionId: this.config.sessionId,
        role: 'candidate',
        spokeId: this.config.spokeId,
      }));
      this.emit('connected', { sessionId: this.config.sessionId });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type || 'message', data);
      } catch {
        // Ignore malformed
      }
    };

    this.ws.onclose = () => this.emit('disconnected', {});
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((h) => h(data));
  }

  sendViolation(violation: { type: string; severity: string; description: string }): void {
    this.ws?.send(JSON.stringify({
      type: 'violation',
      sessionId: this.config.sessionId,
      ...violation,
      timestamp: new Date().toISOString(),
    }));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export default AyanClientSDK;
