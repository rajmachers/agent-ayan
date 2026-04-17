'use client';

import { useState, useEffect } from 'react';
import { Monitor, Cpu, HardDrive, Server, Activity, Clock, RefreshCw, AlertCircle } from 'lucide-react';

interface ContainerInfo {
  name: string;
  status: string;
  cpu: string;
  memory: string;
  ports: string;
}

interface SysMetrics {
  cpu: { usage: number; cores: number; loadAvg: number[]; model: string };
  memory: { total: number; used: number; free: number; usage: number };
  uptime: { seconds: number; formatted: string };
  containers: { total: number; running: number; list: ContainerInfo[] };
  platform: { arch: string; type: string; release: string; hostname: string };
}

export default function SystemMonitor() {
  const [metrics, setMetrics] = useState<SysMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = () => {
    fetch('/api/system/metrics')
      .then(r => r.json())
      .then(data => { setMetrics(data); setLastUpdate(new Date()); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
    if (!autoRefresh) return;
    const iv = setInterval(fetchMetrics, 5000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  if (loading) return <div className="text-gray-400 p-8">Loading system metrics...</div>;
  if (!metrics) return <div className="text-red-400 p-8">Failed to load system metrics</div>;

  const cpuColor = metrics.cpu.usage > 80 ? 'text-red-400' : metrics.cpu.usage > 60 ? 'text-yellow-400' : 'text-green-400';
  const memColor = metrics.memory.usage > 80 ? 'text-red-400' : metrics.memory.usage > 60 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">System Monitor</h2>
          <p className="text-gray-400 text-sm">Real-time host & container metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && <span className="text-gray-500 text-xs">Updated {lastUpdate.toLocaleTimeString()}</span>}
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`px-3 py-1 rounded text-xs ${autoRefresh ? 'bg-green-600 text-white' : 'bg-navy-700 text-gray-400'}`}>
            <RefreshCw className="w-3 h-3 inline mr-1" />{autoRefresh ? 'Auto' : 'Paused'}
          </button>
          <button onClick={fetchMetrics} className="px-3 py-1 rounded bg-navy-700 text-gray-300 text-xs hover:bg-navy-600">Refresh</button>
        </div>
      </div>

      {/* Host info */}
      <div className="bg-navy-800 rounded-lg p-4 border border-navy-700 flex items-center gap-6 text-sm">
        <Server className="w-5 h-5 text-cyan-400" />
        <div><span className="text-gray-400">Host:</span> <span className="text-white">{metrics.platform.hostname}</span></div>
        <div><span className="text-gray-400">OS:</span> <span className="text-white">{metrics.platform.type} {metrics.platform.release}</span></div>
        <div><span className="text-gray-400">Arch:</span> <span className="text-white">{metrics.platform.arch}</span></div>
        <div><span className="text-gray-400">Uptime:</span> <span className="text-white">{metrics.uptime.formatted}</span></div>
      </div>

      {/* CPU + Memory gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-navy-800 rounded-lg p-6 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><Cpu className="w-5 h-5 text-cyan-400" /><h3 className="text-white font-medium">CPU</h3></div>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={metrics.cpu.usage > 80 ? '#f87171' : metrics.cpu.usage > 60 ? '#fbbf24' : '#34d399'} strokeWidth="8" strokeDasharray={`${metrics.cpu.usage * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${cpuColor}`}>{metrics.cpu.usage}%</span>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-gray-400">Model: <span className="text-white">{metrics.cpu.model}</span></p>
              <p className="text-gray-400">Cores: <span className="text-white">{metrics.cpu.cores}</span></p>
              <p className="text-gray-400">Load (1/5/15): <span className="text-white">{metrics.cpu.loadAvg.map(l => l.toFixed(2)).join(' / ')}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-navy-800 rounded-lg p-6 border border-navy-700">
          <div className="flex items-center gap-2 mb-4"><HardDrive className="w-5 h-5 text-purple-400" /><h3 className="text-white font-medium">Memory</h3></div>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={metrics.memory.usage > 80 ? '#f87171' : metrics.memory.usage > 60 ? '#fbbf24' : '#34d399'} strokeWidth="8" strokeDasharray={`${metrics.memory.usage * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${memColor}`}>{metrics.memory.usage}%</span>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-gray-400">Total: <span className="text-white">{metrics.memory.total} GB</span></p>
              <p className="text-gray-400">Used: <span className="text-white">{metrics.memory.used} GB</span></p>
              <p className="text-gray-400">Free: <span className="text-white">{metrics.memory.free} GB</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Docker containers */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-medium">Docker Containers</h3>
          </div>
          <div className="text-sm">
            <span className="text-green-400 font-medium">{metrics.containers.running}</span>
            <span className="text-gray-400"> / {metrics.containers.total} running</span>
          </div>
        </div>
        {metrics.containers.list.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-navy-700">
                  <th className="text-left py-2 px-2">Container</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">CPU %</th>
                  <th className="text-right py-2 px-2">Memory</th>
                  <th className="text-left py-2 px-2">Ports</th>
                </tr>
              </thead>
              <tbody>
                {metrics.containers.list
                  .sort((a, b) => {
                    const cpuA = parseFloat(a.cpu) || 0;
                    const cpuB = parseFloat(b.cpu) || 0;
                    return cpuB - cpuA;
                  })
                  .map((c, i) => {
                    const isUp = c.status.toLowerCase().includes('up');
                    const cpuVal = parseFloat(c.cpu) || 0;
                    return (
                      <tr key={i} className="border-t border-navy-700/50 hover:bg-navy-700/30">
                        <td className="py-2 px-2 text-white font-mono text-xs">{c.name}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isUp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-green-400' : 'bg-red-400'}`}></span>
                            {c.status}
                          </span>
                        </td>
                        <td className={`py-2 px-2 text-right font-mono ${cpuVal > 50 ? 'text-red-400' : cpuVal > 20 ? 'text-yellow-400' : 'text-green-400'}`}>{c.cpu}</td>
                        <td className="py-2 px-2 text-right text-gray-300 font-mono text-xs">{c.memory}</td>
                        <td className="py-2 px-2 text-gray-400 font-mono text-xs">{c.ports || '-'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400">No Docker containers detected</p>
            <p className="text-gray-500 text-xs">Ensure Docker is running on the host</p>
          </div>
        )}
      </div>

      {/* Load level indicator */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
        <h3 className="text-white font-medium mb-4">System Load Level</h3>
        {(() => {
          const load = metrics.cpu.loadAvg[0] / metrics.cpu.cores;
          const level = load > 1 ? 'OVERLOADED' : load > 0.7 ? 'HIGH' : load > 0.4 ? 'MODERATE' : 'LOW';
          const color = load > 1 ? 'text-red-400' : load > 0.7 ? 'text-yellow-400' : load > 0.4 ? 'text-blue-400' : 'text-green-400';
          const bgColor = load > 1 ? 'bg-red-400' : load > 0.7 ? 'bg-yellow-400' : load > 0.4 ? 'bg-blue-400' : 'bg-green-400';
          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-lg font-bold ${color}`}>{level}</span>
                <span className="text-gray-400 text-sm">Load/Core: {load.toFixed(2)}</span>
              </div>
              <div className="h-3 bg-navy-700 rounded-full overflow-hidden">
                <div className={`h-full ${bgColor} rounded-full transition-all`} style={{ width: `${Math.min(load * 100, 100)}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low</span><span>Moderate</span><span>High</span><span>Overloaded</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
