'use client';

import { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Activity, AlertTriangle, Shield, Monitor, Users } from 'lucide-react';
import { usePlatformStats } from '../../../../hooks/usePlatformStats';

export default function Analytics() {
  const { stats, connected } = usePlatformStats(3000);
  const [sysMetrics, setSysMetrics] = useState<any>(null);

  useEffect(() => {
    const fetch_ = () => {
      fetch('/api/system/metrics').then(r => r.json()).then(setSysMetrics).catch(() => {});
    };
    fetch_();
    const iv = setInterval(fetch_, 8000);
    return () => clearInterval(iv);
  }, []);

  const maxViolation = Math.max(...Object.values(stats.violationBreakdown).map(Number), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Platform Analytics</h2>
          <p className="text-gray-400 text-sm">Real-time data from session manager</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className={connected ? 'text-green-400' : 'text-red-400'}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Activity, label: 'Active', value: stats.activeSessions, color: 'text-green-400', sub: `${stats.idleSessions} idle` },
          { icon: Users, label: 'Total', value: stats.totalSessions, color: 'text-blue-400', sub: `${stats.completedSessions} done` },
          { icon: AlertTriangle, label: 'Violations', value: stats.totalViolations, color: 'text-yellow-400', sub: `${stats.orgStats.length} orgs` },
          { icon: Shield, label: 'Credibility', value: `${stats.avgCredibility}%`, color: 'text-cyan-400', sub: stats.avgCredibility >= 80 ? 'Good' : 'Needs attention' },
        ].map((c, i) => (
          <div key={i} className="bg-navy-800 rounded-lg p-4 border border-navy-700">
            <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
            <div className="text-2xl font-bold text-white">{c.value}</div>
            <div className="text-xs text-gray-400">{c.label}</div>
            <div className="text-xs text-gray-500">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Violation by source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><PieChart className="w-5 h-5 text-cyan-400" /><h3 className="text-white font-medium">Violations by Source</h3></div>
          <div className="space-y-3">
            {[
              { label: 'Browser Events', value: stats.browserViolations, color: 'bg-blue-500' },
              { label: 'Vision AI', value: stats.visionViolations, color: 'bg-purple-500' },
              { label: 'Audio AI', value: stats.audioViolations, color: 'bg-green-500' },
              { label: 'Behavior AI', value: stats.behaviorViolations, color: 'bg-yellow-500' },
            ].map((s, i) => {
              const pct = stats.totalViolations > 0 ? ((s.value / stats.totalViolations) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{s.label}</span>
                    <span className="text-white font-medium">{s.value} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full transition-all`} style={{width: `${pct}%`}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-yellow-400" /><h3 className="text-white font-medium">Violation Types</h3></div>
          {Object.keys(stats.violationBreakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.violationBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([type, count], i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-300 w-40 truncate capitalize">{type}</span>
                    <div className="flex-1 h-4 bg-navy-700 rounded overflow-hidden">
                      <div className="h-full bg-cyan-500/60 rounded" style={{ width: `${(count / maxViolation) * 100}%` }}></div>
                    </div>
                    <span className="text-white font-medium w-8 text-right">{count}</span>
                  </div>
                ))}
            </div>
          ) : <div className="text-gray-400 text-sm">No violations yet</div>}
        </div>
      </div>

      {/* System + Org stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><Monitor className="w-5 h-5 text-cyan-400" /><h3 className="text-white font-medium">System Resources</h3></div>
          {sysMetrics ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${(sysMetrics.cpu?.usage || 0) > 80 ? 'text-red-400' : 'text-green-400'}`}>{sysMetrics.cpu?.usage || 0}%</div>
                  <div className="text-xs text-gray-400">CPU Usage</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${(sysMetrics.memory?.usage || 0) > 80 ? 'text-red-400' : 'text-green-400'}`}>{sysMetrics.memory?.usage || 0}%</div>
                  <div className="text-xs text-gray-400">Memory Usage</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1 border-t border-navy-700 pt-2">
                <p>Cores: {sysMetrics.cpu?.cores} | Load: {sysMetrics.cpu?.loadAvg?.join(' / ')}</p>
                <p>RAM: {sysMetrics.memory?.used}GB / {sysMetrics.memory?.total}GB (Free: {sysMetrics.memory?.free}GB)</p>
                <p>Containers: {sysMetrics.containers?.running || 0} running / {sysMetrics.containers?.total || 0} total</p>
              </div>
            </div>
          ) : <div className="text-gray-400 text-sm">Loading...</div>}
        </div>

        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-green-400" /><h3 className="text-white font-medium">Top Tenant Usage</h3></div>
          {stats.orgStats.length > 0 ? (
            <div className="space-y-3">
              {stats.orgStats.slice(0, 5).map((org, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-white">{org.name}</span>
                    <span className="text-gray-500 text-xs ml-2">{org.sessions} sessions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">{org.violations} violations</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-400 text-sm">No tenants active</div>}
        </div>
      </div>

      {/* Session breakdown */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
        <h3 className="text-white font-medium mb-4">Session Status Breakdown</h3>
        <div className="flex gap-4 items-end h-32">
          {[
            { label: 'Active', value: stats.activeSessions, color: 'bg-green-500' },
            { label: 'Idle', value: stats.idleSessions, color: 'bg-yellow-500' },
            { label: 'Completed', value: stats.completedSessions, color: 'bg-blue-500' },
            { label: 'Abandoned', value: stats.abandonedSessions, color: 'bg-red-500' },
          ].map((s, i) => {
            const maxVal = Math.max(stats.activeSessions, stats.idleSessions, stats.completedSessions, stats.abandonedSessions, 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-white text-sm font-medium">{s.value}</span>
                <div className={`w-full ${s.color} rounded-t`} style={{ height: `${Math.max((s.value / maxVal) * 80, 4)}px` }}></div>
                <span className="text-gray-400 text-xs">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
