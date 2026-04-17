'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Activity, Users, Shield, AlertTriangle, 
  Clock, Eye, Mic, Brain, ChevronRight,
  Search, Filter, MoreVertical, LogOut,
  RefreshCw, User, Building2, Settings,
  Globe, UserPlus, BarChart3, Cog,
  Database, Package, Zap, Wifi, WifiOff,
  PauseCircle, PlayCircle, XCircle, Lock, Bell, Sparkles,
  BriefcaseBusiness, Handshake, Landmark, ClipboardCheck
} from 'lucide-react';
import { useControlPlaneSessions } from '../../../../hooks/useControlPlaneSessions';

// Super Admin Components
import SuperAdminNav from '../components/SuperAdminNav';
import SuperAdminDashboard from '../components/SuperAdminDashboard';
import TenantManagement from '../components/TenantManagement';
import Analytics from '../components/Analytics';
import GlobalSettings from '../components/GlobalSettings';
import SystemMonitor from '../components/SystemMonitor';
import Integrations from '../components/Integrations';

interface TenantSession {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationType: 'tenant' | 'system-admin';
  role: string;
  features: string[];
  loginTime: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [examFilter, setExamFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionTab, setSessionTab] = useState<'live' | 'past'>('live');
  const [hybridTeamView, setHybridTeamView] = useState<'admin' | 'proctor' | 'account-manager' | 'finance' | 'opg'>('admin');
  const [activeView, setActiveView] = useState<'tenant-admin' | 'super-admin'>('tenant-admin');
  const [superAdminActiveView, setSuperAdminActiveView] = useState('dashboard');
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [terminateDialog, setTerminateDialog] = useState<{ open: boolean; sessionId: string | null; candidateId?: string }>({
    open: false,
    sessionId: null,
  });

  // Detect if user is super admin
  const isSuperAdmin = tenantSession?.organizationType === 'system-admin';

  // Fetch live sessions from Control Plane
  const {
    sessions: controlPlaneSessions,
    isLoading: cpLoading,
    error: cpError,
    refreshSessions
  } = useControlPlaneSessions(true, 3000);

  // Helper to categorize sessions
  const isSessionLive = (status: string): boolean => {
    return status === 'active' || status === 'paused' || status === 'locked';
  };

