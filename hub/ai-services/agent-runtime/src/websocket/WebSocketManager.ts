import WebSocket from 'ws';
import { Logger } from '../utils/Logger';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ConnectedClient {
  id: string;
  type: 'proctor' | 'session' | 'service';
  websocket: WebSocket;
  proctorId?: string;
  sessionId?: string;
  serviceId?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: string[];
}

export class WebSocketManager {
  private logger = Logger.getInstance();
  private clients = new Map<string, ConnectedClient>();
  private rooms = new Map<string, Set<string>>(); // roomId -> Set of clientIds
  private wsServer: WebSocket.Server | null = null;
  
  constructor(private port: number = 12801) {}

  /**
   * Initialize WebSocket server
   */
  async initialize(): Promise<void> {
    try {
      this.wsServer = new WebSocket.Server({ port: this.port });
      
      this.wsServer.on('connection', (ws: WebSocket, req) => {
        this.handleConnection(ws, req);
      });

      this.wsServer.on('error', (error) => {
        this.logger.error('WebSocket server error:', error);
      });

      // Start connection cleanup
      this.startConnectionCleanup();

      this.logger.info(`🔌 WebSocket server initialized on port ${this.port}`);

    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    try {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const client: ConnectedClient = {
        id: clientId,
        type: 'session', // Default, will be updated on authentication
        websocket: ws,
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: []
      };

      this.clients.set(clientId, client);

      // Set up WebSocket event handlers
      ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', (code: number, reason: string) => {
        this.handleDisconnection(clientId, code, reason);
      });

      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket client error (${clientId}):`, error);
        this.handleDisconnection(clientId, 1006, 'error');
      });

      ws.on('pong', () => {
        // Update activity on pong response
        this.updateClientActivity(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        connectedAt: client.connectedAt,
        serverTime: new Date()
      });

      this.logger.debug(`🔗 New WebSocket connection: ${clientId}`);

    } catch (error) {
      this.logger.error('Failed to handle WebSocket connection:', error);
      ws.close(1011, 'Server error during connection setup');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Update activity
      this.updateClientActivity(clientId);

      // Parse message
      let message: WebSocketMessage;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        this.logger.warn(`Invalid JSON from client ${clientId}:`, data.toString());
        return;
      }

      // Handle message by type
      switch (message.type) {
        case 'authenticate':
          this.handleAuthentication(clientId, message);
          break;
          
        case 'subscribe':
          this.handleSubscription(clientId, message);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message);
          break;
          
        case 'ping':
          this.handlePing(clientId, message);
          break;
          
        case 'broadcast':
          this.handleBroadcast(clientId, message);
          break;
          
        default:
          this.logger.debug(`Unknown message type from ${clientId}: ${message.type}`);
          break;
      }

    } catch (error) {
      this.logger.error(`Failed to handle message from ${clientId}:`, error);
    }
  }

  /**
   * Handle client authentication
   */
  private handleAuthentication(clientId: string, message: WebSocketMessage): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { clientType, proctorId, sessionId, serviceId, token } = message;

      // Validate authentication token (in real implementation)
      // For now, accept all connections for demonstration

      // Update client information
      client.type = clientType;
      client.proctorId = proctorId;
      client.sessionId = sessionId;
      client.serviceId = serviceId;

      // Confirm authentication
      this.sendToClient(clientId, {
        type: 'authenticated',
        clientId,
        clientType,
        proctorId,
        sessionId,
        serviceId
      });

      this.logger.info(`🔐 Client authenticated: ${clientId} as ${clientType} (${proctorId || sessionId || serviceId})`);

    } catch (error) {
      this.logger.error('Failed to handle authentication:', error);
      this.sendToClient(clientId, {
        type: 'authentication_failed',
        error: 'Authentication failed'
      });
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscription(clientId: string, message: WebSocketMessage): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { channels } = message;
      
      if (Array.isArray(channels)) {
        for (const channel of channels) {
          if (!client.subscriptions.includes(channel)) {
            client.subscriptions.push(channel);
          }
          
          // Add to room if it's a room subscription
          if (channel.startsWith('room:')) {
            this.joinRoom(clientId, channel.substring(5));
          }
        }
      }

      this.sendToClient(clientId, {
        type: 'subscribed',
        channels: client.subscriptions
      });

      this.logger.debug(`📡 Client ${clientId} subscribed to: ${channels}`);

    } catch (error) {
      this.logger.error('Failed to handle subscription:', error);
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscription(clientId: string, message: WebSocketMessage): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { channels } = message;
      
      if (Array.isArray(channels)) {
        for (const channel of channels) {
          const index = client.subscriptions.indexOf(channel);
          if (index > -1) {
            client.subscriptions.splice(index, 1);
          }
          
          // Leave room if it's a room subscription
          if (channel.startsWith('room:')) {
            this.leaveRoom(clientId, channel.substring(5));
          }
        }
      }

      this.sendToClient(clientId, {
        type: 'unsubscribed',
        channels
      });

    } catch (error) {
      this.logger.error('Failed to handle unsubscription:', error);
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(clientId: string, message: WebSocketMessage): void {
    this.sendToClient(clientId, {
      type: 'pong',
      timestamp: new Date(),
      clientTime: message.timestamp
    });
  }

  /**
   * Handle broadcast message from client
   */
  private handleBroadcast(clientId: string, message: WebSocketMessage): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { channel, data } = message;

      // Broadcast to all clients subscribed to the channel
      this.broadcastToChannel(channel, {
        type: 'broadcast',
        from: clientId,
        channel,
        data,
        timestamp: new Date()
      }, clientId); // Exclude sender

    } catch (error) {
      this.logger.error('Failed to handle broadcast:', error);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string, code: number, reason: string): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Remove from all rooms
      for (const [roomId, members] of this.rooms.entries()) {
        members.delete(clientId);
        if (members.size === 0) {
          this.rooms.delete(roomId);
        }
      }

      // Remove client
      this.clients.delete(clientId);

      this.logger.info(`🔌 Client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);

    } catch (error) {
      this.logger.error('Failed to handle disconnection:', error);
    }
  }

  /**
   * Send message to specific proctor
   */
  async sendToProctor(proctorId: string, message: WebSocketMessage): Promise<boolean> {
    try {
      const proctorClients = Array.from(this.clients.values()).filter(
        client => client.type === 'proctor' && client.proctorId === proctorId
      );

      if (proctorClients.length === 0) {
        this.logger.warn(`No connected clients found for proctor: ${proctorId}`);
        return false;
      }

      let sent = false;
      for (const client of proctorClients) {
        if (this.sendToClient(client.id, message)) {
          sent = true;
        }
      }

      return sent;

    } catch (error) {
      this.logger.error('Failed to send message to proctor:', error);
      return false;
    }
  }

  /**
   * Send message to specific session
   */
  async sendToSession(sessionId: string, message: WebSocketMessage): Promise<boolean> {
    try {
      const sessionClients = Array.from(this.clients.values()).filter(
        client => client.sessionId === sessionId
      );

      if (sessionClients.length === 0) {
        this.logger.warn(`No connected clients found for session: ${sessionId}`);
        return false;
      }

      let sent = false;
      for (const client of sessionClients) {
        if (this.sendToClient(client.id, message)) {
          sent = true;
        }
      }

      return sent;

    } catch (error) {
      this.logger.error('Failed to send message to session:', error);
      return false;
    }
  }

  /**
   * Send message to specific service
   */
  async sendToService(serviceId: string, message: WebSocketMessage): Promise<boolean> {
    try {
      const serviceClients = Array.from(this.clients.values()).filter(
        client => client.type === 'service' && client.serviceId === serviceId
      );

      if (serviceClients.length === 0) {
        this.logger.warn(`No connected clients found for service: ${serviceId}`);
        return false;
      }

      let sent = false;
      for (const client of serviceClients) {
        if (this.sendToClient(client.id, message)) {
          sent = true;
        }
      }

      return sent;

    } catch (error) {
      this.logger.error('Failed to send message to service:', error);
      return false;
    }
  }

  /**
   * Broadcast message to specific channel/group
   */
  async broadcast(channel: string, message: WebSocketMessage, excludeClient?: string): Promise<number> {
    return this.broadcastToChannel(channel, message, excludeClient);
  }

  /**
   * Broadcast to channel subscribers
   */
  private broadcastToChannel(channel: string, message: WebSocketMessage, excludeClient?: string): number {
    try {
      let sentCount = 0;

      for (const client of this.clients.values()) {
        if (excludeClient && client.id === excludeClient) continue;
        
        if (client.subscriptions.includes(channel)) {
          if (this.sendToClient(client.id, message)) {
            sentCount++;
          }
        }
      }

      return sentCount;

    } catch (error) {
      this.logger.error('Failed to broadcast to channel:', error);
      return 0;
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): boolean {
    try {
      const client = this.clients.get(clientId);
      if (!client || client.websocket.readyState !== WebSocket.OPEN) {
        return false;
      }

      client.websocket.send(JSON.stringify(message));
      this.updateClientActivity(clientId);
      return true;

    } catch (error) {
      this.logger.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Create a room for group communication
   */
  async createRoom(roomId: string, metadata?: any): Promise<boolean> {
    try {
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
        this.logger.info(`🏠 Room created: ${roomId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to create room:', error);
      return false;
    }
  }

  /**
   * Join client to room
   */
  private joinRoom(clientId: string, roomId: string): boolean {
    try {
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
      }

      this.rooms.get(roomId)!.add(clientId);
      return true;

    } catch (error) {
      this.logger.error('Failed to join room:', error);
      return false;
    }
  }

  /**
   * Remove client from room
   */
  private leaveRoom(clientId: string, roomId: string): boolean {
    try {
      const room = this.rooms.get(roomId);
      if (room) {
        room.delete(clientId);
        
        // Clean up empty rooms
        if (room.size === 0) {
          this.rooms.delete(roomId);
        }
      }
      return true;

    } catch (error) {
      this.logger.error('Failed to leave room:', error);
      return false;
    }
  }

  /**
   * Update client activity timestamp
   */
  private updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  /**
   * Start connection cleanup and health monitoring
   */
  private startConnectionCleanup(): void {
    // Ping all clients every 30 seconds
    setInterval(() => {
      this.pingAllClients();
    }, 30000);

    // Clean up stale connections every minute
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000);
  }

  /**
   * Send ping to all connected clients
   */
  private pingAllClients(): void {
    try {
      const now = new Date();
      
      for (const client of this.clients.values()) {
        if (client.websocket.readyState === WebSocket.OPEN) {
          client.websocket.ping();
        }
      }

    } catch (error) {
      this.logger.error('Failed to ping clients:', error);
    }
  }

  /**
   * Clean up stale and closed connections
   */
  private cleanupStaleConnections(): void {
    try {
      const now = new Date();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      const staleClients = [];
      
      for (const [clientId, client] of this.clients.entries()) {
        // Remove if WebSocket is closed
        if (client.websocket.readyState === WebSocket.CLOSED) {
          staleClients.push(clientId);
          continue;
        }

        // Remove if inactive for too long
        const inactiveTime = now.getTime() - client.lastActivity.getTime();
        if (inactiveTime > staleThreshold) {
          staleClients.push(clientId);
          client.websocket.close(1000, 'Inactive timeout');
        }
      }

      // Clean up stale clients
      for (const clientId of staleClients) {
        this.handleDisconnection(clientId, 1000, 'cleanup');
      }

      if (staleClients.length > 0) {
        this.logger.info(`🧹 Cleaned up ${staleClients.length} stale connections`);
      }

    } catch (error) {
      this.logger.error('Failed to cleanup stale connections:', error);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalClients: number;
    clientsByType: { [key: string]: number };
    activeRooms: number;
    averageClientsPerRoom: number;
    uptime: number;
  } {
    const clientsByType = { proctor: 0, session: 0, service: 0 };
    
    for (const client of this.clients.values()) {
      clientsByType[client.type] = (clientsByType[client.type] || 0) + 1;
    }

    const totalRoomMembers = Array.from(this.rooms.values()).reduce(
      (sum, room) => sum + room.size, 0
    );

    return {
      totalClients: this.clients.size,
      clientsByType,
      activeRooms: this.rooms.size,
      averageClientsPerRoom: this.rooms.size > 0 ? totalRoomMembers / this.rooms.size : 0,
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown WebSocket server gracefully
   */
  async shutdown(): Promise<void> {
    try {
      if (this.wsServer) {
        // Close all connections
        for (const client of this.clients.values()) {
          client.websocket.close(1001, 'Server shutdown');
        }

        // Close server
        this.wsServer.close(() => {
          this.logger.info('🔌 WebSocket server shut down');
        });
      }
    } catch (error) {
      this.logger.error('Failed to shutdown WebSocket server:', error);
    }
  }
}