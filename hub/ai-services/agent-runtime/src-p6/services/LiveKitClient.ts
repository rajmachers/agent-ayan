import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  Track,
  ConnectionQuality,
} from 'livekit-server-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface LiveKitClientEvents {
  connected: (room: Room) => void;
  disconnected: (reason?: string) => void;
  participantConnected: (participant: RemoteParticipant) => void;
  participantDisconnected: (participant: RemoteParticipant) => void;
  trackSubscribed: (track: RemoteTrack, participant: RemoteParticipant) => void;
  trackUnsubscribed: (track: RemoteTrack, participant: RemoteParticipant) => void;
  videoFrame: (frame: Buffer, participant: RemoteParticipant, track: RemoteVideoTrack) => void;
  audioData: (data: Buffer, participant: RemoteParticipant, track: RemoteAudioTrack) => void;
  error: (error: Error) => void;
}

export class LiveKitClient extends EventEmitter {
  private room: Room | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private sessionId: string,
    private roomName: string,
    private agentId: string
  ) {
    super();
    this.setupRoom();
  }

  private setupRoom() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: false,
        stopMicTrackOnMute: true,
      },
    });

    // Room event handlers
    this.room
      .on(RoomEvent.Connected, () => {
        logger.info('LiveKit room connected', {
          sessionId: this.sessionId,
          roomName: this.roomName,
          agentId: this.agentId,
        });
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', this.room!);
      })
      .on(RoomEvent.Disconnected, (reason) => {
        logger.warn('LiveKit room disconnected', {
          sessionId: this.sessionId,
          reason,
          agentId: this.agentId,
        });
        this.stopHeartbeat();
        this.emit('disconnected', reason);
        this.handleReconnect();
      })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        logger.info('Participant connected to room', {
          sessionId: this.sessionId,
          participantId: participant.identity,
          participantName: participant.name,
        });
        this.emit('participantConnected', participant);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        logger.info('Participant disconnected from room', {
          sessionId: this.sessionId,
          participantId: participant.identity,
          participantName: participant.name,
        });
        this.emit('participantDisconnected', participant);
      })
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        logger.debug('Track subscribed', {
          sessionId: this.sessionId,
          participantId: participant.identity,
          trackKind: track.kind,
          trackSource: track.source,
        });

        this.emit('trackSubscribed', track, participant);

        // Handle video tracks for frame processing
        if (track.kind === Track.Kind.Video && track instanceof RemoteVideoTrack) {
          this.handleVideoTrack(track, participant);
        }

        // Handle audio tracks for processing
        if (track.kind === Track.Kind.Audio && track instanceof RemoteAudioTrack) {
          this.handleAudioTrack(track, participant);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        logger.debug('Track unsubscribed', {
          sessionId: this.sessionId,
          participantId: participant.identity,
          trackKind: track.kind,
        });
        this.emit('trackUnsubscribed', track, participant);
      })
      .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (quality === ConnectionQuality.Poor) {
          logger.warn('Poor connection quality detected', {
            sessionId: this.sessionId,
            participantId: participant?.identity || 'unknown',
            quality,
          });
        }
      })
      .on(RoomEvent.RoomMetadataChanged, (metadata) => {
        logger.debug('Room metadata changed', {
          sessionId: this.sessionId,
          metadata,
        });
      });
  }

  private handleVideoTrack(track: RemoteVideoTrack, participant: RemoteParticipant) {
    // Set up frame extraction for AI processing
    const frameInterval = setInterval(() => {
      if (track.receiver) {
        try {
          // Extract frame data - this would need actual implementation
          // For now, we'll emit a mock frame event
          const mockFrameData = Buffer.from('mock-frame-data');
          this.emit('videoFrame', mockFrameData, participant, track);
        } catch (error) {
          logger.error('Error extracting video frame', {
            sessionId: this.sessionId,
            participantId: participant.identity,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, config.agent.frameProcessingIntervalMs);

    // Clean up interval when track is unsubscribed
    track.on(Track.Events.Ended, () => {
      clearInterval(frameInterval);
    });
  }

  private handleAudioTrack(track: RemoteAudioTrack, participant: RemoteParticipant) {
    // Set up audio data extraction for processing
    try {
      // Audio processing would be implemented here
      // For now, we'll emit mock audio data
      setInterval(() => {
        const mockAudioData = Buffer.from('mock-audio-data');
        this.emit('audioData', mockAudioData, participant, track);
      }, 1000); // Process audio every second
    } catch (error) {
      logger.error('Error setting up audio processing', {
        sessionId: this.sessionId,
        participantId: participant.identity,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.room && this.room.isConnected) {
        logger.debug('LiveKit heartbeat', {
          sessionId: this.sessionId,
          participants: this.room.remoteParticipants.size,
          agentId: this.agentId,
        });
      }
    }, config.agent.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= config.agent.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', {
        sessionId: this.sessionId,
        attempts: this.reconnectAttempts,
      });
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.info('Attempting to reconnect to LiveKit', {
      sessionId: this.sessionId,
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  async connect(): Promise<void> {
    if (this.isConnecting || (this.room && this.room.isConnected)) {
      return;
    }

    this.isConnecting = true;

    try {
      // Generate access token for agent
      const token = await this.generateAgentToken();
      
      // Connect to room
      await this.room!.connect(config.livekit.wsUrl, token);
      
      logger.info('Successfully connected agent to LiveKit room', {
        sessionId: this.sessionId,
        roomName: this.roomName,
        agentId: this.agentId,
      });
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to connect to LiveKit room', {
        sessionId: this.sessionId,
        roomName: this.roomName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.emit('error', error instanceof Error ? error : new Error('Connection failed'));
      this.handleReconnect();
    }
  }

  private async generateAgentToken(): Promise<string> {
    // This would generate a JWT token for the agent to connect to LiveKit
    // For now, return a placeholder - would need actual LiveKit token generation
    return `agent_token_${this.agentId}_${Date.now()}`;
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    
    logger.info('Agent disconnected from LiveKit room', {
      sessionId: this.sessionId,
      agentId: this.agentId,
    });
  }

  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.room && this.room.isConnected) return 'connected';
    return 'disconnected';
  }

  getRoomInfo() {
    if (!this.room) return null;
    
    return {
      name: this.room.name,
      numParticipants: this.room.remoteParticipants.size,
      isConnected: this.room.state === 'connected',
      connectionState: this.room.state,
    };
  }
}