import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ContainerInfo {
  name: string;
  status: string;
  cpu: string;
  memory: string;
  ports: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'stopped';
}

async function getDockerContainers(): Promise<ContainerInfo[]> {
  try {
    const { stdout } = await execAsync(
      'docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}" 2>/dev/null',
      { timeout: 5000 }
    );
    if (!stdout.trim()) return [];

    const containers: ContainerInfo[] = stdout.trim().split('\n').map(line => {
      const [name, status, ports] = line.split('|');
      const isUp = status?.toLowerCase().includes('up');
      return {
        name: name || 'unknown',
        status: status || 'unknown',
        cpu: '-',
        memory: '-',
        ports: ports || '',
        health: isUp ? 'healthy' : 'stopped',
      };
    });

    // Try to get stats for running containers
    try {
      const { stdout: statsOut } = await execAsync(
        'docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemPerc}}" 2>/dev/null',
        { timeout: 10000 }
      );
      if (statsOut.trim()) {
        const statsMap: Record<string, { cpu: string; mem: string }> = {};
        statsOut.trim().split('\n').forEach(l => {
          const [n, c, m] = l.split('|');
          if (n) statsMap[n] = { cpu: c || '0%', mem: m || '0%' };
        });
        containers.forEach(c => {
          if (statsMap[c.name]) {
            c.cpu = statsMap[c.name].cpu;
            c.memory = statsMap[c.name].mem;
          }
        });
      }
    } catch {}

    return containers;
  } catch {
    return [];
  }
}

export async function GET() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptime = os.uptime();

  // CPU usage approximation from load average
  const loadAvg = os.loadavg();
  const cpuCount = cpus.length;
  const cpuUsage = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100));

  const memoryUsage = Math.round((usedMem / totalMem) * 100);

  const containers = await getDockerContainers();

  return NextResponse.json({
    cpu: {
      usage: cpuUsage,
      cores: cpuCount,
      model: cpus[0]?.model || 'Unknown',
      loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
    },
    memory: {
      usage: memoryUsage,
      total: Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10,
      used: Math.round(usedMem / (1024 * 1024 * 1024) * 10) / 10,
      free: Math.round(freeMem / (1024 * 1024 * 1024) * 10) / 10,
    },
    uptime: {
      seconds: uptime,
      formatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    },
    containers,
    timestamp: new Date().toISOString(),
  });
}
