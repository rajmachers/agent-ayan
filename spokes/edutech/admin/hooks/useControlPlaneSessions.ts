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

const SESSIONS_API_PATH = '/api/sessions';

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
      const tenantRaw = typeof window !== 'undefined' ? localStorage.getItem('tenant_session') : null;
      const tenantSession = tenantRaw ? JSON.parse(tenantRaw) : null;
      const organizationId = tenantSession?.organizationId;

      const params = new URLSearchParams();
      if (organizationId) {
        params.set('organizationId', organizationId);
      }

      const url = params.toString() ? `${SESSIONS_API_PATH}?${params.toString()}` : SESSIONS_API_PATH;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
