'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSimulation } from '@/context/SimulationContext';

export default function AnalyticsPage() {
  const { session } = useSimulation();
  
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-400 mb-4">No active simulation session</p>
          <Link 
            href="/setup"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
          >
            Create New Session
          </Link>
        </div>
      </div>
    );
  }

  const candidates = session.candidates || [];

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalSessions = 1;
    const totalCandidates = candidates.length;
    const violationCounts = candidates.reduce((acc, c) => acc + (c.violations?.length || 0), 0);
    const highRiskCandidates = candidates.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length;

    return {
      totalSessions,
      totalCandidates,
      violationCounts,
      highRiskCandidates,
      avgViolationsPerCandidate: totalCandidates > 0 ? (violationCounts / totalCandidates).toFixed(2) : 0
    };
  }, [session, candidates]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <Link 
              href="/setup"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
            >
              Back to Setup
            </Link>
          </div>
          <p className="text-gray-400">Real-time analytics and violation statistics</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-blue-950/50 border border-blue-500/30 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">Total Sessions</div>
            <div className="text-3xl font-bold text-blue-400">{stats.totalSessions}</div>
          </div>

          <div className="bg-purple-950/50 border border-purple-500/30 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">Total Candidates</div>
            <div className="text-3xl font-bold text-purple-400">{stats.totalCandidates}</div>
          </div>

          <div className="bg-orange-950/50 border border-orange-500/30 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">Total Violations</div>
            <div className="text-3xl font-bold text-orange-400">{stats.violationCounts}</div>
          </div>

          <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">High Risk Candidates</div>
            <div className="text-3xl font-bold text-red-400">{stats.highRiskCandidates}</div>
          </div>

          <div className="bg-green-950/50 border border-green-500/30 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">Avg Violations/Candidate</div>
            <div className="text-3xl font-bold text-green-400">{stats.avgViolationsPerCandidate}</div>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold">Candidates Overview</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 text-gray-300 text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Violations</th>
                  <th className="px-6 py-3 text-left">Risk Level</th>
                  <th className="px-6 py-3 text-left">Score</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-gray-400 text-center">
                      No candidates yet. Create a session to start.
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-slate-800/50 transition">
                      <td className="px-6 py-3 text-white">{candidate.name}</td>
                      <td className="px-6 py-3">
                        <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm">
                          {candidate.violations?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          candidate.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-300' :
                          candidate.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-300' :
                          candidate.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {candidate.riskLevel || 'LOW'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-300">{(candidate.score || 0).toFixed(1)}</td>
                      <td className="px-6 py-3">
                        <span className="text-gray-400 text-sm">Active</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Background gradient */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}
