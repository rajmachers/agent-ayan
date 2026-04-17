'use client';

import { useState, useEffect } from 'react';
import { Globe, Server, Activity, CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink } from 'lucide-react';

interface ServiceHealth {
  name: string;
  url: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'checking';
  latency?: number;
}

const SERVICES: Omit<ServiceHealth, 'status' | 'latency'>[] = [
  { name: 'Session Manager', url: 'http://localhost:8181', port: 8181 },
  { name: 'Control Plane', url: 'http://localhost:4101', port: 4101 },
  { name: 'Quiz App', url: 'http://localhost:3101', port: 3101 },
  { name: 'Admin Dashboard', url: 'http://localhost:3103', port: 3103 },
  { name: 'Keycloak (IAM)', url: 'http://localhost:8080', port: 8080 },
  { name: 'Grafana (Monitoring)', url: 'http://localhost:3002', port: 3002 },
  { name: 'Prometheus', url: 'http://localhost:9091', port: 9091 },
  { name: 'LiveKit (Media)', url: 'http://localhost:7880', port: 7880 },
  { name: 'PostgreSQL', url: 'http://localhost:5432', port: 5432 },
  { name: 'Redis', url: 'http://localhost:6379', port: 6379 },
  { name: 'MinIO (Storage)', url: 'http://localhost:9000', port: 9000 },
  { name: 'MinIO Console', url: 'http://localhost:9090', port: 9090 },
];

export default function Integrations() {
  const [services, setServices] = useState<ServiceHealth[]>(
    SERVICES.map(s => ({ ...s, status: 'checking' as const }))
  );
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkServices = async () => {
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 3000);
          await fetch(svc.url, { mode: 'no-cors', signal: controller.signal });
          return { ...svc, status: 'healthy' as const, latency: Date.now() - start };
        } catch {
          return { ...svc, status: 'unhealthy' as const, latency: undefined };
        }
      })
    );
    setServices(results);
    setLastCheck(new Date());
  };

  useEffect(() => {
    checkServices();
    const iv = setInterval(checkServices, 15000);
    return () => clearInterval(iv);
  }, []);

  const healthy = services.filter(s => s.status === 'healthy').length;
  const unhealthy = services.filter(s => s.status === 'unhealthy').length;
  const checking = services.filter(s => s.status === 'checking').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Integrations</h2>
          <p className="text-gray-400 text-sm">Service health & connectivity status</p>
        </div>
        <div className="flex items-center gap-3">
          {lastCheck && <span className="text-gray-500 text-xs">Last: {lastCheck.toLocaleTimeString()}</span>}
          <button onClick={checkServices} className="px-3 py-1 rounded bg-navy-700 text-gray-300 text-xs hover:bg-navy-600">Re-check All</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <div className="text-2xl font-bold text-green-400">{healthy}</div>
            <div className="text-xs text-gray-400">Healthy</div>
          </div>
        </div>
        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-400" />
          <div>
            <div className="text-2xl font-bold text-red-400">{unhealthy}</div>
            <div className="text-xs text-gray-400">Unreachable</div>
          </div>
        </div>
        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700 flex items-center gap-3">
          <Clock className="w-6 h-6 text-yellow-400" />
          <div>
            <div className="text-2xl font-bold text-yellow-400">{checking}</div>
            <div className="text-xs text-gray-400">Checking</div>
          </div>
        </div>
      </div>

      {/* Service grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((svc, i) => (
          <div key={i} className={`bg-navy-800 rounded-lg p-4 border ${svc.status === 'healthy' ? 'border-green-500/30' : svc.status === 'unhealthy' ? 'border-red-500/30' : 'border-navy-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${svc.status === 'healthy' ? 'bg-green-400' : svc.status === 'unhealthy' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`}></div>
                <span className="text-white font-medium text-sm">{svc.name}</span>
              </div>
              {svc.status === 'healthy' && (
                <a href={svc.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-cyan-400">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Port: {svc.port}</p>
              {svc.latency !== undefined && <p>Latency: {svc.latency}ms</p>}
              <p className={svc.status === 'healthy' ? 'text-green-400' : svc.status === 'unhealthy' ? 'text-red-400' : 'text-yellow-400'}>
                {svc.status === 'healthy' ? 'Connected' : svc.status === 'unhealthy' ? 'Unreachable' : 'Checking...'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Integration architecture */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
        <div className="flex items-center gap-2 mb-4"><Globe className="w-5 h-5 text-cyan-400" /><h3 className="text-white font-medium">Architecture Overview</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-navy-700/50 rounded-lg p-4">
            <h4 className="text-cyan-400 font-medium mb-2">Application Layer</h4>
            <ul className="text-gray-300 space-y-1 text-xs">
              <li>• Quiz App (Next.js) :3001</li>
              <li>• Admin Dashboard (Next.js) :3003</li>
              <li>• API Gateway → Control Plane :4001</li>
            </ul>
          </div>
          <div className="bg-navy-700/50 rounded-lg p-4">
            <h4 className="text-purple-400 font-medium mb-2">Infrastructure</h4>
            <ul className="text-gray-300 space-y-1 text-xs">
              <li>• PostgreSQL :5432</li>
              <li>• Redis :6379</li>
              <li>• MinIO (S3) :9000</li>
              <li>• LiveKit (WebRTC) :7880</li>
            </ul>
          </div>
          <div className="bg-navy-700/50 rounded-lg p-4">
            <h4 className="text-green-400 font-medium mb-2">Observability & Auth</h4>
            <ul className="text-gray-300 space-y-1 text-xs">
              <li>• Keycloak (SSO/IAM) :8080</li>
              <li>• Grafana (Dashboards) :3002</li>
              <li>• Prometheus (Metrics) :9091</li>
              <li>• Session Manager (WS) :8081</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
