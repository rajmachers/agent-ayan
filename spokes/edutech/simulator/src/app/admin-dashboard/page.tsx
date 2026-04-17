'use client'

import Link from 'next/link'
import { useSimulation } from '@/context/SimulationContext'
import { useState } from 'react'
import { ScoreCalculator } from '@/lib/score-calculator'
import { HintIcon } from '@/components/HintIcon'

export default function AdminDashboardPage() {
  const { session, executeBatchAction } = useSimulation()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lockDuration, setLockDuration] = useState(30)
  const [loading, setLoading] = useState(false)

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No active session. Please start from Setup page.</p>
      </div>
    )
  }

  const criticalCandidates = session.candidates.filter((c) => ScoreCalculator.getRiskLevel(c.zScore) === 'critical')

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === session.candidates.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(session.candidates.map((c) => c.id))
    }
  }

  const handleBatchAction = async (action: string) => {
    if (selectedIds.length === 0) return
    setLoading(true)
    try {
      await executeBatchAction(selectedIds, action, action === 'lock' ? lockDuration : undefined)
      setSelectedIds([])
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-2">
          ⚙️ Admin Dashboard
          <HintIcon
            icon="ℹ️"
            size="md"
            title="Admin Dashboard"
            description="Control panel for batch operations on multiple candidates. Lock, pause, resume, flag, or terminate candidates."
            examples={['Lock cheaters for 30 mins', 'Pause all for a break', 'Resume normal testing']}
            details="Use batch operations to manage multiple candidates efficiently."
          />
        </h1>
        <p className="text-slate-400">Manage candidates and execute batch actions</p>
      </div>

      {/* Critical Alert */}
      {criticalCandidates.length > 0 && (
        <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🚨</span>
            <h3 className="text-lg font-bold text-red-300">CRITICAL ALERTS</h3>
            <HintIcon
              icon="?"
              size="sm"
              title="Critical Alerts"
              description="Candidates with very low performance (Z-score ≤ -1.5). Require immediate attention."
              details="Consider locking or pausing these candidates for manual review."
            />
          </div>
          <div className="space-y-1">
            {criticalCandidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-red-500/5 rounded px-3 py-1">
                <span className="text-red-300">
                  {c.name} - Score: {c.score.toFixed(0)}, Z: {c.zScore.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Actions */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">🎯 Batch Actions</h2>
          <HintIcon
            icon="ℹ️"
            size="sm"
            title="Batch Actions"
            description="Apply the same action to multiple selected candidates simultaneously."
            details="Select candidates with checkboxes, then choose an action button."
          />
        </div>

        {/* Selection Control */}
        <div className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.length === session.candidates.length && session.candidates.length > 0}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span>
              Select All ({selectedIds.length}/{session.candidates.length})
            </span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2">
              <span className="text-sm">Lock Duration (min):</span>
              <HintIcon
                icon="?"
                size="sm"
                title="Lock Duration"
                description="How long candidates will be locked from continuing their exam."
                examples={['5 min: Quick investigation', '30 min: Extended review', '240 min: Rest of exam']}
                details="Range: 5-240 minutes. Auto-unlock after duration."
              />
              <input
                type="number"
                min="5"
                max="240"
                value={lockDuration}
                onChange={(e) => setLockDuration(Math.max(5, Math.min(240, parseInt(e.target.value) || 30)))}
                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"
              />
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => handleBatchAction('lock')}
            disabled={selectedIds.length === 0 || loading}
            className="px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
          >
            🔒 Lock
            <HintIcon
              icon="?"
              size="sm"
              title="Lock Candidates"
              description="Prevents selected candidates from continuing their exam for the specified duration."
              examples={['Detect cheating', 'Investigate anomalies', 'Technical issues']}
              details="Locked candidates show 🔒 icon. Auto-unlock after duration."
            />
          </button>

          <button
            onClick={() => handleBatchAction('pause')}
            disabled={selectedIds.length === 0 || loading}
            className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
          >
            ⏸️ Pause
            <HintIcon
              icon="?"
              size="sm"
              title="Pause Candidates"
              description="Freeze scoring and progress for selected candidates. They can resume later."
              examples={['System maintenance', 'Candidate rest break', 'Technical issues']}
              details="Paused candidates show ⏸️ icon. No scoring happens while paused."
            />
          </button>

          <button
            onClick={() => handleBatchAction('resume')}
            disabled={selectedIds.length === 0 || loading}
            className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
          >
            ▶️ Resume
            <HintIcon
              icon="?"
              size="sm"
              title="Resume Candidates"
              description="Return selected candidates to active testing. Scoring resumes."
              examples={['After investigation', 'After break', 'Technical fix']}
              details="Resumed candidates return to ✅ active state."
            />
          </button>

          <button
            onClick={() => handleBatchAction('flag')}
            disabled={selectedIds.length === 0 || loading}
            className="px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
          >
            🚩 Flag
            <HintIcon
              icon="?"
              size="sm"
              title="Flag Candidates"
              description="Mark selected candidates for manual review. Exam continues normally."
              examples={['Suspicious behavior', 'Borderline violations', 'Further review needed']}
              details="Flagged candidates show 🚩 alert. Can continue testing."
            />
          </button>

          <button
            onClick={() => handleBatchAction('terminate')}
            disabled={selectedIds.length === 0 || loading}
            className="px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
          >
            🛑 Terminate
            <HintIcon
              icon="?"
              size="sm"
              title="Terminate Candidates"
              description="End exam immediately for selected candidates. Final score is locked."
              examples={['Critical violations', 'Academic dishonesty', 'Exam rules violation']}
              details="Terminated candidates show 🛑 icon. Cannot resume."
            />
          </button>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">👥 All Candidates</h2>
            <HintIcon
              icon="?"
              size="sm"
              title="Candidates Table"
              description="Interactive table showing all 10 candidates with current stats. Click row or checkbox to select."
              details="Use checkboxes to select multiple candidates for batch operations."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === session.candidates.length && session.candidates.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Z-Score</th>
                <th className="px-4 py-3 text-right">Violations</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {session.candidates.map((candidate) => {
                const riskLevel = ScoreCalculator.getRiskLevel(candidate.zScore)
                const riskColors = {
                  excellent: 'text-green-400',
                  good: 'text-emerald-400',
                  average: 'text-yellow-400',
                  'high-risk': 'text-orange-400',
                  critical: 'text-red-400',
                }

                return (
                  <tr
                    key={candidate.id}
                    onClick={() => toggleCandidate(candidate.id)}
                    className={`border-b border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-all ${
                      selectedIds.includes(candidate.id) ? 'bg-blue-500/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(candidate.id)}
                        onChange={() => toggleCandidate(candidate.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{candidate.name}</td>
                    <td className="px-4 py-3 text-right font-bold">{candidate.score.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono">{candidate.zScore.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{candidate.violations.length}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 rounded text-xs font-bold capitalize bg-slate-700">
                        {candidate.status === 'active' && '✅ Active'}
                        {candidate.status === 'paused' && '⏸️ Paused'}
                        {candidate.status === 'locked' && '🔒 Locked'}
                        {candidate.status === 'terminated' && '🛑 Terminated'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold capitalize ${riskColors[riskLevel]}`}>{riskLevel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/exam-monitor">
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
            ← Back to Monitor
          </button>
        </Link>
        <Link href="/analytics">
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
            📈 Analytics
          </button>
        </Link>
      </div>
    </div>
  )
}
