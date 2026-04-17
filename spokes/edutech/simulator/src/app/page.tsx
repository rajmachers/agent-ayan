'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [savedSession, setSavedSession] = useState<any>(null)

  useEffect(() => {
    // Check for saved session in localStorage
    const saved = localStorage.getItem('simulator-session')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSavedSession(parsed)
        console.log('[Resume] Found saved session:', parsed.tenantName, parsed.batchId)
      } catch (err) {
        console.error('[Resume] Failed to parse saved session:', err)
      }
    } else {
      console.log('[Resume] No saved session found in localStorage')
    }
  }, [])

  const handleResumeSession = () => {
    router.push('/exam-monitor')
  }

  const handleClearSession = () => {
    localStorage.removeItem('simulator-session')
    setSavedSession(null)
  }

  const steps = [
    {
      title: '🎓 Setup Session',
      description: 'Configure tenant, batch, exam type, and violation scenario',
      href: '/setup',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: '📊 Exam Monitor',
      description: 'Real-time candidate monitoring with score tracking & violation injection',
      href: '/exam-monitor',
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: '⚙️ Admin Dashboard',
      description: 'Batch operations: lock, pause, resume, flag, terminate candidates',
      href: '/admin-dashboard',
      color: 'from-orange-500 to-red-500',
    },
    {
      title: '📈 Analytics',
      description: 'Cohort statistics, risk distribution, violation breakdown',
      href: '/analytics',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: '✅ Verification',
      description: 'E2E test suite: validate scoring, Z-scores, percentiles, system integrity',
      href: '/verification',
      color: 'from-indigo-500 to-blue-500',
    },
  ]

  const features = [
    { icon: '🧮', title: 'Z-Score Calculation', desc: 'Statistical scoring with percentile ranking' },
    { icon: '⚡', title: 'Real-time Updates', desc: '5-second auto-refresh for live monitoring' },
    { icon: '🔗', title: 'Control Plane Integration', desc: 'Real API calls to port 4101' },
    { icon: '📊', title: 'Cohort Analytics', desc: 'Mean, std dev, risk distribution' },
    { icon: '🎯', title: 'Smart Violations', desc: '5 violation types with adaptive weights' },
    { icon: '🔒', title: 'Configurable Scenarios', desc: 'Conservative, realistic, aggressive' },
  ]

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          AI Proctoring Simulator
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
          Interactive platform to demonstrate Phase 6 agentic intelligence capabilities: real-time monitoring, violation detection, adaptive scoring, and cohort analytics.
        </p>

        {/* Resume Session Card */}
        {savedSession && (
          <div className="max-w-2xl mx-auto bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-2 border-green-600 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✓</span>
              <div className="text-left">
                <h3 className="text-lg font-bold text-green-400">Session Recovered!</h3>
                <p className="text-sm text-slate-300">
                  <strong>{savedSession.tenantName}</strong> • {savedSession.batchId} • {savedSession.candidates?.length || 0} candidates
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={handleResumeSession}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                ▶️ Resume Exam
              </button>
              <button
                onClick={handleClearSession}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                🗑️ Clear & Start New
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Link href="/setup">
            <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all">
              🚀 Start Simulation
            </button>
          </Link>
          <Link href="/help">
            <button className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all">
              ❓ View Help Guide
            </button>
          </Link>
          <Link href="/verification">
            <button className="px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
              🧪 Run Tests
            </button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-all">
            <div className="text-3xl mb-2">{f.icon}</div>
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-slate-400">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Workflow Section */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">5-Step Workflow</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveStep(i)}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  activeStep === i
                    ? `bg-gradient-to-r ${step.color} text-white shadow-lg`
                    : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm opacity-90 mt-1">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Cards for Active Step */}
          <div className="space-y-4">
            <div className={`bg-gradient-to-r ${steps[activeStep].color} rounded-lg p-6 text-white`}>
              <h3 className="text-2xl font-bold mb-3">{steps[activeStep].title}</h3>
              <p className="mb-4 text-sm opacity-90">{steps[activeStep].description}</p>
              <Link href={steps[activeStep].href}>
                <button className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-all">
                  Open Page →
                </button>
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-400">30</div>
                <div className="text-xs text-slate-400 mt-1">Total Candidates</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-400">5</div>
                <div className="text-xs text-slate-400 mt-1">Violation Types</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-400">11</div>
                <div className="text-xs text-slate-400 mt-1">E2E Tests</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-orange-400">∞</div>
                <div className="text-xs text-slate-400 mt-1">Scenarios</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">⚡ Quick Start</h2>
        <ol className="space-y-2 text-slate-300">
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">1.</span>
            <span>Go to <Link href="/setup" className="text-blue-400 hover:underline">Setup</Link> and enter tenant details</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">2.</span>
            <span>Select a batch (Morning/Afternoon/Evening) with 10 candidates</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">3.</span>
            <span>Choose exam type (Engineering/Data Science/Python)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">4.</span>
            <span>Pick violation scenario (Conservative/Realistic/Aggressive)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">5.</span>
            <span>Go to <Link href="/exam-monitor" className="text-blue-400 hover:underline">Exam Monitor</Link> and inject violations in real-time</span>
          </li>
        </ol>
        <p className="text-sm text-slate-400 pt-2">
          💡 Tip: Use the Admin Dashboard to lock/pause candidates, and check Analytics for cohort statistics.
        </p>
      </div>

      {/* Architecture Info */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold">🏗️ Architecture</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-semibold text-cyan-400 mb-1">Frontend</p>
            <p className="text-slate-400">Next.js 14 + React 18<br />TypeScript + Tailwind CSS</p>
          </div>
          <div>
            <p className="font-semibold text-green-400 mb-1">State</p>
            <p className="text-slate-400">React Context API<br />Real-time scoring engine</p>
          </div>
          <div>
            <p className="font-semibold text-purple-400 mb-1">Integration</p>
            <p className="text-slate-400">Control Plane API<br />Graceful fallback mode</p>
          </div>
        </div>
      </div>

      {/* Help & Resources */}
      <div className="bg-blue-950/30 border border-blue-500/50 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">❓ Need Help?</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-300 mb-3">
              📘 <strong>Interactive Help Guide:</strong> Click-through guide for each page and feature with detailed explanations.
            </p>
            <Link href="/help">
              <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-all">
                Open Help Guide
              </button>
            </Link>
          </div>
          <div>
            <p className="text-sm text-slate-300 mb-3">
              📄 <strong>Feature Reference:</strong> Complete guide with workflows, button-level descriptions, troubleshooting, and examples.
            </p>
            <a href="/FEATURE-GUIDE.md" target="_blank" rel="noopener noreferrer">
              <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-semibold transition-all">
                Download Guide
              </button>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
