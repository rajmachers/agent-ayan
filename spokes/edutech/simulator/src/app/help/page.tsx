'use client'

import Link from 'next/link'
import { useState } from 'react'

interface HelpSection {
  id: string
  title: string
  icon: string
  description: string
  details: Array<{
    label: string
    value: string
  }>
}

const helpSections: HelpSection[] = [
  {
    id: 'home',
    title: '🏠 Home Page',
    icon: '🏠',
    description: 'Landing page with workflow overview',
    details: [
      { label: 'Feature Cards', value: '6 boxes showing core capabilities - Z-Score, Real-time, Integration, Analytics, Smart Violations, Scenarios' },
      { label: 'Workflow Steps', value: '5-step interactive guide showing Setup → Monitor → Admin → Analytics → Verify' },
      { label: 'Start Button', value: 'Click to begin simulation and configure tenant/batch settings' },
      { label: 'Quick Stats', value: 'Shows 30 candidates, 5 violation types, 11 tests available' },
    ],
  },
  {
    id: 'setup',
    title: '⚙️ Setup Page',
    icon: '⚙️',
    description: 'Configure simulation parameters',
    details: [
      { label: 'Step 1: Tenant Info', value: 'Enter organization name and email - REQUIRED for all simulations' },
      { label: 'Step 2: Batch Selection', value: '3 options: Morning (08:00-10:00), Afternoon (14:00-16:00), Evening (18:00-20:00) - each has 10 unique candidates' },
      { label: 'Step 3: Exam Type', value: '3 options: Engineering (120min/hard), Data Science (90min/medium), Python (90min/medium)' },
      { label: 'Step 4: Violation Scenario', value: 'Conservative (0-2 violations), Realistic (0-8), Aggressive (0-15) - determines violation frequency' },
      { label: 'Summary Preview', value: 'Shows all selections before submission - verify all fields before clicking Start' },
      { label: 'Start Simulation', value: 'Creates 10 candidates with initial scores, redirects to Exam Monitor' },
    ],
  },
  {
    id: 'monitor',
    title: '📊 Exam Monitor',
    icon: '📊',
    description: 'Real-time candidate monitoring with violation injection',
    details: [
      { label: 'Candidate Cards (10)', value: 'Each shows Name, Score (0-100), Z-Score, Percentile, Violation count, Status icon' },
      { label: 'Color Coding', value: '🟢 Green (85-100), 🟡 Yellow (65-85), 🟠 Orange (45-65), 🔴 Red (0-45)' },
      { label: 'Status Icons', value: '✅ Active, ⏸️ Paused, 🔒 Locked, 🛑 Terminated - shows current action state' },
      { label: 'Auto-Refresh Toggle', value: 'ON = updates every 5 seconds, OFF = manual refresh only' },
      { label: 'Click Card', value: 'Opens violation injector modal for that candidate' },
      { label: 'Violation Injector', value: 'Select candidate, violation type (5 options), severity (watch/warning/critical), see predicted outcome' },
      { label: 'Violation Types', value: '👁️ Eye Contact (wt:2), 🔄 Tab Switch (wt:3), 🔊 Audio (wt:4), 📺 Screen Share (wt:5), 🚶 Movement (wt:1)' },
      { label: 'Severity Impact', value: '👀 Watch (0.5x), ⚠️ Warning (1.0x), 🚨 Critical (1.5x) - multiplier on weight' },
      { label: 'Auto-Escalation', value: 'Z-score ≤ -2.0 = Lock, ≤ -1.5 = Pause, ≤ -1.0 = Flag' },
      { label: 'Summary Stats', value: 'Bottom shows distribution: Excellent, Good, Average, High-Risk, Critical counts' },
    ],
  },
  {
    id: 'admin',
    title: '⚙️ Admin Dashboard',
    icon: '⚙️',
    description: 'Batch operations on multiple candidates',
    details: [
      { label: 'High-Risk Alert', value: 'Red banner at top showing critical candidates - updates in real-time' },
      { label: 'Multi-Select', value: 'Click checkboxes to select candidates, "Select All" button for batch ops' },
      { label: 'Lock Duration', value: 'Input field (5-240 min) for how long candidate should be locked' },
      { label: '🔒 Lock Button', value: 'Prevents further exam progress, shows ⏸️ icon, auto-unlocks after duration' },
      { label: '⏸️ Pause Button', value: 'Freezes scoring temporarily, candidate can resume, no time penalty' },
      { label: '▶️ Resume Button', value: 'Resumes from paused state, returns to active testing' },
      { label: '🚩 Flag Button', value: 'Marks for manual review, adds yellow alert banner to card, exam continues' },
      { label: '🛑 Terminate Button', value: 'Ends exam immediately, final score locked, cannot resume' },
      { label: 'Candidate Table', value: 'Shows all 10 with Name, Score, Z-Score, Violations, Status, Risk - sortable columns' },
    ],
  },
  {
    id: 'analytics',
    title: '📈 Analytics',
    icon: '📈',
    description: 'Cohort statistics and visualization',
    details: [
      { label: 'Mean Score', value: 'Average score across all candidates - target 70-80 for well-calibrated exam' },
      { label: 'Std Dev', value: 'Score variation - low (<10) = homogeneous, high (>20) = diverse performance' },
      { label: 'Total Violations', value: 'Sum across cohort - reflects proctoring needs and scenario intensity' },
      { label: 'Alerts Triggered', value: 'Count of automated alerts fired - shows system responsiveness' },
      { label: 'Risk Distribution Chart', value: 'Bar chart showing # candidates in each risk level - visual cohort breakdown' },
      { label: 'Violations by Type', value: 'Breakdown showing which violations most common - tab switching usually highest' },
      { label: 'Sorted Table', value: 'Top 10 by score: Rank, Name, Score, Z-Score, Percentile, Violation count' },
      { label: 'Percentile', value: '100th = best, 50th = median, 1st = worst - shows relative ranking' },
    ],
  },
  {
    id: 'verify',
    title: '✅ Verification',
    icon: '✅',
    description: 'E2E test suite to validate system',
    details: [
      { label: 'Run Tests Button', value: 'Click 🧪 "Run All Tests (11)" to execute full validation suite' },
      { label: 'Test 1: Session Init', value: 'Validates session created with correct ID and tenant info' },
      { label: 'Test 2: Batch Created', value: 'Validates 10 candidates created with correct names' },
      { label: 'Test 3: Score Valid', value: 'Validates scores 0-100, no NaN, precision maintained' },
      { label: 'Test 4: Z-Scores', value: 'Validates formula (score-mean)/stddev, handles edge cases' },
      { label: 'Test 5: Risk Levels', value: 'Validates correct mapping: Excellent (>1.5), Good (0.5-1.5), Average (-0.5-0.5), High-Risk (-1.5--0.5), Critical (<-1.5)' },
      { label: 'Test 6: Percentiles', value: 'Validates 0-100 range, matches normal distribution CDF' },
      { label: 'Test 7: Context Valid', value: 'Validates React context initialized with all callbacks' },
      { label: 'Test 8: Data Persist', value: 'Validates session/candidate data retained across actions' },
      { label: 'Test 9: Adaptive Weights', value: 'Validates violation weights applied, severity multipliers working' },
      { label: 'Test 10: Alert System', value: 'Validates alerts created, proper tiers assigned, messages generated' },
      { label: 'Test 11: Full Workflow', value: 'Validates Setup→Monitor→Admin→Analytics flow without errors' },
      { label: 'Results', value: '✅ PASS (green), ❌ FAIL (red/error), ⏳ RUNNING (yellow) - shows % passing' },
    ],
  },
  {
    id: 'violations',
    title: '🚨 Violation Types & Weights',
    icon: '🚨',
    description: 'Understanding violation impact',
    details: [
      { label: '👁️ Eye Contact (2 pts)', value: 'Student not looking at screen - minor concern' },
      { label: '🔄 Tab Switching (3 pts)', value: 'Browser tab switching detected - moderate concern' },
      { label: '🔊 Audio (4 pts)', value: 'Background noise or talking detected - significant concern' },
      { label: '📺 Screen Share (5 pts)', value: 'Screen sharing/external display detected - serious concern' },
      { label: '🚶 Movement (1 pt)', value: 'Excessive/unusual movement detected - low concern' },
      { label: 'Score Impact', value: 'New Score = 100 - (Violations × Weight × Severity) - each violation reduces score' },
      { label: 'Severity Multiplier', value: '👀 Watch (0.5x), ⚠️ Warning (1.0x), 🚨 Critical (1.5x)' },
      { label: 'Example', value: '1 Tab Switch (3) at Critical (1.5x) = 3×1.5 = 4.5 point drop' },
    ],
  },
  {
    id: 'zscore',
    title: '📊 Z-Score & Percentile',
    icon: '📊',
    description: 'Statistical scoring explained',
    details: [
      { label: 'Z-Score', value: 'Measures how many standard deviations from cohort mean - positive = better, negative = worse' },
      { label: 'Formula', value: 'Z = (Score - Mean) / StdDev - shows relative performance vs cohort' },
      { label: 'Percentile', value: 'Rank from 0-100% - what % of cohort scores worse than this candidate' },
      { label: 'Example', value: 'If Z=1.0 and 95th percentile: This candidate scores 1 stddev above mean, better than 95% of cohort' },
      { label: 'Excellent (🟢)', value: 'Z ≥ 1.5, top performer, no concerns' },
      { label: 'Good (🟡)', value: 'Z 0.5-1.5, above average, minor monitoring' },
      { label: 'Average (🟠)', value: 'Z -0.5-0.5, typical performance' },
      { label: 'High-Risk (🔴)', value: 'Z -1.5--0.5, below average, intervention suggested' },
      { label: 'Critical (🚨)', value: 'Z < -1.5, significantly below average, flag for review' },
    ],
  },
  {
    id: 'scenarios',
    title: '🎭 Violation Scenarios',
    icon: '🎭',
    description: 'Scenario types and use cases',
    details: [
      { label: '🟢 Conservative', value: '0-2 max violations - use to test detection of outliers in well-behaved cohort' },
      { label: '🟡 Realistic', value: '0-8 max violations - standard monitoring scenario with normal exam conditions' },
      { label: '🔴 Aggressive', value: '0-15 max violations - stress test system and rule engine with many violations' },
      { label: 'Violation Probability', value: 'Each scenario changes likelihood of each violation type occurring' },
      { label: 'Testing Use', value: 'Use Conservative to verify detection works, Aggressive to stress test limits' },
      { label: 'Demo Use', value: 'Realistic for stakeholder demos - shows natural exam behavior with manageable violations' },
    ],
  },
  {
    id: 'troubleshoot',
    title: '🔧 Troubleshooting',
    icon: '🔧',
    description: 'Common issues and solutions',
    details: [
      { label: 'Scores not updating?', value: 'Enable Auto-Refresh toggle or click refresh manually' },
      { label: 'Z-scores all 0?', value: 'Standard deviation is 0 - need score variation. Inject violations to create spread.' },
      { label: 'Auto-lock not triggering?', value: 'Z-score must reach ≤ -2.0 (very low). Need many violations or high penalties.' },
      { label: 'Control Plane error?', value: 'App has graceful fallback - keeps running locally without API' },
      { label: 'Setup page not submitting?', value: 'Check all fields filled: tenant name, email, batch, exam, scenario' },
      { label: 'Tests failing?', value: 'Check console for errors. Refresh page and try again. All 11 should pass if setup complete.' },
    ],
  },
]

