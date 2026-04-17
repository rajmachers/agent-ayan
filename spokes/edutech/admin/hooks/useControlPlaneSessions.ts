import { useEffect, useState, useRef, useCallback } from 'react';

interface SessionCandidate {
  id: string;
  name: string;
  email: string;
  score: number;
  zScore: number;
  percentile: number;
  violations: any[];
  status: string;
}

interface Session {
  sessionId: string;
  tenantId?: string;
  tenantName?: string;
  batchId?: string;
  examType?: string;
  scenario?: string;
  status: 'active' | 'paused' | 'completed' | 'terminated' | 'initializing' | 'locked';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  violationCount: number;
  violations?: any[];
  candidateCount: number;
  candidates?: SessionCandidate[];
  score: number;
}

interface UseControlPlaneSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
}

const CONTROL_PLANE_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || 'http://localhost:4101';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'demo-key';

export function useControlPlaneSessions(
  autoRefresh = true,
  refreshInterval = 3000
): UseControlPlaneSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${CONTROL_PLANE_URL}/api/v1/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      } else {
        setSessions([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(message);
      console.error('Error fetching sessions:', err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchSessions();

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSessions, refreshInterval);
    }

    return () => {
      // Cleanup interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refreshSessions: fetchSessions,
  };
}
