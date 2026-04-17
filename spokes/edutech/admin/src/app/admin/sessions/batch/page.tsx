'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Pause, Play, Trash2, Lock, Flag, CheckCircle, Clock, Zap, Users, BarChart3 } from 'lucide-react';

export default function SessionControlPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<'pause' | 'resume' | 'terminate' | 'lock' | 'unlock' | 'flag' | ''>('');
  const [reason, setReason] = useState('');
  const [lockDurationMinutes, setLockDurationMinutes] = useState(0);
  const [filter, setFilter] = useState({ riskAbove: '', violationType: '', examId: '' });
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [operationResult, setOperationResult] = useState<any>(null);

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filter.examId) query.append('examId', filter.examId);
      const res = await fetch(`http://localhost:4101/api/v1/admin/sessions?${query}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const toggleAllSessions = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.sessionId)));
    }
  };

  const executeAction = async () => {
    if (!action || selectedSessions.size === 0) {
      alert('Select action and sessions');
      return;
    }

    setOperationInProgress(true);
    try {
      const res = await fetch('http://localhost:4101/api/v1/admin/sessions/batch/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo-key' },
        body: JSON.stringify({
          action,
          reason: reason || `Bulk ${action} via control panel`,
          lockDurationMinutes: action === 'lock' ? lockDurationMinutes : undefined,
          candidateIds: Array.from(selectedSessions),
          filter: {
            riskAbove: filter.riskAbove ? parseInt(filter.riskAbove) : undefined,
            violationType: filter.violationType || undefined
          }
        })
      });
      const result = await res.json();
      setOperationResult(result);
      setSelectedSessions(new Set());
      setTimeout(() => fetchSessions(), 1000);
    } catch (err) {
      console.error('Action failed:', err);
      setOperationResult({ success: false, error: 'Action failed' });
    } finally {
      setOperationInProgress(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'pause': return <Pause className="w-4 h-4" />;
      case 'resume': return <Play className="w-4 h-4" />;
      case 'terminate': return <Trash2 className="w-4 h-4" />;
      case 'lock': return <Lock className="w-4 h-4" />;
      case 'flag': return <Flag className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'locked': return 'bg-red-100 text-red-800';
      case 'terminated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskLevel = (score: number) => {
    if (score > 75) return { label: 'CRITICAL', color: 'text-red-600' };
    if (score > 50) return { label: 'HIGH', color: 'text-orange-600' };
    if (score > 25) return { label: 'MEDIUM', color: 'text-yellow-600' };
    return { label: 'LOW', color: 'text-green-600' };
  };

  const riskScore = (session: any) => 100 - (session.credibilityScore || 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Session Control Panel</h2>
            <p className="text-gray-400">Bulk manage sessions with batch operations</p>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-cyan-400">{sessions.length}</div>
              <div className="text-xs text-gray-400">Total Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{selectedSessions.size}</div>
              <div className="text-xs text-gray-400">Selected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Operation Result */}
      {operationResult && (
        <div className={`rounded-lg p-4 ${operationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start gap-3">
            {operationResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className={`font-semibold ${operationResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {operationResult.success ? 'Operation Successful' : 'Operation Failed'}
              </h3>
              <p className={`text-sm ${operationResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {operationResult.success 
                  ? `${operationResult.affectedCount} sessions ${operationResult.action}ed`
                  : operationResult.error
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filter Section */}
        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Filters
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Filter by Exam ID"
              value={filter.examId}
              onChange={(e) => setFilter({ ...filter, examId: e.target.value })}
              className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white placeholder-gray-500"
            />
            <input
              type="number"
              placeholder="Risk Above %"
              min="0"
              max="100"
              value={filter.riskAbove}
              onChange={(e) => setFilter({ ...filter, riskAbove: e.target.value })}
              className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white placeholder-gray-500"
            />
            <select
              value={filter.violationType}
              onChange={(e) => setFilter({ ...filter, violationType: e.target.value })}
              className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white"
            >
              <option value="">All Violation Types</option>
              <option value="multiple_faces">Multiple Faces</option>
              <option value="no_face_detected">No Face Detected</option>
              <option value="tab_switch">Tab Switch</option>
              <option value="paste_attempt">Paste Attempt</option>
            </select>
          </div>
        </div>

        {/* Action Section */}
        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Batch Action
          </h3>
          <div className="space-y-3">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as any)}
              className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white"
            >
              <option value="">Select Action</option>
              <option value="pause">Pause All</option>
              <option value="resume">Resume All</option>
              <option value="terminate">Terminate All</option>
              <option value="lock">Lock All</option>
              <option value="flag">Flag All</option>
            </select>
            <input
              type="text"
              placeholder="Reason for action"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white placeholder-gray-500 text-sm"
            />
            {action === 'lock' && (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Minutes (0 = permanent)"
                  min="0"
                  value={lockDurationMinutes}
                  onChange={(e) => setLockDurationMinutes(parseInt(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white placeholder-gray-500 text-sm"
                />
              </div>
            )}
            <button
              onClick={executeAction}
              disabled={!action || selectedSessions.size === 0 || operationInProgress}
              className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded font-semibold flex items-center justify-center gap-2"
            >
              {operationInProgress ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  {getActionIcon(action)}
                  Execute on {selectedSessions.size} Sessions
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Sessions ({sessions.length})</h3>
          <button
            onClick={toggleAllSessions}
            className="text-sm px-3 py-1 bg-navy-700 hover:bg-navy-600 text-cyan-400 rounded"
          >
            {selectedSessions.size === sessions.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No sessions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-navy-700">
                <th className="text-left py-3 px-3"><input type="checkbox" checked={selectedSessions.size === sessions.length} onChange={toggleAllSessions} className="rounded" /></th>
                <th className="text-left py-3 px-3">Session ID</th>
                <th className="text-left py-3 px-3">Candidate</th>
                <th className="text-left py-3 px-3">Exam</th>
                <th className="text-center py-3 px-3">Risk</th>
                <th className="text-center py-3 px-3">Status</th>
                <th className="text-center py-3 px-3">Violations</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId} className="border-t border-navy-700 hover:bg-navy-700/50">
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.sessionId)}
                      onChange={() => toggleSessionSelection(session.sessionId)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-3 px-3 text-white font-mono text-xs">{session.sessionId.slice(0, 12)}...</td>
                  <td className="py-3 px-3 text-gray-300">{session.candidateId}</td>
                  <td className="py-3 px-3 text-gray-300 text-xs">{session.examId.slice(0, 20)}...</td>
                  <td className={`py-3 px-3 text-center font-semibold ${getRiskLevel(riskScore(session)).color}`}>
                    {getRiskLevel(riskScore(session)).label}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(session.status)}`}>
                      {session.status || 'active'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-300">{session.violationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