  // Export sessions to CSV
  const exportSessionsToCSV = (dataToExport: any[], filename: string) => {
    const headers = ['Candidate', 'Exam', 'Status', 'Risk Level', 'Credibility %', 'Violations', 'Duration', 'Started'];
    
    const csv = [
      headers.join(','),
      ...dataToExport.map(row =>
        [
          `"${row.candidateId}"`,
          `"${row.examId}"`,
          `"${getStatusLabel(row.status)}"`,
          `"${row.riskLevel}"`,
          `${Math.round(row.credibilityScore * 100)}`,
          row.violations.length,
          `"${row.duration || 'N/A'}"`,
          `"${formatTimestamp(row.startedAt)}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const normalizeSessionStatus = (status: unknown): string => {
    const raw = String(status || 'active').toLowerCase();
    if (raw === 'stopped') return 'terminated';
    if (raw === 'complete') return 'completed';
    return raw;
  };

  const normalizeCredibility = (value: unknown): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric <= 1) return Math.max(0, Math.min(1, numeric));
    return Math.max(0, Math.min(1, numeric / 100));
  };

  const deriveRiskLevel = (credibility: number, violationCount: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (violationCount >= 8 || credibility < 0.35) return 'critical';
    if (violationCount >= 5 || credibility < 0.55) return 'high';
    if (violationCount >= 2 || credibility < 0.8) return 'medium';
    return 'low';
  };

  const getBaseSessionId = (sessionId: string): string => {
    const marker = '__c';
    const markerIndex = sessionId.lastIndexOf(marker);
    return markerIndex === -1 ? sessionId : sessionId.slice(0, markerIndex);
  };

  const handleTerminateSession = async () => {
    if (!terminateDialog.sessionId) return;

    try {
      const baseSessionId = getBaseSessionId(terminateDialog.sessionId);
      const response = await fetch(`${process.env.NEXT_PUBLIC_HUB_GATEWAY_URL || 'http://localhost:14001'}/api/v1/sessions/${baseSessionId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to terminate session');
      }

      await refreshSessions();
    } catch (error) {
      console.error('Failed to terminate session:', error);
    } finally {
      setTerminateDialog({ open: false, sessionId: null });
    }
  };

  // Convert Control Plane sessions to expected format
  const sessions = controlPlaneSessions.map((s: any) => {
    const resolvedStatus = normalizeSessionStatus(s.status);
    const violationCount = Number(s.violationCount ?? (Array.isArray(s.violations) ? s.violations.length : 0));
    const credibilityScore = normalizeCredibility(s.credibilityScore ?? s.score?.credibilityIndex ?? s.score?.current);
    const riskLevel = s.riskLevel || deriveRiskLevel(credibilityScore, violationCount);
    
    return {
      sessionId: s.sessionId,
      shortId: s.sessionId?.substring(8, 16),
      candidateId: s.candidateId || 'batch-' + (s.batchId || 'unknown'),
      examId: s.examType || 'simulator',
      organizationId: s.tenantId || '',
      status: resolvedStatus,
      startedAt: new Date(s.startedAt || s.createdAt),
      completedAt: s.endedAt ? new Date(s.endedAt) : undefined,
      elapsedSeconds: Number.isFinite(Number(s.duration)) ? Number(s.duration) : undefined,
      lastActivity: new Date(),
      score: s.score || 0,
      credibilityScore,
      riskLevel,
      violations: s.violations || [],
      currentQuestion: undefined,
      totalQuestions: undefined,
      metadata: {
        tenantName: s.tenantName,
        batchId: s.batchId,
        scenario: s.scenario,
        candidates: s.candidates || [],
      },
      batchId: s.batchId,
      candidatesCount: s.candidateCount || 0,
      violationCount,
    };
  });

  // Flatten sessions into individual candidate rows
  const candidateRows = sessions.flatMap((session: any) => {
    const candidates = session.metadata?.candidates || [];

    if (session.sessionId?.includes('__c')) {
      return [{ ...session, candidateData: null }];
    }
    
    if (candidates.length === 0) {
      // If no candidates array, show session as single row
      return [{ ...session, candidateData: null }];
    }
    
    // Create one row per candidate with session-level violation data
    return candidates.map((candidate: any, idx: number) => ({
      ...session,
      candidateData: candidate,
      candidateId: candidate.email || candidate.name || candidate.id || `Candidate ${idx + 1}`,
      score: candidate.score || 0,
      credibilityScore: normalizeCredibility(candidate.score ?? session.credibilityScore),
      riskLevel: candidate.riskLevel || deriveRiskLevel(normalizeCredibility(candidate.score ?? session.credibilityScore), candidate.violations?.length || session.violationCount || 0),
      violations: candidate.violations || session.violations || [],
      violationCount: (candidate.violations?.length || 0) || session.violationCount || (session.violations?.length || 0),
      rowKey: `${session.sessionId}-${candidate.id || idx}`
    }));
  });

  useEffect(() => {
    setMounted(true);
    // Check authentication
    const sessionData = localStorage.getItem('tenant_session');
    if (!sessionData) {
      router.push('/admin/login');
      return;
    }
    
    try {
      const session = JSON.parse(sessionData);
      setTenantSession(session);
      setLoading(false);
    } catch {
      router.push('/admin/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('tenant_session');
    router.push('/admin/login');
  };
  
  const handleRefresh = () => {
    refreshSessions();
  };

  // Filter candidate rows based on current filters
  const filteredSessions = candidateRows.filter((row: any) => {
    if (filter !== 'all') {
      if (filter === 'idle') {
        if (!row.status.startsWith('idle-')) return false;
      } else if (row.status !== filter) return false;
    }
    if (examFilter && !row.examId.toLowerCase().includes(examFilter.toLowerCase())) return false;
    if (batchFilter && !row.batchId?.toLowerCase().includes(batchFilter.toLowerCase())) return false;
    if (searchTerm && !row.candidateId.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Separate into live and past sessions
  const liveSessions = filteredSessions.filter(s => isSessionLive(s.status));
  const pastSessions = filteredSessions.filter(s => !isSessionLive(s.status));

  // Sort appropriately
  const sortByPriority = (sessions: any[]) => {
    return [...sessions].sort((a, b) => {
      const priorityOrder: Record<string, number> = { locked: 0, paused: 1, terminated: 2, active: 3, 'idle-red': 4, 'idle-amber': 5, 'idle-yellow': 6, completed: 7, abandoned: 8 };
      const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.status] ?? 9;
      const bPriority = priorityOrder[b.status] ?? 9;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aRisk = riskOrder[a.riskLevel] ?? 9;
      const bRisk = riskOrder[b.riskLevel] ?? 9;
      if (aRisk !== bRisk) return aRisk - bRisk;
      return a.credibilityScore - b.credibilityScore;
    });
  };

  const sortedSessions = sessionTab === 'live' ? sortByPriority(liveSessions) : sortByPriority(pastSessions);

  const criticalRows = candidateRows.filter((row: any) => row.riskLevel === 'critical');
  const highRiskRows = candidateRows.filter((row: any) => row.riskLevel === 'high');
  const lockedRows = candidateRows.filter((row: any) => row.status === 'locked');
  const pausedRows = candidateRows.filter((row: any) => row.status === 'paused');
  const terminatedRows = candidateRows.filter((row: any) => row.status === 'terminated');
  const completedRows = candidateRows.filter((row: any) => row.status === 'completed');
  const reviewQueueRows = candidateRows.filter((row: any) => ['high', 'critical'].includes(row.riskLevel) || row.status === 'locked');

  const hybridLaneConfig: Record<string, { title: string; description: string; icon: any; color: string }> = {
    admin: {
      title: 'Admin Lane',
      description: 'Cross-team oversight, live operations and escalation control.',
      icon: BriefcaseBusiness,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    },
    proctor: {
      title: 'Proctor Lane',
      description: 'Live intervention queue for active, paused and locked sessions.',
      icon: Eye,
      color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    },
    'account-manager': {
      title: 'Account Manager Lane',
      description: 'Tenant health, session continuity and candidate communication readiness.',
      icon: Handshake,
      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    },
    finance: {
      title: 'Finance Lane',
      description: 'Billable session health and exception tracking for compliance billing.',
      icon: Landmark,
      color: 'text-green-400 border-green-500/30 bg-green-500/10',
    },
    opg: {
      title: 'OPG Lane',
      description: 'Operational governance, policy adherence and post-exam review queue.',
      icon: ClipboardCheck,
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    },
  };

  const hybridLaneCards: Record<string, Array<{ label: string; value: number; hint: string }>> = {
    admin: [
      { label: 'Live Sessions', value: liveSessions.length, hint: 'currently monitored' },
      { label: 'Critical Alerts', value: criticalRows.length, hint: 'requires immediate action' },
      { label: 'Locked Sessions', value: lockedRows.length, hint: 'manual unlock needed' },
      { label: 'Review Queue', value: reviewQueueRows.length, hint: 'cross-team follow up' },
    ],
    proctor: [
      { label: 'Active Sessions', value: liveSessions.filter((row) => row.status === 'active').length, hint: 'live watchlist' },
      { label: 'Paused Sessions', value: pausedRows.length, hint: 'ready to resume' },
      { label: 'Locked Sessions', value: lockedRows.length, hint: 'needs intervention' },
      { label: 'High Risk Candidates', value: highRiskRows.length + criticalRows.length, hint: 'watch priority' },
    ],
    'account-manager': [
      { label: 'Tenant Sessions', value: candidateRows.length, hint: 'total loaded rows' },
      { label: 'At-Risk Sessions', value: highRiskRows.length + criticalRows.length, hint: 'stakeholder follow-up' },
      { label: 'Terminated Sessions', value: terminatedRows.length, hint: 'candidate support needed' },
      { label: 'Completed Sessions', value: completedRows.length, hint: 'success confirmation' },
    ],
    finance: [
      { label: 'Billable Active', value: liveSessions.length, hint: 'running billable units' },
      { label: 'Completed Exams', value: completedRows.length, hint: 'ready for settlement' },
      { label: 'Disputed Sessions', value: terminatedRows.length + lockedRows.length, hint: 'requires verification' },
      { label: 'Exception Queue', value: reviewQueueRows.length, hint: 'manual finance review' },
    ],
    opg: [
      { label: 'Governance Queue', value: reviewQueueRows.length, hint: 'policy review pending' },
      { label: 'Critical Cases', value: criticalRows.length, hint: 'escalation candidates' },
      { label: 'Paused + Locked', value: pausedRows.length + lockedRows.length, hint: 'intervention backlog' },
      { label: 'Completed with Flags', value: completedRows.filter((row) => row.violationCount > 0).length, hint: 'audit recommended' },
    ],
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeSince = (timestamp: string | Date) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'completed':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'terminated':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'abandoned':
        return `${baseClasses} bg-gray-100 text-gray-500`;
      case 'paused':
        return `${baseClasses} bg-yellow-100 text-yellow-800 animate-pulse`;
      case 'locked':
        return `${baseClasses} bg-orange-100 text-orange-800 animate-pulse`;
      case 'idle-yellow':
        return `${baseClasses} bg-yellow-100 text-yellow-700`;
      case 'idle-amber':
        return `${baseClasses} bg-orange-100 text-orange-700`;
      case 'idle-red':
        return `${baseClasses} bg-red-100 text-red-700`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paused': return '⏸ paused';
      case 'locked': return '🔒 locked';
      case 'terminated': return '🛑 terminated';
      case 'submitted': return '✅ submitted';
      case 'auto_submitted': return '⏱ auto submitted';
      case 'time_expired': return '⏱ time expired';
      case 'aborted': return '⚪ aborted';
      default: return status;
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    switch (riskLevel) {
      case 'low':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'medium':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'high':
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case 'critical':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tenantSession) {
    return null;
  }

  // Super Admin View
  if (isSuperAdmin && activeView === 'super-admin') {
    return (
      <div className="min-h-screen bg-navy-950 overflow-hidden">
        <SuperAdminNav 
          activeView={superAdminActiveView}
          setActiveView={setSuperAdminActiveView}
          onLogout={handleLogout}
        />
        
        <div className="lg:pl-64">
          <main className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Switch to tenant admin button */}
              {isSuperAdmin && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setActiveView('tenant-admin')}
                    className="px-3 py-1 bg-navy-700 text-gray-300 text-sm rounded hover:bg-navy-600 transition-colors"
                  >
                    Switch to Tenant View
                  </button>
                </div>
              )}
              {superAdminActiveView === 'dashboard' && <SuperAdminDashboard />}
              {superAdminActiveView === 'tenants' && <TenantManagement />}
              {superAdminActiveView === 'analytics' && <Analytics />}
              {superAdminActiveView === 'settings' && <GlobalSettings />}
              {superAdminActiveView === 'monitoring' && <SystemMonitor />}
              {superAdminActiveView === 'integrations' && <Integrations />}
            </div>
          </main>
        </div>
      </div>
    );
  }

  const activeSessions = liveSessions.length;
  const totalViolations = sortedSessions.reduce((sum, s) => sum + (s.violations?.length || 0), 0);
  const avgCredibilityScore = Math.round(
    liveSessions.reduce((sum, s) => sum + (s.credibilityScore || 1.0), 0) / Math.max(liveSessions.length, 1) * 100
  );

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Navigation */}
      <nav className="bg-navy-900 border-b border-navy-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-cyan-400 mr-3" />
              <span className="text-xl font-semibold text-white">Proctoring Dashboard</span>
              <span className="ml-4 text-sm text-cyan-400">{tenantSession.organizationName}</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Real-time connection status */}
              <div className="flex items-center space-x-2">
                {candidateRows.length > 0 ? (
                  <Wifi className="w-5 h-5 text-green-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-sm font-medium ${candidateRows.length > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {cpLoading ? 'Loading...' : candidateRows.length > 0 ? 'Live' : 'No Sessions'}
                </span>
              </div>

              <button
                onClick={handleRefresh}
                disabled={cpLoading || loading}
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh sessions"
              >
                <RefreshCw className={`w-5 h-5 ${cpLoading ? 'animate-spin' : ''}`} />
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setActiveView('super-admin')}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Super Admin
                </button>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Error Display */}
        {cpError && (
          <div className="mb-4 bg-red-900 border border-red-700 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-red-200">Error: {cpError}</span>
              <button
                onClick={refreshSessions}
                className="ml-4 px-3 py-1 bg-red-700 text-white text-sm rounded hover:bg-red-600"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-navy-800 rounded-lg p-6 border border-navy-700"
          >
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Active Sessions</p>
                <p className="text-2xl font-semibold text-white">{activeSessions}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-navy-800 rounded-lg p-6 border border-navy-700"
          >
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Sessions</p>
                <p className="text-2xl font-semibold text-white">{filteredSessions.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-navy-800 rounded-lg p-6 border border-navy-700"
          >
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Violations</p>
                <p className="text-2xl font-semibold text-white">{totalViolations}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-navy-800 rounded-lg p-6 border border-navy-700"
          >
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-cyan-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Avg Credibility</p>
                <p className="text-2xl font-semibold text-white">{avgCredibilityScore}%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Phase 6: Quick Links */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => router.push('/admin/cohort')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm font-medium"
          >
            <BarChart3 className="w-4 h-4" />
            Cohort Analytics
          </button>
          <button
            onClick={() => router.push('/admin/ai-accuracy')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            AI Accuracy
          </button>
        </div>

        {/* Hybrid Proctor Command Center */}
        <div className="bg-navy-800 rounded-lg p-6 border border-navy-700 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Hybrid Proctor Command Center</h2>
              <p className="text-sm text-gray-400">Integrated lanes for Admin, Proctor, Account Manager, Finance, and OPG using live session telemetry.</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Release Branch: agent-ayan-auto-remote-proctor
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {Object.entries(hybridLaneConfig).map(([laneKey, lane]) => {
              const LaneIcon = lane.icon;
              const selected = hybridTeamView === laneKey;
              return (
                <button
                  key={laneKey}
                  onClick={() => setHybridTeamView(laneKey as any)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? lane.color
                      : 'border-navy-600 bg-navy-900 text-gray-300 hover:border-navy-500 hover:text-white'
                  }`}
                >
                  <LaneIcon className="w-4 h-4" />
                  {lane.title}
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-navy-600 bg-navy-900/70 p-4 mb-4">
            <div className="text-sm font-medium text-white">{hybridLaneConfig[hybridTeamView].title}</div>
            <p className="text-xs text-gray-400 mt-1">{hybridLaneConfig[hybridTeamView].description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {hybridLaneCards[hybridTeamView].map((card) => (
              <div key={card.label} className="rounded-lg border border-navy-600 bg-navy-900 p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide">{card.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
                <div className="text-xs text-gray-500 mt-1">{card.hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-navy-800 rounded-lg p-6 border border-navy-700 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Sessions</option>
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
                <option value="terminated">Terminated</option>
                <option value="paused">Paused</option>
                <option value="locked">Locked</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Exam</label>
              <input
                type="text"
                placeholder="Filter by exam..."
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Batch</label>
              <input
                type="text"
                placeholder="Filter by batch..."
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Candidate</label>
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleRefresh}
                disabled={  cpLoading}
                className="w-full bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {cpLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-navy-800 rounded-lg border border-navy-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Examination Sessions</h2>
                <p className="text-sm text-gray-400">Real-time monitoring of exam sessions</p>
              </div>
              <button
                onClick={() => exportSessionsToCSV(sortedSessions, `sessions-${sessionTab}-${new Date().toISOString().split('T')[0]}.csv`)}
                disabled={sortedSessions.length === 0}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-4 border-t border-navy-600 pt-4">
              <button
                onClick={() => setSessionTab('live')}
                className={`px-4 py-2 font-medium transition-colors ${
                  sessionTab === 'live'
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                🔴 Live Sessions ({liveSessions.length})
              </button>
              <button
                onClick={() => setSessionTab('past')}
                className={`px-4 py-2 font-medium transition-colors ${
                  sessionTab === 'past'
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                📋 Past Sessions ({pastSessions.length})
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-navy-700">
              <thead className="bg-navy-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Candidate / Exam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Credibility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Violations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-navy-800 divide-y divide-navy-700">
                {sortedSessions.map((session) => (
                  <tr key={session.rowKey || session.sessionId} className={`hover:bg-navy-750 transition-colors ${
                    session.riskLevel === 'critical' ? 'border-l-4 border-l-red-500' :
                    session.status === 'paused' ? 'border-l-4 border-l-yellow-500' :
                    session.status === 'locked' ? 'border-l-4 border-l-orange-500' : ''
                  }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">{session.candidateId}</div>
                        <div className="text-sm text-gray-400">{session.examId}</div>
                        {(session as any).shortId && <div className="text-xs text-cyan-400 font-mono">{(session as any).shortId}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(session.status)}>
                        {getStatusLabel(session.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getRiskBadge(session.riskLevel)}>
                        {session.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        (normalizeCredibility(session.credibilityScore) * 100) >= 90 ? 'text-green-400' :
                        (normalizeCredibility(session.credibilityScore) * 100) >= 80 ? 'text-yellow-400' :
                        (normalizeCredibility(session.credibilityScore) * 100) >= 60 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {Math.round(normalizeCredibility(session.credibilityScore) * 100)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        session.violations.length === 0 ? 'text-green-400' :
                        session.violations.length <= 2 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {session.violations.length}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {session.completedAt
                          ? formatDuration(
                              Number.isFinite(Number((session as any).elapsedSeconds))
                                ? Number((session as any).elapsedSeconds)
                                : Math.floor((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
                            )
                          : formatDuration(
                              Number.isFinite(Number((session as any).elapsedSeconds))
                                ? Number((session as any).elapsedSeconds)
                                : Math.floor((new Date().getTime() - new Date(session.startedAt).getTime()) / 1000)
                            )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{formatTimestamp(session.startedAt)}</div>
                      <div className="text-xs text-gray-500">{getTimeSince(session.startedAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => router.push(`/admin/sessions/${session.sessionId}`)}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Phase 6: Admin control buttons */}
                        {session.status === 'active' && (
                          <button
                            onClick={() => {
                              const ws = new WebSocket('ws://localhost:8181?type=admin');
                              ws.onopen = () => {
                                ws.send(JSON.stringify({ type: 'admin:pause_session', sessionId: session.sessionId, reason: 'Paused by proctor from dashboard' }));
                                setTimeout(() => ws.close(), 500);
                              };
                            }}
                            className="text-yellow-400 hover:text-yellow-300 transition-colors"
                            title="Pause session"
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(session.status === 'paused' || session.status === 'locked') && (
                          <button
                            onClick={() => {
                              const ws = new WebSocket('ws://localhost:8181?type=admin');
                              ws.onopen = () => {
                                ws.send(JSON.stringify({ type: 'admin:resume_session', sessionId: session.sessionId }));
                                setTimeout(() => ws.close(), 500);
                              };
                            }}
                            className="text-green-400 hover:text-green-300 transition-colors"
                            title="Resume session"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        {session.status !== 'completed' && session.status !== 'terminated' && session.status !== 'abandoned' && (
                          <button
                            onClick={() => {
                              setTerminateDialog({
                                open: true,
                                sessionId: session.sessionId,
                                candidateId: session.candidateId,
                              });
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Terminate session"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {sortedSessions.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">No sessions found</h3>
                <p className="text-gray-500">
                  {cpError ? 'Failed to load sessions from Control Plane.' :
                   cpLoading ? 'Loading sessions...' :
                   sessions.length === 0 ? 'No active sessions at the moment. Start a simulation in the Simulator app to see them here.' :
                   'Try adjusting your filters.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {terminateDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-navy-600 bg-navy-900 shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white">Terminate Session</h3>
              <p className="mt-2 text-sm text-gray-300">
                Are you sure you want to terminate this candidate session?
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Candidate: {terminateDialog.candidateId || 'Unknown'}
              </p>
              <p className="mt-1 text-xs text-red-300">
                This action is final and cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-navy-700 px-6 py-4">
              <button
                onClick={() => setTerminateDialog({ open: false, sessionId: null })}
                className="rounded-lg border border-navy-500 px-4 py-2 text-sm text-gray-200 hover:bg-navy-800"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminateSession}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}