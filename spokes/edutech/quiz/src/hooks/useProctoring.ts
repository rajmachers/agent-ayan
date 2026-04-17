import { useEffect, useState, useCallback, useRef } from 'react';

interface ViolationTrigger {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  confidence?: number;
  source?: string;
  metadata?: any;
}

interface UseProctoringOptions {
  candidateId: string;
  examId: string;
  organizationId: string;
  autoConnect?: boolean;
  enableSimulation?: boolean;
}

interface UseProctoringReturn {
  sessionId: string | null;
  isConnected: boolean;
  isSessionActive: boolean;
  violations: any[];
  credibilityScore: number;
  riskLevel: string;
  isVideoReady: boolean;
  isInWarmupPeriod: boolean;
  startSession: () => void;
  endSession: () => void;
  triggerViolation: (violation: ViolationTrigger) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useProctoring(options: UseProctoringOptions): UseProctoringReturn {
  const { candidateId, examId, organizationId, autoConnect = true, enableSimulation = false } = options;
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [violations, setViolations] = useState<any[]>([]);
  const [credibilityScore, setCredibilityScore] = useState(95);
  const [riskLevel, setRiskLevel] = useState('low');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionKey] = useState(() => `${candidateId}-${examId}-${organizationId}`); // Stable connection ID
  
  // State for video readiness and timing
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const behaviorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoInitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (isConnected || ws) {
      console.log(`🔧 DEBUG: Already connected [${connectionKey}], skipping...`);
      return;
    }
    
    console.log(`🔧 DEBUG: Initiating WebSocket connection for [${connectionKey}]...`);
    
    try {
      const wsUrl = new URL('ws://localhost:8080');
      wsUrl.searchParams.set('type', 'candidate');
      wsUrl.searchParams.set('organizationId', organizationId);
      wsUrl.searchParams.set('connectionKey', connectionKey); // Add unique identifier
      
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log(`🔗 Candidate connected [${connectionKey}] to Session Manager`);
        setIsConnected(true);
      };
      
      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      websocket.onclose = () => {
        console.log(`❌ WebSocket connection closed [${connectionKey}]`);
        setIsConnected(false);
        setWs(null);
        
        // Auto-reconnect only if session is still active
        if (autoConnect && isSessionActive) {
          console.log(`🔄 Attempting to reconnect [${connectionKey}] in 3 seconds...`);
          setTimeout(() => {
            if (!isConnected && isSessionActive) connect();
          }, 3000);
        }
      };
      
      websocket.onerror = (error) => {
        console.error(`❌ WebSocket error [${connectionKey}]:`, error);
      };
      
