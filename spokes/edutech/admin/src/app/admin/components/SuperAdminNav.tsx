'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Settings, BarChart3,
  Globe, Monitor, ChevronRight, LogOut, Home
} from 'lucide-react';
import { usePlatformStats } from '../../../../hooks/usePlatformStats';

interface SuperAdminNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, description: 'Overview and quick actions' },
  { id: 'tenants', label: 'Tenant Management', icon: Building2, description: 'Manage customers and organizations' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'System usage and insights' },
  { id: 'settings', label: 'Global Settings', icon: Settings, description: 'System-wide configuration' },
  { id: 'monitoring', label: 'System Monitor', icon: Monitor, description: 'Real-time system health' },
  { id: 'integrations', label: 'Integrations', icon: Globe, description: 'API and webhook management' },
];

export default function SuperAdminNav({ activeView, setActiveView, onLogout }: SuperAdminNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());
  const { stats, connected } = usePlatformStats(3000);
  const [sysMetrics, setSysMetrics] = useState({ cpu: 0, mem: 0 });

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch real system metrics
  useEffect(() => {
    const fetchMetrics = () => {
      fetch('/api/system/metrics').then(r => r.json()).then(d => {
        setSysMetrics({ cpu: d.cpu?.usage || 0, mem: d.memory?.usage || 0 });
      }).catch(() => {});
    };
    fetchMetrics();
    const iv = setInterval(fetchMetrics, 5000);
    return () => clearInterval(iv);
  }, []);

  const sidebarStats = [
    { label: 'Active Sessions', value: stats.activeSessions.toString(), change: stats.idleSessions > 0 ? `${stats.idleSessions} idle` : 'all active', color: 'text-green-400' },
    { label: 'Total Sessions', value: stats.totalSessions.toString(), change: `${stats.completedSessions} done`, color: 'text-cyan-400' },
    { label: 'Avg Credibility', value: `${stats.avgCredibility}%`, change: stats.avgCredibility >= 80 ? 'Good' : stats.avgCredibility >= 50 ? 'Fair' : 'Low', color: stats.avgCredibility >= 80 ? 'text-green-400' : 'text-orange-400' },
    { label: 'Violations', value: stats.totalViolations.toString(), change: `${stats.orgStats.length} orgs`, color: 'text-orange-400' },
  ];

  return (
    <div className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-navy-900/80 backdrop-blur-lg border-r border-white/10 transition-all duration-300"
      style={{ width: collapsed ? 64 : 256 }}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        {!collapsed && <div><h1 className="text-lg font-bold text-white">Super Admin</h1><p className="text-xs text-gray-400">Proctoring Platform</p></div>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10">
          <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Real-time stats */}
      {!collapsed && (
        <div className="p-3 border-b border-white/10">
          <div className="grid grid-cols-2 gap-1.5">
            {sidebarStats.map((s, i) => (
              <div key={i} className="bg-navy-800/50 rounded p-1.5">
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="font-semibold text-white text-xs">{s.value}</p>
                <p className={`text-[10px] ${s.color}`}>{s.change}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-white/10 ${
                isActive ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30' : 'text-gray-300 hover:text-white'
              }`} title={collapsed ? item.label : undefined}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <div><p className="text-sm font-medium">{item.label}</p><p className="text-[10px] opacity-70">{item.description}</p></div>}
            </button>
          );
        })}
      </nav>

      {/* User / logout */}
      <div className="p-3 border-t border-white/10">
        {!collapsed && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">SA</span>
              </div>
              <div><p className="text-white text-xs font-medium">Super Admin</p><p className="text-gray-400 text-[10px]">superadmin@ayan.ai</p></div>
            </div>
            <p className="text-[10px] text-gray-500">Organization: System Administrator</p>
            <p className="text-[10px] text-gray-500">Role: Platform Administrator</p>
          </div>
        )}
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors" title={collapsed ? 'Logout' : undefined}>
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );
}

export type { SuperAdminNavProps };
