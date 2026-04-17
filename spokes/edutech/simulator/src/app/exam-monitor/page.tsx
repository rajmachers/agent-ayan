'use client'

import Link from 'next/link'
import { useSimulation } from '@/context/SimulationContext'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScoreCalculator } from '@/lib/score-calculator'
import { HintIcon } from '@/components/HintIcon'
import { EXAM_TYPES, VIOLATION_TYPES } from '@/lib/constants'
import { apiClient } from '@/lib/api-client'

interface ViolationForm {
  candidateId: string
  violationType: string
  severity: 'watch' | 'warning' | 'critical'
}

export default function ExamMonitorPage() {
  const router = useRouter()
  const { session, injectViolation, clearSession, ensureSessionInGateway } = useSimulation()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showViolationModal, setShowViolationModal] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [violationForm, setViolationForm] = useState<ViolationForm>({
    candidateId: '',
    violationType: 'eye_contact',
    severity: 'warning',
  })
  const [loading, setLoading] = useState(false)

  const selectedExam = session ? EXAM_TYPES.find((exam) => exam.id === session.examType) : null
  const examDurationSeconds = selectedExam ? selectedExam.duration * 60 : 0

  useEffect(() => {
    if (!session) window.location.href = '/setup'
  }, [session])

  useEffect(() => {
    if (!session) return
    ensureSessionInGateway().catch((error) => {
      console.error('Failed to ensure session sync in gateway:', error)
    })
  }, [session, ensureSessionInGateway])

  useEffect(() => {
    if (!session || !selectedExam || sessionExpired) return

    const syncRemaining = async () => {
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000)
      const nextRemaining = Math.max(0, examDurationSeconds - elapsed)
      setRemainingSeconds(nextRemaining)

      if (nextRemaining !== 0) return

      setSessionExpired(true)

      const submittedCandidates = (session.candidates || []).map((candidate) => ({
        ...candidate,
        status: 'submitted',
      }))

      await apiClient.updateSessionStatus(
        session.id,
        'time_expired',
        'Auto submitted by simulator after exam timer reached zero',
        submittedCandidates
      )

      clearSession()
      router.push('/?sessionEnded=1')
    }

    syncRemaining()
    const timer = setInterval(syncRemaining, 1000)
    return () => clearInterval(timer)
  }, [session, selectedExam, examDurationSeconds, sessionExpired, clearSession, router])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      // Force re-render by updating state
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleInjectViolation = async () => {
    if (!violationForm.candidateId || !session) return

    setLoading(true)
    try {
      await injectViolation(violationForm.candidateId, violationForm.violationType, violationForm.severity)
      setShowViolationModal(false)
      setViolationForm({ candidateId: '', violationType: 'eye_contact', severity: 'warning' })
    } catch (error) {
      console.error('Failed to inject violation:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  const selectedViolationType = VIOLATION_TYPES.find((v) => v.id === violationForm.violationType)
  const candidate = session.candidates.find((c) => c.id === violationForm.candidateId)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(session.candidates.length / pageSize))
  const paginatedCandidates = session.candidates.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-2">
          📊 Exam Monitor
          <HintIcon
            icon="ℹ️"
            size="md"
            title="Exam Monitor"
            description="Real-time monitoring dashboard showing all candidates and their current scores, Z-scores, and violations."
            examples={['Watch scores update in real-time', 'Inject violations to test system', 'Monitor cohort performance']}
            details="This is the main proctoring interface where you observe and interact with candidates during their exams."
          />
        </h1>
        <p className="text-slate-400">
          Session: <span className="text-blue-300 font-mono">{session.id.slice(-8)}</span> | Batch:{' '}
          <span className="text-green-300">{session.batchId}</span>
        </p>
        {selectedExam && remainingSeconds !== null && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm">
            <span className="text-slate-300">Exam Duration:</span>
            <span className="font-semibold text-cyan-300">{selectedExam.duration}m</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">Time Remaining:</span>
            <span className={`font-mono font-bold ${remainingSeconds <= 60 ? 'text-red-400' : 'text-green-300'}`}>
              {Math.floor(remainingSeconds / 60)}m {remainingSeconds % 60}s
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-semibold">
              ⏱️ Auto-refresh (5s)
              <HintIcon
                icon="?"
                size="sm"
              title="Auto-Refresh"
              description="When enabled, scores and statistics update automatically every 5 seconds."
              details="Disable if you want manual control over refresh timing."
            />
          </span>
        </label>

        <Link 
          href="/credentials"
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm"
        >
          🔐 View Credentials
        </Link>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setShowViolationModal(true)}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all flex items-center gap-2"
        >
          ➕ Add Violation
          <HintIcon
            icon="?"
            size="sm"
            title="Add Violation"
            description="Click to open the violation injector modal. Select a candidate and violation type to simulate a proctoring event."
            details="Violations automatically update scores and trigger auto-escalation rules if thresholds are met."
          />
        </button>
      </div>
      </div>

      {/* Candidate Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold">Candidate Monitor</h3>
          <span className="text-sm text-slate-300">Page {currentPage} of {totalPages}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-slate-300">Name</th>
                <th className="px-4 py-3 text-left text-slate-300">Status</th>
                <th className="px-4 py-3 text-right text-slate-300">Score</th>
                <th className="px-4 py-3 text-right text-slate-300">Z-Score</th>
                <th className="px-4 py-3 text-right text-slate-300">Percentile</th>
                <th className="px-4 py-3 text-right text-slate-300">Violations</th>
                <th className="px-4 py-3 text-left text-slate-300">Risk</th>
                <th className="px-4 py-3 text-right text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCandidates.map((candidate) => {
                const riskLevel = ScoreCalculator.getRiskLevel(candidate.zScore)
                const riskClass =
                  riskLevel === 'excellent'
                    ? 'text-green-300 bg-green-500/20'
                    : riskLevel === 'good'
                    ? 'text-emerald-300 bg-emerald-500/20'
                    : riskLevel === 'average'
                    ? 'text-yellow-300 bg-yellow-500/20'
                    : riskLevel === 'high-risk'
                    ? 'text-orange-300 bg-orange-500/20'
                    : 'text-red-300 bg-red-500/20'

                return (
                  <tr key={candidate.id} className="border-b border-slate-700/60 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-semibold text-white">{candidate.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-100">
                        {candidate.status === 'active' ? '✅ Active' : candidate.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">{candidate.score.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{candidate.zScore.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-100">{candidate.percentile.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-100">{candidate.violations.length}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${riskClass}`}>
                        {riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setViolationForm({ ...violationForm, candidateId: candidate.id })
                          setShowViolationModal(true)
                        }}
                        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                      >
                        Inject
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-900/40">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-slate-300">
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, session.candidates.length)} of {session.candidates.length}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold">Cohort Summary</h3>
          <HintIcon
            icon="?"
            size="sm"
            title="Cohort Summary"
            description="Breakdown of all candidates by risk level. Shows distribution of exam performance."
            details="Use this to identify which candidates need intervention."
          />
        </div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: 'Excellent', count: session.candidates.filter((c) => ScoreCalculator.getRiskLevel(c.zScore) === 'excellent').length, color: 'text-green-400' },
            { label: 'Good', count: session.candidates.filter((c) => ScoreCalculator.getRiskLevel(c.zScore) === 'good').length, color: 'text-emerald-400' },
            { label: 'Average', count: session.candidates.filter((c) => ScoreCalculator.getRiskLevel(c.zScore) === 'average').length, color: 'text-yellow-400' },
            { label: 'High-Risk', count: session.candidates.filter((c) => ScoreCalculator.getRiskLevel(c.zScore) === 'high-risk').length, color: 'text-orange-400' },
            { label: 'Critical', count: session.candidates.filter((c) => ScoreCalculator.getRiskLevel(c.zScore) === 'critical').length, color: 'text-red-400' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-900/50 rounded p-2">
              <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
              <div className="text-xs text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/analytics">
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
            📈 Analytics
          </button>
        </Link>
      </div>

      {/* Violation Injector Modal */}
      {showViolationModal && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
          onClick={() => setShowViolationModal(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                ➕ Inject Violation
                <HintIcon
                  icon="?"
                  size="md"
                  title="Violation Injector"
                  description="Modal to inject a proctoring violation for a candidate. Simulates detected anomalous behavior."
                  examples={['Tab switching', 'Audio detection', 'Screen share']}
                  details="After injection, score updates, Z-score recalculates, and auto-escalation rules are checked."
                />
              </h2>
              <button
                onClick={() => setShowViolationModal(false)}
                className="text-slate-400 hover:text-slate-200 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Candidate Selector */}
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  Select Candidate
                  <HintIcon
                    icon="?"
                    size="sm"
                    title="Candidate Selection"
                    description="Choose which candidate is experiencing the violation."
                    details="Once selected, you'll see their current score and other stats."
                  />
                </label>
                <select
                  value={violationForm.candidateId}
                  onChange={(e) => setViolationForm({ ...violationForm, candidateId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Candidate --</option>
                  {session.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Score: {c.score.toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Violation Type */}
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  Violation Type
                  <HintIcon
                    icon="?"
                    size="sm"
                    title="Violation Types"
                    description="5 types of violations, each with different weight impact on score."
                    examples={['Movement (1 pt)', 'Eye Contact (2 pts)', 'Tab Switch (3 pts)', 'Audio (4 pts)', 'Screen Share (5 pts)']}
                    details="Higher weight = bigger score drop. Screen Share is most serious (5 pts)."
                  />
                </label>
                <div className="space-y-2">
                  {VIOLATION_TYPES.map((vtype) => (
                    <label key={vtype.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="violation"
                        value={vtype.id}
                        checked={violationForm.violationType === vtype.id}
                        onChange={(e) => setViolationForm({ ...violationForm, violationType: e.target.value })}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {vtype.name} (wt: {vtype.weight})
                      </span>
                      <HintIcon
                        icon="?"
                        size="sm"
                        title={vtype.name}
                        description={vtype.description}
                        details={`Weight: ${vtype.weight} - impacts score calculation`}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  Severity
                  <HintIcon
                    icon="?"
                    size="sm"
                    title="Severity Level"
                    description="How serious is this violation. Multiplies the weight impact."
                    examples={['Watch: 0.5x (minor)', 'Warning: 1.0x (normal)', 'Critical: 1.5x (serious)']}
                    details="Critical severity amplifies the score impact."
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['watch', 'warning', 'critical'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setViolationForm({ ...violationForm, severity: sev as any })}
                      className={`px-3 py-2 rounded-lg font-semibold transition-all ${
                        violationForm.severity === sev
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {sev === 'watch' && '👀 Watch'}
                      {sev === 'warning' && '⚠️ Warning'}
                      {sev === 'critical' && '🚨 Critical'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expected Outcome */}
              {candidate && selectedViolationType && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-300 mb-2">Expected Outcome:</p>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div>
                      Current Score: <span className="font-mono font-bold">{candidate.score.toFixed(0)}</span>
                    </div>
                    <div>
                      Penalty:{' '}
                      <span className="font-mono font-bold">
                        {(selectedViolationType.weight * (violationForm.severity === 'critical' ? 1.5 : violationForm.severity === 'warning' ? 1 : 0.5)).toFixed(1)}
                      </span>{' '}
                      pts
                    </div>
                    <div>
                      New Score:{' '}
                      <span className="font-mono font-bold">
                        {Math.max(
                          0,
                          candidate.score -
                            selectedViolationType.weight *
                              (violationForm.severity === 'critical' ? 1.5 : violationForm.severity === 'warning' ? 1 : 0.5)
                        ).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleInjectViolation}
                disabled={loading || !violationForm.candidateId}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all"
              >
                {loading ? '⏳ Injecting...' : '✅ Inject Violation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
