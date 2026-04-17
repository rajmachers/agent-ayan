'use client';

import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Lock, Pause, XCircle, RefreshCw, 
  Filter, ChevronDown, Clock, BarChart3, Search,
  TrendingDown, Target, Zap, CheckCircle
} from 'lucide-react';
import { useQueryFilter } from '../hooks/useQueryFilter';

interface Session {
  sessionId: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  status: string;
  riskLevel: string;
  credibilityScore: number;
  violationCount: number;
  startedAt: string;
  duration: number;
  recentEvents: any[];
}

export default function SessionControlPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Batch action
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [batchReason, setBatchReason] = useState('');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (riskFilter !== 'all') params.append('riskLevel', riskFilter);
      
      const url = `http://localhost:4101/api/v1/admin/sessions${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter, riskFilter]);

  const handleAction = async (sessionId: string, action: string, reason: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4101/api/v1/sessions/${sessionId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      
      if (res.ok) {
        await fetchSessions();
        setShowDetail(false);
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchAction = async (action: string, examIdOrCandidates: string, actionType: 'exam' | 'candidates') => {
    setActionLoading(true);
    try {
      const body = actionType === 'exam' 
        ? { examId: examIdOrCandidates, action, reason: batchReason }
        : { candidateIds: [examIdOrCandidates], action, reason: batchReason };
      
      const res = await fetch('http://localhost:4101/api/v1/admin/sessions/batch/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        await fetchSessions();
        setBatchAction(null);
      }
    } catch (err) {
      console.error('Batch action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.candidateId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sessionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, any> = {
      active: { bg: 'bg-green-900/20', text: 'text-green-400', icon: CheckCircle },
      paused: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', icon: Pause },
      locked: { bg: 'bg-orange-900/20', text: 'text-orange-400', icon: Lock },
      terminated: { bg: 'bg-red-900/20', text: 'text-red-400', icon: XCircle }
    };
    return badges[status] || badges.active;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-cyan-400" />
            Session Control Center
          </h2>
          <p className="text-gray-400 text-sm mt-1">Real-time exam session management and intervention</p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search candidate ID or session..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="locked">Locked</option>
            <option value="terminated">Terminated</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div className="text-sm text-gray-400 flex items-center">
            {filteredSessions.length} sessions found
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No sessions found matching filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-navy-900/80 border-b border-white/10">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Candidate</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Exam</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Risk</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Score</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Violations</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Duration</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSessions.map((session) => {
                  const badge = getStatusBadge(session.status);
                  const Icon = badge.icon;
                  return (
                    <tr key={session.sessionId} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-white font-medium">{session.candidateId}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{session.examId.slice(0, 20)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded ${badge.bg} ${badge.text} text-xs font-medium`}>
                          <Icon className="w-3 h-3" />
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${getRiskColor(session.riskLevel)}`}>
                          {session.riskLevel || 'low'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-white">{session.credibilityScore}</td>
                      <td className="px-6 py-4 text-sm text-orange-400">{session.violationCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{Math.floor(session.duration / 60)}m</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedSession(session);
                            setShowDetail(true);
                          }}
                          className="px-3 py-1 rounded bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 text-xs font-medium transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Panel Modal */}
      {showDetail && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-white/10 rounded-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-navy-900/80 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Session Details & Control</h3>
                <p className="text-sm text-gray-400">Session: {selectedSession.sessionId}</p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/10">
                <div>
                  <p className="text-gray-400 text-sm">Candidate</p>
                  <p className="text-white font-medium">{selectedSession.candidateId}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Exam</p>
                  <p className="text-white font-medium">{selectedSession.examId.slice(0, 30)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Current Status</p>
                  <p className="text-white font-medium capitalize">{selectedSession.status}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Risk Level</p>
                  <p className={`font-medium ${getRiskColor(selectedSession.riskLevel)}`}>
                    {selectedSession.riskLevel || 'Low'}
                  </p>
                </div>
              </div>

              {/* Scoring */}
              <div className="space-y-2 pb-4 border-b border-white/10">
                <p className="text-gray-400 text-sm font-semibold">Scoring</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-gray-400 text-xs mb-1">Credibility Score</p>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          selectedSession.credibilityScore >= 70
                            ? 'bg-green-500'
                            : selectedSession.credibilityScore >= 40
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${selectedSession.credibilityScore}%` }}
                      ></div>
                    </div>
                    <p className="text-white font-mono mt-1">{selectedSession.credibilityScore}/100</p>
                  </div>
                </div>
              </div>

              {/* Violations */}
              <div className="space-y-2 pb-4 border-b border-white/10">
                <p className="text-gray-400 text-sm font-semibold">Violations Detected: {selectedSession.violationCount}</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedSession.recentEvents.slice(0, 5).map((evt, i) => (
                    <div key={i} className="bg-white/5 rounded px-3 py-2 text-xs text-gray-300">
                      {evt.message}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-2">
                <p className="text-blue-400 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  AI Recommendations
                </p>
                <ul className="text-sm text-blue-200 space-y-1 list-disc list-inside">
                  {selectedSession.riskLevel === 'critical' && (
                    <li>High-risk anomaly detected - Consider immediate action</li>
                  )}
                  {selectedSession.credibilityScore < 40 && (
                    <li>Credibility below threshold - Review for termination</li>
                  )}
                  {selectedSession.violationCount > 10 && (
                    <li>Excessive violations - Likely genuine concern</li>
                  )}
                  <li>Request proctor review for context</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                {selectedSession.status !== 'paused' && (
                  <button
                    onClick={() => handleAction(selectedSession.sessionId, 'pause', 'Manual pause by super admin')}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Pause Exam
                  </button>
                )}
                
                {selectedSession.status !== 'locked' && selectedSession.status !== 'terminated' && (
                  <button
                    onClick={() => handleAction(selectedSession.sessionId, 'lock', 'Locked due to suspicious activity')}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-orange-900/20 text-orange-400 hover:bg-orange-900/40 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Lock Candidate
                  </button>
                )}
                
                {selectedSession.status !== 'terminated' && (
                  <button
                    onClick={() => handleAction(selectedSession.sessionId, 'terminate', 'Terminated by super admin')}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Terminate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
