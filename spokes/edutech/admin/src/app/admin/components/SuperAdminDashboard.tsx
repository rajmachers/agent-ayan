'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Users, Monitor, Settings, BarChart3, Globe, Zap, Lock, Pause } from 'lucide-react';
import { usePlatformStats } from '../../../../hooks/usePlatformStats';

export default function SuperAdminDashboard() {
  const { stats, connected } = usePlatformStats(2000);
  const [sysMetrics, setSysMetrics] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    const fetch_ = () => {
      fetch('/api/system/metrics').then(r => r.json()).then(setSysMetrics).catch(() => {});
    };
    fetch_();
    const iv = setInterval(fetch_, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      setAlertsLoading(true);
      try {
        const res = await fetch('http://localhost:4101/api/v1/admin/alerts/active');
        const data = await res.json();
        if (data.success) {
          setActiveAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      } finally {
        setAlertsLoading(false);
      }
    };
    
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome to Super Admin Dashboard</h2>
            <p className="text-gray-400">Manage your entire proctoring platform from here • Real-time data from session manager</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="text-2xl font-bold text-cyan-400">{stats.activeSessions}</div>
              <div className="text-xs text-gray-400">Active Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{stats.orgStats.length}</div>
              <div className="text-xs text-gray-400">Active Orgs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.avgCredibility}%</div>
              <div className="text-xs text-gray-400">Avg Credibility</div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className={connected ? 'text-green-400' : 'text-red-400'}>{connected ? 'LIVE DATA' : 'DISCONNECTED'}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-3"><Activity className="w-6 h-6 text-green-400" /><span className="text-gray-400 text-sm">Active Sessions</span></div>
          <div className="text-3xl font-bold text-white mt-2">{stats.activeSessions}</div>
          <div className="text-xs text-gray-500 mt-1">{stats.idleSessions > 0 ? `${stats.idleSessions} idle` : 'All responsive'}</div>
        </div>
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-3"><Users className="w-6 h-6 text-blue-400" /><span className="text-gray-400 text-sm">Total Sessions</span></div>
          <div className="text-3xl font-bold text-white mt-2">{stats.totalSessions}</div>
          <div className="text-xs text-gray-500 mt-1">{stats.completedSessions} completed, {stats.abandonedSessions} abandoned</div>
        </div>
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-3"><AlertTriangle className="w-6 h-6 text-yellow-400" /><span className="text-gray-400 text-sm">Total Violations</span></div>
          <div className="text-3xl font-bold text-white mt-2">{stats.totalViolations}</div>
          <div className="text-xs text-gray-500 mt-1">Browser: {stats.browserViolations} | AI: {stats.visionViolations + stats.audioViolations + stats.behaviorViolations}</div>
        </div>
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-3"><Shield className="w-6 h-6 text-cyan-400" /><span className="text-gray-400 text-sm">Avg Credibility</span></div>
          <div className={`text-3xl font-bold mt-2 ${stats.avgCredibility >= 80 ? 'text-green-400' : stats.avgCredibility >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{stats.avgCredibility}%</div>
          <div className="text-xs text-gray-500 mt-1">{stats.avgCredibility >= 80 ? 'Good' : stats.avgCredibility >= 50 ? 'Fair' : 'Low'} overall</div>
        </div>
      </div>

      {/* System metrics + violation breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><Monitor className="w-5 h-5 text-cyan-400" /><h3 className="text-white font-medium">System Metrics</h3></div>
          {sysMetrics ? (
            <div className="space-y-4">
              {[
                { label: 'CPU', value: sysMetrics.cpu?.usage || 0 },
                { label: 'Memory', value: sysMetrics.memory?.usage || 0 },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">{m.label}</span><span className="text-white">{m.value}%</span></div>
                  <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${m.value > 80 ? 'bg-red-400' : m.value > 60 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{width:`${m.value}%`}}></div>
                  </div>
                </div>
              ))}
              <div className="text-xs text-gray-500 mt-2">
                <p>Cores: {sysMetrics.cpu?.cores || '-'} | Load: {sysMetrics.cpu?.loadAvg?.join(', ') || '-'}</p>
                <p>Memory: {sysMetrics.memory?.used || 0}GB / {sysMetrics.memory?.total || 0}GB</p>
                <p>Uptime: {sysMetrics.uptime?.formatted || '-'}</p>
              </div>
            </div>
          ) : <div className="text-gray-400 text-sm">Loading system metrics...</div>}
        </div>

        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5 text-yellow-400" /><h3 className="text-white font-medium">Violation Breakdown</h3></div>
          {Object.keys(stats.violationBreakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.violationBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 capitalize">{type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{count}</span>
                      <span className="text-gray-500 text-xs">({((count / stats.totalViolations) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : <div className="text-gray-400 text-sm">No violations recorded yet</div>}
        </div>
      </div>

      {/* Active Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-red-900 mb-3">Active Alerts ({activeAlerts.length})</h3>
          <div className="space-y-2">
            {activeAlerts.map((alert, i) => (
              <div key={i} className="bg-white p-3 rounded border-l-4 border-red-500">
                <div className="font-semibold text-red-900">{alert.title}</div>
                <div className="text-sm text-red-700">{alert.description}</div>
                {alert.metadata && (
                  <div className="text-xs text-red-600 mt-1 font-mono">
                    {typeof alert.metadata === 'string' ? alert.metadata : JSON.stringify(alert.metadata)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org stats */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
        <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-cyan-400" /><h3 className="text-white font-medium">Organization Activity</h3></div>
        {stats.orgStats.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="text-gray-400 text-xs">
              <th className="text-left py-2">Organization</th>
              <th className="text-right py-2">Sessions</th>
              <th className="text-right py-2">Violations</th>
              <th className="text-right py-2">Last Activity</th>
            </tr></thead>
            <tbody>
              {stats.orgStats.map((org, i) => (
                <tr key={i} className="border-t border-navy-700">
                  <td className="py-2 text-white">{org.name}</td>
                  <td className="py-2 text-right text-gray-300">{org.sessions}</td>
                  <td className="py-2 text-right text-gray-300">{org.violations}</td>
                  <td className="py-2 text-right text-gray-500 text-xs">{org.lastActivity ? new Date(org.lastActivity).toLocaleTimeString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-gray-400 text-sm">No organizations with active sessions</div>}
      </div>
    </div>
  );
}
