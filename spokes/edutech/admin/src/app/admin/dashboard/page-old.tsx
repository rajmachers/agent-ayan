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
  Database, Package, Zap
} from 'lucide-react';

// Super Admin Components
import SuperAdminNav from '../components/SuperAdminNav';
import SuperAdminDashboard from '../components/SuperAdminDashboard';
import TenantManagement from '../components/TenantManagement';
import Analytics from '../components/Analytics';
import GlobalSettings from '../components/GlobalSettings';

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

interface Session {
  sessionId: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  status: 'active' | 'completed' | 'terminated' | 'in-progress';
  credibilityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  violationCount: number;
  duration: number;
  startedAt: string;
  endedAt?: string;
  lastSyncAt?: string;
  quizCompleted?: boolean;
  candidateName?: string;
  examName?: string;
  batchId?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);  
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'in-progress'>('all');
  const [examFilter, setExamFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<'tenant-admin' | 'super-admin'>('tenant-admin');
  const [superAdminActiveView, setSuperAdminActiveView] = useState('dashboard');

  // Detect if user is super admin
  const isSuperAdmin = tenantSession?.organizationType === 'system-admin';
  const [mounted, setMounted] = useState(false);

  const fetchSessions = useCallback(async (organizationId?: string) => {
    if (!organizationId) return;
    
    try {
      console.log('🔍 Fetching sessions for org:', organizationId);
      
      // Build query parameters
      const params = new URLSearchParams({
        organizationId: organizationId
      });
      
      if (filter !== 'all') params.append('status', filter);
      if (examFilter) params.append('examId', examFilter);
      if (batchFilter) params.append('batchId', batchFilter);
      if (searchTerm) params.append('candidateName', searchTerm);
      
      // Fetch from local proxy API (avoids CORS issues)
      const response = await fetch(`/api/sessions?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Sessions data received:', data);
      
      if (data.success && data.sessions) {
        const mappedSessions = data.sessions.map((session: any) => ({
          sessionId: session.sessionId,
          candidateId: session.candidateId || session.candidateName,
          examId: session.examId,
          organizationId: session.organizationId,
          status: session.status || (session.completedAt ? 'completed' : 'in-progress'),
          credibilityScore: session.credibilityScore || 95,
          riskLevel: session.riskLevel || 'low',
          violationCount: session.violations?.length || 0,
          duration: session.duration || Math.floor((Date.now() - Date.parse(session.startedAt || session.createdAt)) / 1000),
          startedAt: session.startedAt || session.createdAt,
          endedAt: session.completedAt,
          lastSyncAt: session.lastSyncAt || session.updatedAt || session.createdAt,
          quizCompleted: !!session.completedAt,
          candidateName: session.candidateName || session.candidateId,
          examName: session.examName,
          batchId: session.batchId
        }));
        
        console.log('📈 Mapped sessions:', mappedSessions.length);
        setSessions(mappedSessions);
      } else {
        console.warn('⚠️ No sessions in API response');
        setSessions([]);
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('❌ Failed to fetch sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [filter, examFilter, batchFilter, searchTerm]);

  useEffect(() => {
    if (tenantSession) {
      fetchSessions(tenantSession.organizationId);
    }
  }, [tenantSession, filter, examFilter, batchFilter, searchTerm, fetchSessions]);

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
      fetchSessions(session.organizationId);
      
      // Set up real-time updates
      const interval = setInterval(() => fetchSessions(session.organizationId), 5000);
      return () => clearInterval(interval);
    } catch {
      router.push('/admin/login');
    }
  }, [router, fetchSessions]);

  const handleLogout = () => {
    localStorage.removeItem('tenant_session');
    router.push('/admin/login');
  };
  
  const handleRefresh = () => {
    if (tenantSession) {
      setLoading(true);
      fetchSessions(tenantSession.organizationId);
    }
  };
  
  const filteredSessions = sessions;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'high': return 'text-orange-400 bg-orange-400/10';
      case 'critical': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10';
      case 'completed': return 'text-blue-400 bg-blue-400/10';
      case 'terminated': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (!mounted) return null;

  // Super Admin Layout
  if (isSuperAdmin) {
    return (
      <SuperAdminNav
        activeView={superAdminActiveView}
        setActiveView={setSuperAdminActiveView}
        onLogout={handleLogout}
        sessionData={{
          user: { email: tenantSession?.email || '' },
          organization: { 
            name: tenantSession?.organizationName || 'System Administrator',
            type: 'system-admin' 
          }
        }}
      >
        <div className="h-full">
          {superAdminActiveView === 'dashboard' && <SuperAdminDashboard setActiveView={setSuperAdminActiveView} />}
          {superAdminActiveView === 'tenants' && <TenantManagement />}
          {superAdminActiveView === 'analytics' && <Analytics />}
          {superAdminActiveView === 'settings' && <GlobalSettings />}
          {superAdminActiveView === 'monitoring' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <h2 className="text-2xl font-semibold text-white mb-4">System Monitor</h2>
                <p className="text-gray-400">Real-time system monitoring will be available soon</p>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-navy-800/50 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Server Health</h3>
                    <p className="text-3xl font-bold text-green-400">Healthy</p>
                  </div>
                  <div className="bg-navy-800/50 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Active Connections</h3>
                    <p className="text-3xl font-bold text-cyan-400">2,847</p>
                  </div>
                  <div className="bg-navy-800/50 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Response Time</h3>
                    <p className="text-3xl font-bold text-blue-400">145ms</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {superAdminActiveView === 'integrations' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <h2 className="text-2xl font-semibold text-white mb-4">Integration Management</h2>
                <p className="text-gray-400">API and webhook management will be available soon</p>
                <div className="mt-8 bg-navy-800/50 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Coming Soon</h3>
                  <ul className="text-gray-400 space-y-2">
                    <li>• API key management</li>
                    <li>• Webhook configuration</li>
                    <li>• Third-party integrations</li>
                    <li>• SDK documentation</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </SuperAdminNav>
    );
  }

  // Regular Tenant Admin Layout

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <header className="border-b border-white/10 bg-navy-900/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ayan-logo.png" alt="Ayan.ai" className="h-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-white">Proctor Dashboard</h1>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-gray-400 text-sm">Monitor active sessions and review recordings</p>
                  {tenantSession && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="w-3 h-3" />
                      <span>{tenantSession.organizationName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-400/10 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Live Monitoring</span>
              </div>
              
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              
              {lastRefresh && (
                <div className="text-xs text-gray-500">
                  Last sync: {getTimeSince(lastRefresh.toISOString())}
                </div>
              )}
              
              <div className="border-l border-white/10 pl-4">
                {tenantSession && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <User className="w-4 h-4" />
                    <span>{tenantSession.email}</span>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Active Sessions', value: sessions.filter(s => s.status === 'active').length, icon: Activity, color: 'green' },
            { label: 'Total Sessions', value: sessions.length, icon: Users, color: 'cyan' },
            { label: 'Risk Alerts', value: sessions.filter(s => s.riskLevel !== 'low').length, icon: AlertTriangle, color: 'yellow' },
            { label: 'Avg Credibility', value: `${Math.round(sessions.reduce((acc, s) => acc + s.credibilityScore, 0) / sessions.length || 0)}%`, icon: Shield, color: 'blue' }
          ].map(stat => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-${stat.color}-400/10`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Simple Sessions Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Sessions ({filteredSessions.length})</h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading sessions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Session ID</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Candidate</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Credibility</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Violations</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Duration</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(session => (
                    <tr 
                      key={session.sessionId} 
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => window.location.href = `/admin/sessions/${session.sessionId}`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-white">
                          {session.sessionId.slice(-12)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-medium">{session.candidateName || session.candidateId}</p>
                          <p className="text-gray-400 text-sm">{session.examId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-white/10 rounded-full h-2">
                            <div 
                              className="h-2 bg-gradient-to-r from-cyan-400 to-green-400 rounded-full transition-all"
                              style={{ width: `${session.credibilityScore}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-medium">{session.credibilityScore}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white">{session.violationCount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400">{formatDuration(session.duration)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredSessions.length === 0 && (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No sessions found</p>
                  <p className="text-gray-500 text-sm">Sessions will appear here when candidates start exams</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}