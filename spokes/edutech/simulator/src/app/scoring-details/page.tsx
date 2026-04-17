'use client'

import Link from 'next/link'
import { useSimulation } from '@/context/SimulationContext'
import { ScoreCalculator } from '@/lib/score-calculator'
import { useState } from 'react'
import { HintIcon } from '@/components/HintIcon'

export default function ScoringDetailsPage() {
  const { session } = useSimulation()
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No active session. Please start from Setup page.</p>
      </div>
    )
  }

  const selectedCandidate = session.candidates.find((c) => c.id === selectedCandidateId) || session.candidates[0]
  const riskLevel = ScoreCalculator.getRiskLevel(selectedCandidate.zScore)
  const riskColors = {
    excellent: 'bg-green-500/20 border-green-500 text-green-300',
    good: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
    average: 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
    'high-risk': 'bg-orange-500/20 border-orange-500 text-orange-300',
    critical: 'bg-red-500/20 border-red-500 text-red-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-2">
          📊 Scoring Details
          <HintIcon
            icon="ℹ️"
            size="md"
            title="Scoring Details"
            description="Detailed breakdown of how candidate scores are calculated from violations."
            examples={['View score components', 'Understand Z-score', 'Track risk levels']}
            details="Each violation category contributes to the final score using weighted calculations."
          />
        </h1>
        <p className="text-slate-400">Understand score calculations and risk assessment</p>
      </div>

      {/* Candidate Selector */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <label className="font-semibold">Select Candidate:</label>
          <HintIcon
            icon="?"
            size="sm"
            title="Candidate Selection"
            description="Choose which candidate's scoring details to analyze."
            details="Use dropdown to compare different candidates' scoring patterns."
          />
        </div>
        <select
          value={selectedCandidateId || selectedCandidate.id}
          onChange={(e) => setSelectedCandidateId(e.target.value)}
          className="w-full max-w-md bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
        >
          {session.candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (Score: {c.score.toFixed(0)})
            </option>
          ))}
        </select>
      </div>

      {/* Overall Score Card */}
      <div className={`border-2 rounded-lg p-6 space-y-4 ${riskColors[riskLevel]}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{selectedCandidate.name}</h2>
              <p className="text-sm opacity-75">Proctoring Assessment</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{selectedCandidate.score.toFixed(0)}</div>
              <div className="text-sm opacity-75">Final Score</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 rounded p-3">
            <div className="text-sm opacity-75">Z-Score</div>
            <div className="text-2xl font-bold">{selectedCandidate.zScore.toFixed(2)}</div>
            <HintIcon
              icon="?"
              size="sm"
              title="Z-Score"
              description="Statistical measure of how many standard deviations the score is from the mean."
              examples={['≥ 0.5: Excellent', '0 to -1: Good', '-1 to -1.5: High Risk', '≤ -1.5: Critical']}
              details="Higher Z-score indicates better (safer) performance."
            />
          </div>

          <div className="bg-white/5 rounded p-3">
            <div className="text-sm opacity-75">Violations</div>
            <div className="text-2xl font-bold">{selectedCandidate.violations.length}</div>
            <HintIcon
              icon="?"
              size="sm"
              title="Total Violations"
              description="Count of all detected violations across all categories."
              details="Each violation impacts the final score based on its severity."
            />
          </div>

          <div className="bg-white/5 rounded p-3">
            <div className="text-sm opacity-75">Risk Level</div>
            <div className="text-2xl font-bold capitalize">{riskLevel}</div>
            <HintIcon
              icon="?"
              size="sm"
              title="Risk Level"
              description="Overall assessment based on Z-score."
              examples={['Excellent', 'Good', 'Average', 'High-Risk', 'Critical']}
              details="Determines proctoring intervention priority."
            />
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">📈 Violation Breakdown</h2>
          <HintIcon
            icon="?"
            size="sm"
            title="Violation Breakdown"
            description="Count of violations by type affecting the candidate's score."
            examples={['Eye contact violations', 'Tab switching incidents', 'Audio issues', 'Movement violations']}
            details="Each violation type impacts the final score."
          />
        </div>

        <div className="space-y-3">
          {Object.entries(
            selectedCandidate.violations.reduce(
              (acc, v) => {
                acc[v.type] = (acc[v.type] || 0) + 1
                return acc
              },
              {} as Record<string, number>
            )
          ).map(([type, count]) => (
            <div key={type} className="bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize">{type.replace('_', ' ')}</span>
                  <HintIcon
                    icon="?"
                    size="sm"
                    title={type}
                    description={`Violations of type: ${type.replace('_', ' ')}`}
                    examples={[`Count: ${count}`, 'Reduces score based on severity']}
                    details={`Each ${type} violation has varying severity levels.`}
                  />
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-400">{count} violation{count !== 1 ? 's' : ''}</div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded h-2 overflow-hidden">
                <div
                  className="bg-red-500 h-full"
                  style={{
                    width: `${Math.min(100, (count / Math.max(...Object.values(selectedCandidate.violations.reduce(
                      (acc, v) => {
                        acc[v.type] = (acc[v.type] || 0) + 1
                        return acc
                      },
                      {} as Record<string, number>
                    )))) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
          {selectedCandidate.violations.length === 0 && (
            <div className="bg-slate-900/50 rounded-lg p-4 text-center text-green-300">
              ✅ No violations detected
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="bg-slate-900/50 rounded-lg p-4 mt-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm opacity-75 mb-1">Base Score</div>
              <div className="text-2xl font-bold text-green-400">100</div>
              <HintIcon
                icon="?"
                size="sm"
                title="Base Score"
                description="Starting score before any violations."
                details="100 points without any violations."
              />
            </div>

            <div>
              <div className="text-sm opacity-75 mb-1">Violations</div>
              <div className="text-2xl font-bold text-red-400">{selectedCandidate.violations.length}</div>
              <HintIcon
                icon="?"
                size="sm"
                title="Total Violations"
                description="Total number of violations detected."
                details="Each violation impacts the score based on severity."
              />
            </div>

            <div>
              <div className="text-sm opacity-75 mb-1">Final Score</div>
              <div className="text-2xl font-bold text-blue-400">{selectedCandidate.score.toFixed(0)}</div>
              <HintIcon
                icon="?"
                size="sm"
                title="Final Score"
                description="Candidate's current proctoring score."
                examples={['100 points max', 'Cannot go below 0', 'Used for risk assessment']}
                details="Based on violations and their severity."
              />
            </div>

            <div>
              <div className="text-sm opacity-75 mb-1">Mean/StdDev</div>
              <div className="text-xs font-mono">
                <div className="text-slate-400">μ: {session.cohortStats.meanScore.toFixed(1)}</div>
                <div className="text-slate-400">σ: {session.cohortStats.stdDev.toFixed(2)}</div>
              </div>
              <HintIcon
                icon="?"
                size="sm"
                title="Statistics"
                description="Population mean score and standard deviation used for Z-score calculation."
                details="Z-score = (score - mean) / standard_deviation"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Violations Timeline */}
      {selectedCandidate.violations.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">⏱️ Violation Timeline</h2>
            <HintIcon
              icon="?"
              size="sm"
              title="Violation Timeline"
              description="Chronological list of all violations detected during the exam."
              examples={['Eye contact issue at t=45s', 'Audio issue at t=1:30', 'Tab switch at t=2:15']}
              details="Violations are timestamped to track patterns and severity trends."
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedCandidate.violations
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((violation, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/50 rounded-lg p-3 border-l-4 border-orange-500 flex items-start justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {violation.type.charAt(0).toUpperCase() + violation.type.slice(1)}: {violation.description}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      Time: {(violation.timestamp / 1000).toFixed(1)}s - Severity: {violation.severity}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/exam-monitor">
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
            ← Back to Monitor
          </button>
        </Link>
      </div>
    </div>
  )
}