      setWs(websocket);
      
    } catch (error) {
      console.error(`❌ Error creating WebSocket [${connectionKey}]:`, error);
    }
  }, [organizationId, autoConnect, isConnected, ws, isSessionActive, connectionKey]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
    }
    setIsConnected(false);
    stopSimulation();
  }, [ws]);

  const startSession = useCallback(() => {
    console.log(`🎯 DEBUG: startSession called [${connectionKey}].`);
    console.log('🎯 DEBUG: WebSocket state:', ws ? ws.readyState : 'null');
    console.log('🎯 DEBUG: isConnected:', isConnected);
    console.log('🎯 DEBUG: isSessionActive:', isSessionActive);
    
    if (isSessionActive) {
      console.log(`⚠️ DEBUG: Session already active [${connectionKey}], skipping startSession`);
      return;
    }
    
    if (!ws || !isConnected) {
      console.error(`❌ DEBUG: Not connected to session manager [${connectionKey}]`);
      return;
    }
    
    const sessionData = {
      type: 'session:start',
      data: {
        candidateId,
        examId,
        organizationId,
        totalQuestions: 20,
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          batchId: 'live_session_batch',
          connectionKey // Include connection key for tracking
        }
      }
    };
    
    console.log(`📤 DEBUG: Sending session start [${connectionKey}]:`, sessionData);
    ws.send(JSON.stringify(sessionData));
  }, [ws, isConnected, candidateId, examId, organizationId, isSessionActive, connectionKey]);

  const endSession = useCallback(() => {
    if (!ws || !sessionId) return;
    
    ws.send(JSON.stringify({
      type: 'session:end',
      sessionId
    }));
    
    setIsSessionActive(false);
    stopSimulation();
  }, [ws, sessionId]);

  const triggerViolation = useCallback((violation: ViolationTrigger) => {
    console.log('🚨 DEBUG: triggerViolation called:', violation);
    console.log('🚨 DEBUG: WebSocket state:', ws ? ws.readyState : 'null', 'SessionId:', sessionId);
    
    if (!ws || !sessionId) {
      console.error('❌ DEBUG: Cannot trigger violation - no WebSocket or sessionId');
      return;
    }
    
    const violationData = {
      type: 'violation:trigger',
      sessionId,
      data: {
        ...violation,
        confidence: violation.confidence || Math.floor(Math.random() * 20 + 75),
        source: violation.source || 'candidate-behavior'
      }
    };
    
    console.log('📤 DEBUG: Sending violation data:', violationData);
    ws.send(JSON.stringify(violationData));
  }, [ws, sessionId]);

  const handleMessage = (message: any) => {
    console.log('📥 DEBUG: Received WebSocket message:', message);
    
    switch (message.type) {
      case 'session:started':
        console.log('🎯 DEBUG: Session started successfully:', message.sessionId);
        setSessionId(message.sessionId);
        setIsSessionActive(true);
        setSessionStartTime(Date.now());
        console.log('🎯 Session started:', message.sessionId);
        
        // Start video initialization check
        initializeVideoSystem();
        
        if (enableSimulation) {
          // Delay simulation start to allow proper setup
          setTimeout(() => {
            if (isSessionActive) {
              startSimulation();
            }
          }, 3000); // 3-second warmup period
        }
        break;
      
      case 'session:updated':
        console.log('📊 DEBUG: Session updated:', message.data);
        if (message.data.credibilityScore !== undefined) {
          setCredibilityScore(message.data.credibilityScore);
        }
        if (message.data.riskLevel !== undefined) {
          setRiskLevel(message.data.riskLevel);
        }
        if (message.data.violations !== undefined) {
          setViolations(message.data.violations);
        }
        break;
      
      case 'violation:alert':
        console.log('🚨 DEBUG: Violation alert received:', message.data);
        // Update local state with real-time data
        setCredibilityScore(message.data.credibilityScore);
        
        // Show alert notification (will implement UI component)
        showViolationAlert(message.data);
        break;
      
      case 'violation:warning':
        console.log('⚠️ Violation warning received:', message.data);
        // Show warning to candidate
        break;
        
      default:
        console.log('📥 DEBUG: Unknown message type:', message.type);
        break;
    }
  };

  // Function to show violation alerts to candidate  
  const showViolationAlert = (alertData: any) => {
    // Create a temporary alert state
    const alertId = Math.random().toString(36).substr(2, 9);
    
    // You can implement this with toast notifications or modal
    console.log(`🔔 ALERT for candidate: ${alertData.message} (${alertData.severity})`);
    console.log(`📉 Updated credibility: ${alertData.credibilityScore}%`);
    
    // Future: Implement actual UI notification here
    // For now, we'll add this to violations list for visibility
    setViolations(prev => [...prev, {
      ...alertData,
      id: alertId,
      timestamp: alertData.timestamp || new Date().toISOString(),
      isAlert: true
    }]);
  };

  const initializeVideoSystem = () => {
    console.log('📹 Initializing video system...');
    
    // Simulate video system initialization
    videoInitTimeoutRef.current = setTimeout(() => {
      setIsVideoReady(true);
      console.log('✅ Video system ready for violation detection');
      
      // Additional delay to ensure complete warmup
      setTimeout(() => {
        console.log('🎯 Warmup period completed - full monitoring active');
      }, 3000); // Additional 3 seconds after video ready
      
    }, 2000); // 2-second video init time
  };

  const isInWarmupPeriod = () => {
    if (!sessionStartTime) return true;
    const elapsed = Date.now() - sessionStartTime;
    const warmupComplete = elapsed >= 5000 && isVideoReady;
    
    if (elapsed >= 5000 && !warmupComplete) {
      console.log('⚠️ Warmup period expired but video not ready yet');
    }
    
    return !warmupComplete;
  };

  const startSimulation = () => {
    console.log('🤖 Starting violation simulation (with proper timing)');
    
    // Random violation triggers with timing controls
    simulationIntervalRef.current = setInterval(() => {
      if (!isSessionActive) return;
      
      const isWarmup = isInWarmupPeriod();
      
      const violationTypes = [
        // Non-video violations (can trigger immediately)
        { type: 'tab-switch', severity: 'warning' as const, description: 'Switched to another browser tab', chance: 0.25, requiresVideo: false },
        { type: 'unauthorized-device', severity: 'warning' as const, description: 'Unauthorized device detected', chance: 0.1, requiresVideo: false },
        { type: 'audio-anomaly', severity: 'info' as const, description: 'Background conversation detected', chance: 0.2, requiresVideo: false },
        { type: 'screen-share', severity: 'critical' as const, description: 'Screen sharing detected', chance: 0.05, requiresVideo: false },
        { type: 'fullscreen-exit', severity: 'warning' as const, description: 'Exited fullscreen mode', chance: 0.15, requiresVideo: false },
        
        // Video-dependent violations (only after video is ready and warmup period)
        { type: 'face-not-visible', severity: 'critical' as const, description: 'Face not clearly visible in camera feed', chance: 0.12, requiresVideo: true },
        { type: 'multiple-faces', severity: 'critical' as const, description: 'Multiple faces detected in frame', chance: 0.06, requiresVideo: true },
        { type: 'suspicious-behavior', severity: 'warning' as const, description: 'Unusual eye movement patterns detected', chance: 0.15, requiresVideo: true }
      ];
      
      violationTypes.forEach(vType => {
        // Skip video violations if video not ready or in warmup
        if (vType.requiresVideo && (!isVideoReady || isWarmup)) {
          return;
        }
        
        if (Math.random() < vType.chance / 12) { // Reduced frequency further
          triggerViolation({
            type: vType.type,
            severity: vType.severity,
            description: vType.description,
            confidence: Math.floor(Math.random() * 25 + 70),
            source: vType.requiresVideo ? 'ai-vision' : 'ai-behavior'
          });
        }
      });
    }, 10000); // Check every 10 seconds (reduced frequency)

    // Behavioral simulation (quiz progression)
    behaviorIntervalRef.current = setInterval(() => {
      if (!ws || !sessionId || !isSessionActive) return;
      
      ws.send(JSON.stringify({
        type: 'session:update',
        data: {
          currentQuestion: Math.floor(Math.random() * 20) + 1,
          score: Math.floor(Math.random() * 40 + 60)
        }
      }));
    }, 15000); // Update progress every 15 seconds
  };

  const stopSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (behaviorIntervalRef.current) {
      clearInterval(behaviorIntervalRef.current);
      behaviorIntervalRef.current = null;
    }
    if (videoInitTimeoutRef.current) {
      clearTimeout(videoInitTimeoutRef.current);
      videoInitTimeoutRef.current = null;
    }
    setIsVideoReady(false);
    setSessionStartTime(null);
  };

  // Auto-detect tab switches (real violation detection)
  useEffect(() => {
    console.log('🔧 DEBUG: Setting up event listeners. isSessionActive:', isSessionActive);
    
    const handleVisibilityChange = () => {
      console.log('🔧 DEBUG: Visibility change detected. hidden:', document.hidden, 'isSessionActive:', isSessionActive);
      if (document.hidden && isSessionActive) {
        console.log('🚨 DEBUG: Triggering tab-switch violation!');
        triggerViolation({
          type: 'tab-switch',
          severity: 'warning',
          description: 'Candidate switched away from the exam tab',
          source: 'browser-api'
        });
      }
    };

    const handleBlur = () => {
      console.log('🔧 DEBUG: Window blur detected. isSessionActive:', isSessionActive);
      if (isSessionActive) {
        console.log('🚨 DEBUG: Triggering focus-lost violation!');
        triggerViolation({
          type: 'focus-lost',
          severity: 'warning',
          description: 'Exam window lost focus',
          source: 'browser-api'
        });
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      console.log('🔧 DEBUG: Keydown detected:', e.key, 'isSessionActive:', isSessionActive);
      if (isSessionActive) {
        // Detect common cheat key combinations
        if (e.ctrlKey && (e.key === 't' || e.key === 'n' || e.key === 'w')) {
          triggerViolation({
            type: 'suspicious-keypress',
            severity: 'warning',
            description: `Suspicious keyboard shortcut detected: Ctrl+${e.key.toUpperCase()}`,
            source: 'browser-api',
            metadata: { key: e.key, ctrlKey: e.ctrlKey }
          });
        }
        
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
          triggerViolation({
            type: 'developer-tools',
            severity: 'critical',
            description: 'Attempted to open developer tools',
            source: 'browser-api'
          });
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      console.log('🔧 DEBUG: Right-click detected. isSessionActive:', isSessionActive);
      if (isSessionActive) {
        console.log('🚨 DEBUG: Triggering right-click violation!');
        e.preventDefault(); // Prevent context menu
        triggerViolation({
          type: 'right-click',
          severity: 'warning',
          description: 'Right-click detected during exam',
          source: 'browser-api'
        });
      }
    };

    console.log('🔧 DEBUG: Adding event listeners...');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      console.log('🔧 DEBUG: Removing event listeners...');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('contextmenu', handleContextMenu);
      stopSimulation();
    };
  }, [isSessionActive, triggerViolation]);

  useEffect(() => {
    if (autoConnect && !ws && !isConnected) {
      console.log('🔧 DEBUG: Initial connection attempt on mount...');
      connect();
    }
    
    return () => {
      console.log('🔧 DEBUG: Cleaning up on unmount...');
      disconnect();
    };
  }, []); // Only run on mount/unmount

  return {
    sessionId,
    isConnected,
    isSessionActive,
    violations,
    credibilityScore,
    riskLevel,
    isVideoReady,
    isInWarmupPeriod: isInWarmupPeriod(),
    startSession,
    endSession,
    triggerViolation,
    connect,
    disconnect
  };
}