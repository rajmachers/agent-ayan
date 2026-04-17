'use client'

import { useRouter } from 'next/navigation'
import { useSimulation } from '@/context/SimulationContext'
import { useState, useEffect } from 'react'
import { BATCHES, EXAM_TYPES, CANDIDATE_NAMES, SCENARIOS, TENANTS } from '@/lib/constants'
import { HintIcon } from '@/components/HintIcon'

export default function SetupPage() {
  const router = useRouter()
  const { initializeSession, loadSessionFromControlPlane, session: currentSession } = useSimulation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedSession, setSavedSession] = useState<any>(null)

  useEffect(() => {
    // Check if there's a saved session in localStorage
    const saved = localStorage.getItem('simulator-session')
    if (saved) {
      try {
        setSavedSession(JSON.parse(saved))
      } catch (err) {
        console.error('Failed to parse saved session:', err)
      }
    }
  }, [])

  const [formData, setFormData] = useState({
    tenantId: TENANTS[0].id,
    batch: BATCHES[0].id,
    examType: EXAM_TYPES[0].id,
    scenario: 'realistic',
  })

  const selectedTenant = TENANTS.find((t) => t.id === formData.tenantId)
  const selectedBatch = BATCHES.find((b) => b.id === formData.batch)
  const selectedExam = EXAM_TYPES.find((e) => e.id === formData.examType)
  const selectedScenario = SCENARIOS.find((s) => s.id === formData.scenario)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await initializeSession({
        tenantId: formData.tenantId,
        tenantName: selectedTenant?.name || 'Unknown',
        tenantEmail: selectedTenant?.spocEmail || '',
        batchId: formData.batch,
        examType: formData.examType,
        scenario: formData.scenario,
      })
      router.push('/exam-monitor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize session')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitForManualTesting = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await initializeSession({
        tenantId: formData.tenantId,
        tenantName: selectedTenant?.name || 'Unknown',
        tenantEmail: selectedTenant?.spocEmail || '',
        batchId: formData.batch,
        examType: formData.examType,
        scenario: formData.scenario,
      })
      router.push('/credentials')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize session')
    } finally {
      setLoading(false)
    }
  }

  const handleResume = () => {
    router.push('/exam-monitor')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">⚙️ Setup Simulation</h1>
        <p className="text-slate-400">Configure your proctoring scenario in 4 steps</p>
      </div>

      {/* Resume Session Section */}
      {savedSession && (
        <div className="bg-green-900/30 border border-green-600 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <h3 className="text-lg font-bold text-green-400">Session Recovered</h3>
              <p className="text-sm text-slate-300">
                Found a previous simulation session: <strong>{savedSession.tenantName}</strong> - {savedSession.batchId}
              </p>
            </div>
          </div>
          <button
            onClick={handleResume}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            📋 Resume Simulation
          </button>
          <p className="text-xs text-slate-400 text-center">
            Resuming will load your previous candidates and exam state
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Tenant */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold text-sm">1</span>
            <h2 className="text-xl font-bold">Select Tenant</h2>
            <HintIcon
              icon="ℹ️"
              size="sm"
              title="Tenant Selection"
              description="Select your organization from the list of registered tenants. This identifies your institution in the proctoring system."
              examples={['Computer Science Department - University', 'Engineering College Assessment Center', 'Business School Testing Services']}
              details="Tenants are organizations registered in the platform. This selection links the simulation to your organization's records."
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">
              Organization
              <HintIcon
                icon="?"
                size="sm"
                title="Organization"
                description="Select your organization from the registered tenants"
                examples={['Universities', 'Colleges', 'Testing Centers']}
              />
            </label>
            <select
              value={formData.tenantId}
              onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 w-full"
              required
            >
              {TENANTS.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.plan})
                </option>
              ))}
            </select>
          </div>
          {selectedTenant && (
            <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4 text-sm space-y-2">
              <div><span className="text-slate-400">Domain:</span> <span className="text-cyan-400">{selectedTenant.domain}</span></div>
              <div><span className="text-slate-400">Contact:</span> <span className="text-white">{selectedTenant.spocName}</span> <span className="text-slate-500">({selectedTenant.spocEmail})</span></div>
              <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${selectedTenant.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{selectedTenant.status}</span></div>
            </div>
          )}
        </div>

        {/* Step 2: Batch */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-sm">2</span>
            <h2 className="text-xl font-bold">Select Batch</h2>
            <HintIcon
              icon="ℹ️"
              size="sm"
              title="Batch Selection"
              description="Choose a cohort of 10 candidates. Each batch represents candidates from different time slots."
              examples={['Morning Batch: 8am-10am', 'Afternoon Batch: 2pm-4pm', 'Evening Batch: 6pm-8pm']}
              details="Each batch has unique candidate names and characteristics. Batches simulate real exam scheduling."
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {BATCHES.map((batch) => (
              <label key={batch.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="batch"
                  value={batch.id}
                  checked={formData.batch === batch.id}
                  onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  className="sr-only"
                />
                <div className={`p-4 rounded-lg border-2 transition-all ${
                  formData.batch === batch.id
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                }`}>
                  <div className="font-semibold flex items-center gap-2">
                    {batch.name}
                    <HintIcon
                      icon="?"
                      size="sm"
                      title={batch.name}
                      description={`${batch.startTime} - ${batch.endTime} in ${batch.location}`}
                      details="10 unique candidates assigned to this time slot."
                    />
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{batch.startTime} - {batch.endTime}</div>
                  <div className="text-xs text-slate-500 mt-2">{batch.location}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Step 3: Exam Type */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center font-bold text-sm">3</span>
            <h2 className="text-xl font-bold">Exam Type</h2>
            <HintIcon
              icon="ℹ️"
              size="sm"
              title="Exam Types"
              description="Select the subject/course being proctored. Different exams have different durations and difficulty levels."
              examples={['Engineering: 120 minutes', 'Data Science: 90 minutes', 'Python: 90 minutes']}
              details="Exam type affects baseline expectations and scoring standards for the cohort."
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {EXAM_TYPES.map((exam) => (
              <label key={exam.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="exam"
                  value={exam.id}
                  checked={formData.examType === exam.id}
                  onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                  className="sr-only"
                />
                <div className={`p-4 rounded-lg border-2 transition-all ${
                  formData.examType === exam.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                }`}>
                  <div className="font-semibold flex items-center gap-2">
                    {exam.name}
                    <HintIcon
                      icon="?"
                      size="sm"
                      title={exam.name}
                      description={`${exam.duration} minutes, ${exam.difficulty} difficulty`}
                      details="Affects scoring baselines and violation thresholds."
                    />
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{exam.duration}m</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Step 4: Scenario */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">4</span>
            <h2 className="text-xl font-bold">Violation Scenario</h2>
            <HintIcon
              icon="ℹ️"
              size="sm"
              title="Violation Scenarios"
              description="Predefined violation intensity levels. Determines how many violations occur and their frequency during the exam."
              examples={['Conservative: Test detection with few violations', 'Realistic: Normal exam with typical violations', 'Aggressive: Stress test with many violations']}
              details="Use Conservative to verify system works, Realistic for demos, Aggressive to test limits."
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {SCENARIOS.map((s) => (
              <label key={s.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="scenario"
                  value={s.id}
                  checked={formData.scenario === s.id}
                  onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
                  className="sr-only"
                />
                <div className={`p-4 rounded-lg border-2 transition-all ${
                  formData.scenario === s.id
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                }`}>
                  <div className="font-semibold flex items-center gap-2">
                    {s.name}
                    <HintIcon
                      icon="?"
                      size="sm"
                      title={s.name}
                      description={s.description}
                      details={`Up to ${s.maxViolations} violations can occur in this scenario.`}
                    />
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{s.description}</div>
                  <div className="text-xs text-slate-500 mt-2">Max: 0-{s.maxViolations} violations</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">📋 Summary</h2>
            <HintIcon
              icon="ℹ️"
              size="sm"
              title="Summary Preview"
              description="Review all settings before starting the simulation. This summary shows your configuration."
              details="Make sure all selections are correct. You can go back to change any setting."
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Organization</p>
              <p className="font-semibold mt-1">{selectedTenant?.name || '(Select tenant)'}</p>
            </div>
            <div>
              <p className="text-slate-400">Contact</p>
              <p className="font-semibold mt-1">{selectedTenant?.spocEmail || '(No contact)'}</p>
            </div>
            <div>
              <p className="text-slate-400">Batch</p>
              <p className="font-semibold mt-1">{selectedBatch?.name} ({CANDIDATE_NAMES[formData.batch === 'batch-1' ? 'morning' : formData.batch === 'batch-2' ? 'afternoon' : 'evening']?.length || 10} candidates)</p>
            </div>
            <div>
              <p className="text-slate-400">Exam</p>
              <p className="font-semibold mt-1">{selectedExam?.name} ({selectedExam?.duration}m)</p>
            </div>
            <div>
              <p className="text-slate-400">Scenario</p>
              <p className="font-semibold mt-1">{selectedScenario?.name}</p>
            </div>
            <div>
              <p className="text-slate-400">Max Violations</p>
              <p className="font-semibold mt-1">0-{selectedScenario?.maxViolations}</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !formData.tenantId}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? '⏳ Initializing...' : (
              <>
                <span>🎮</span>
                <span>Start Simulation</span>
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleSubmitForManualTesting}
            disabled={loading || !formData.tenantId}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? '⏳ Initializing...' : (
              <>
                <span>🔐</span>
                <span>Get Credentials for Manual Testing</span>
              </>
            )}
          </button>
        </div>
        
        <div className="text-center text-sm text-slate-400 space-y-1">
          <p><strong>Simulation:</strong> Watch automated violations and AI responses</p>
          <p><strong>Manual Testing:</strong> Get candidate credentials to test real user experience</p>
        </div>
      </form>
    </div>
  )
}
