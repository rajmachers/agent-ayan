import { useState, useEffect, useCallback } from 'react';

export interface PlatformStats {
  activeSessions: number;
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  idleSessions: number;
  totalViolations: number;
  avgCredibility: number;
  sessions: any[];
  // System metrics (real from process)
  cpuUsage: number;
  memoryUsage: number;
  uptimeSeconds: number;
  // Per-source violation counts
  browserViolations: number;
  visionViolations: number;
  audioViolations: number;
  behaviorViolations: number;
  // Violation type breakdown
  violationBreakdown: Record<string, number>;
  // Per-org stats
  orgStats: Array<{
    organizationId: string;
    name: string;
    sessions: number;
    violations: number;
    status: string;
    lastActivity: string;
  }>;
}

const ORG_NAMES: Record<string, string> = {
  '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94': 'Computer Science Department',
  '123e4567-e89b-12d3-a456-426614174000': 'Engineering College',
  '987fcdeb-51a2-43d7-8f9e-123456789abc': 'Business School',
};

function computeStats(sessions: any[]): PlatformStats {
  const active = sessions.filter(s => s.status === 'active');
  const completed = sessions.filter(s => s.status === 'completed');
  const abandoned = sessions.filter(s => s.status === 'abandoned');
  const idle = sessions.filter(s => s.status?.startsWith('idle-'));

  const allViolations = sessions.flatMap(s => s.violations || []);
  const totalViolations = allViolations.length;

  const avgCredibility = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.credibilityScore || 100), 0) / sessions.length)
    : 100;

  const browserViolations = allViolations.filter(v => v.source === 'browser-monitor').length;
  const visionViolations = allViolations.filter(v => v.source === 'ai-vision').length;
  const audioViolations = allViolations.filter(v => v.source === 'ai-audio').length;
  const behaviorViolations = allViolations.filter(v => v.source === 'ai-behavior').length;

  const violationBreakdown: Record<string, number> = {};
  allViolations.forEach(v => {
    const label = (v.type || 'unknown').replace(/_/g, ' ');
    violationBreakdown[label] = (violationBreakdown[label] || 0) + 1;
  });

  // Per-org
  const orgMap: Record<string, { sessions: number; violations: number; lastActivity: string }> = {};
  sessions.forEach(s => {
    const oid = s.organizationId || 'unknown';
    if (!orgMap[oid]) orgMap[oid] = { sessions: 0, violations: 0, lastActivity: '' };
    orgMap[oid].sessions++;
    orgMap[oid].violations += (s.violations || []).length;
    const la = s.lastActivity || s.startedAt || '';
    if (la > orgMap[oid].lastActivity) orgMap[oid].lastActivity = la;
  });

  const orgStats = Object.entries(orgMap).map(([oid, data]) => ({
    organizationId: oid,
    name: ORG_NAMES[oid] || oid.slice(0, 8),
    sessions: data.sessions,
    violations: data.violations,
    status: 'active',
    lastActivity: data.lastActivity,
  }));

  return {
    activeSessions: active.length + idle.length,
    totalSessions: sessions.length,
    completedSessions: completed.length,
    abandonedSessions: abandoned.length,
    idleSessions: idle.length,
    totalViolations,
    avgCredibility,
    sessions,
    cpuUsage: 0,
    memoryUsage: 0,
    uptimeSeconds: 0,
    browserViolations,
    visionViolations,
    audioViolations,
    behaviorViolations,
    violationBreakdown,
    orgStats,
  };
}

export function usePlatformStats(refreshMs = 3000) {
  const [stats, setStats] = useState<PlatformStats>(computeStats([]));
  const [connected, setConnected] = useState(false);

  const fetchStats = useCallback(() => {
    // One-shot WebSocket to get all sessions
    try {
      const ws = new WebSocket('ws://localhost:8081?type=admin');
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'admin:request_sessions' }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'sessions:list') {
            setStats(computeStats(msg.data || []));
            setConnected(true);
            ws.close();
          }
        } catch {}
      };
      ws.onerror = () => { setConnected(false); };
      ws.onclose = () => {};
    } catch { setConnected(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, refreshMs);
    return () => clearInterval(iv);
  }, [fetchStats, refreshMs]);

  return { stats, connected, refresh: fetchStats };
}
