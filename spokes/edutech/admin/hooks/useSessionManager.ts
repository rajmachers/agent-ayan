import { useEffect, useState, useCallback, useRef } from 'react';

interface Session {
  sessionId: string;
  shortId?: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  status: 'active' | 'completed' | 'terminated' | 'abandoned' | 'idle-yellow' | 'idle-amber' | 'idle-red';
  startedAt: Date;
  completedAt?: Date;
  lastActivity?: Date;
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

interface UseSessionManagerOptions {
  organizationId?: string;
  autoConnect?: boolean;
}

interface UseSessionManagerReturn {
  sessions: Session[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  refreshSessions: () => void;
}

export function useSessionManager(options: UseSessionManagerOptions = {}): UseSessionManagerReturn {
  const { organizationId, autoConnect = true } = options;
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use ref-based handler so the websocket always calls the latest version
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'sessions:list':
        setSessions(message.data || []);
        break;
      
      case 'session:new':
        setSessions(prev => {
          // Avoid duplicates
          if (prev.some(s => s.sessionId === message.data.sessionId)) return prev;
          return [message.data, ...prev];
        });
        break;
      
      case 'session:updated':
        setSessions(prev => {
          const idx = prev.findIndex(s => s.sessionId === message.data.sessionId);
          if (idx === -1) return [message.data, ...prev]; // New session we haven't seen
          const next = [...prev];
          next[idx] = message.data; // Full replacement with server-authoritative data
          return next;
        });
        break;
      
      case 'session:ended':
        setSessions(prev => prev.map(session => 
          session.sessionId === message.data.sessionId ? message.data : session
        ));
        break;
      
      case 'violation:new':
        // Don't process — session:updated (which follows immediately) has the full state
        break;

      // Phase 6: Handle agent actions and proctor notifications
      case 'session:flagged':
      case 'agent:action':
      case 'agent:suggestion':
        // These get reflected through session:updated, but we can trigger browser notifications
        if (message.data) {
          try {
            if (Notification.permission === 'granted') {
              const title = message.type === 'agent:suggestion' ? '🤖 Agent Suggestion' :
                            message.type === 'session:flagged' ? '🚩 Session Flagged' : '⚡ Agent Action';
              const body = message.data.reason || message.data.message || 'Check dashboard for details';
              new Notification(title, { body, icon: '/favicon.ico', tag: message.sessionId || 'agent' });
            }
          } catch { /* notifications not supported */ }
        }
        break;

      case 'proctor:notification':
        // Browser push notification for high-risk events
        if (message.data) {
          try {
            if (Notification.permission === 'granted') {
              new Notification(message.data.title || 'Proctor Alert', {
                body: message.data.message,
                icon: '/favicon.ico',
                tag: `proctor-${message.data.sessionId}`,
                requireInteraction: message.data.severity === 'critical',
              });
            }
          } catch { /* notifications not supported */ }
        }
        break;

      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const wsUrl = new URL('ws://localhost:8181');
      wsUrl.searchParams.set('type', 'admin');
      if (organizationId) {
        wsUrl.searchParams.set('organizationId', organizationId);
      }
      
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('🔗 Connected to Session Manager');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        websocket.send(JSON.stringify({ type: 'admin:request_sessions' }));
      };
      
      websocket.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch (err) {
          console.error('❌ Parse error:', err);
        }
      };
      
      websocket.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        
        if (autoConnect) {
          reconnectRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
      
      websocket.onerror = () => {
        setError('Failed to connect to session manager');
        setIsConnecting(false);
      };
      
      wsRef.current = websocket;
      
    } catch (err) {
      setError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  }, [organizationId, autoConnect, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const refreshSessions = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'admin:request_sessions' }));
    }
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => { disconnect(); };
  }, [autoConnect]);

  return { sessions, isConnected, isConnecting, error, connect, disconnect, refreshSessions };
}