export default function HelpPage() {
  const [selectedId, setSelectedId] = useState<string>('home')
  const selectedSection = helpSections.find((s) => s.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">❓ Interactive Help & Reference</h1>
        <p className="text-slate-400">Click on any topic to learn about features and buttons</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Sidebar - Topics */}
        <div className="md:col-span-1 space-y-2">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
            <h2 className="font-bold text-sm uppercase tracking-wide text-slate-300 mb-3">Topics</h2>
            {helpSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedId(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                  selectedId === section.id
                    ? 'bg-blue-500/20 border border-blue-500 text-blue-300 font-semibold'
                    : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="text-lg">{section.icon}</div>
                <div className="text-sm mt-1">{section.title}</div>
              </button>
            ))}
          </div>

          {/* Navigation Back */}
          <Link href="/">
            <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
              ← Back to Home
            </button>
          </Link>
        </div>

        {/* Main Content */}
        {selectedSection && (
          <div className="md:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-5xl">{selectedSection.icon}</span>
                <div>
                  <h2 className="text-3xl font-bold">{selectedSection.title}</h2>
                  <p className="text-slate-400 mt-1">{selectedSection.description}</p>
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="space-y-3">
              {selectedSection.details.map((detail, idx) => (
                <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-all">
                  <div className="font-semibold text-blue-300 mb-2">{detail.label}</div>
                  <div className="text-slate-300 text-sm leading-relaxed">{detail.value}</div>
                </div>
              ))}
            </div>

            {/* Quick Navigation Tips */}
            {selectedId === 'monitor' && (
              <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
                <h3 className="font-bold text-green-300 mb-2">💡 Pro Tip</h3>
                <p className="text-sm text-green-200">
                  Try injecting violations with increasing severity to see how both score and Z-score change. Watch how other candidates' Z-scores update due to cohort effect!
                </p>
              </div>
            )}

            {selectedId === 'admin' && (
              <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
                <h3 className="font-bold text-yellow-300 mb-2">💡 Pro Tip</h3>
                <p className="text-sm text-yellow-200">
                  Use "Select All" to lock everyone, then go back to Monitor and individually unlock high performers. Tests batch action effectiveness.
                </p>
              </div>
            )}

            {selectedId === 'analytics' && (
              <div className="bg-purple-500/10 border border-purple-500 rounded-lg p-4">
                <h3 className="font-bold text-purple-300 mb-2">💡 Pro Tip</h3>
                <p className="text-sm text-purple-200">
                  Mean Score and Std Dev help debug exam difficulty. If mean is too high (>90), exam might be too easy. If std dev is very low, check for scoring bugs.
                </p>
              </div>
            )}

            {selectedId === 'verify' && (
              <div className="bg-cyan-500/10 border border-cyan-500 rounded-lg p-4">
                <h3 className="font-bold text-cyan-300 mb-2">💡 Pro Tip</h3>
                <p className="text-sm text-cyan-200">
                  Run tests after each major feature change to catch regressions early. All 11 tests should complete in under 5 seconds. Slower indicates performance issues.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Reference Card */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">⚡ Quick Reference</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-blue-300 mb-2">5-Step Workflow</p>
            <ol className="space-y-1 text-slate-300">
              <li>1. 🏠 Home - Overview of features</li>
              <li>2. ⚙️ Setup - Configure simulation</li>
              <li>3. 📊 Monitor - Inject violations</li>
              <li>4. ⚙️ Admin - Batch operations</li>
              <li>5. 📈 Analytics - View statistics</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-green-300 mb-2">Score Bands</p>
            <div className="space-y-1 text-slate-300">
              <div>🟢 85-100: Excellent</div>
              <div>🟡 65-85: Good</div>
              <div>🟠 45-65: Average</div>
              <div>🔴 25-45: High Risk</div>
              <div>🚨 0-25: Critical</div>
            </div>
          </div>
          <div>
            <p className="font-semibold text-yellow-300 mb-2">Violation Weights</p>
            <div className="space-y-1 text-slate-300">
              <div>🚶 Movement: 1</div>
              <div>👁️ Eye Contact: 2</div>
              <div>🔄 Tab Switch: 3</div>
              <div>🔊 Audio: 4</div>
              <div>📺 Screen Share: 5</div>
            </div>
          </div>
          <div>
            <p className="font-semibold text-cyan-300 mb-2">Auto-Escalation</p>
            <div className="space-y-1 text-slate-300">
              <div>Z ≤ -2.0: 🔒 Lock</div>
              <div>Z ≤ -1.5: ⏸️ Pause</div>
              <div>Z ≤ -1.0: 🚩 Flag</div>
              <div>Z ≥ 1.5: ✅ Excellent</div>
            </div>
          </div>
        </div>
      </div>

      {/* External Resources */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">📚 More Resources</h2>
        <p className="text-slate-300">
          Download the comprehensive feature guide for offline reference or print:
        </p>
        <div className="flex gap-3">
          <a href="/FEATURE-GUIDE.md" target="_blank" rel="noopener noreferrer">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all">
              📄 View Full Guide
            </button>
          </a>
          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all" onClick={() => window.print()}>
            🖨️ Print This Page
          </button>
        </div>
      </div>
    </div>
  )
}
