'use client'

import Link from 'next/link'
import { useSimulation } from '@/context/SimulationContext'
import { useState } from 'react'
import { HintIcon } from '@/components/HintIcon'

export default function SettingsHelpPage() {
  const { session } = useSimulation()
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview'])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-2">
          ⚙️ Settings & Help
          <HintIcon
            icon="ℹ️"
            size="md"
            title="Settings & Help"
            description="Configure simulator settings and view comprehensive help documentation."
            examples={['Adjust detector sensitivity', 'Configure simulation parameters', 'Learn how to use simulator']}
            details="This page provides all configuration options and help resources."
          />
        </h1>
        <p className="text-slate-400">Configure simulation settings and get help</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Quick Stats */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm opacity-75 mb-1">Active Session</div>
          <div className="text-2xl font-bold">{session ? '✅ Yes' : '❌ No'}</div>
          <HintIcon
            icon="?"
            size="sm"
            title="Session Status"
            description="Whether an exam session is currently loading."
            details="Start from Setup page to create a session."
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm opacity-75 mb-1">Candidates</div>
          <div className="text-2xl font-bold">{session?.candidates.length || 0}</div>
          <HintIcon
            icon="?"
            size="sm"
            title="Candidate Count"
            description="Number of candidates in the current simulation."
            details="Fixed at 10 candidates per simulation."
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm opacity-75 mb-1">Duration</div>
          <div className="text-2xl font-bold">60 min</div>
          <HintIcon
            icon="?"
            size="sm"
            title="Exam Duration"
            description="Total time allocated for each exam session."
            details="Standard exam duration in the simulator."
          />
        </div>
      </div>

      {/* Detector Sensitivity */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <button
          onClick={() => toggleSection('sensitivity')}
          className="flex items-center justify-between w-full text-xl font-bold hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            🎚️ Detector Sensitivity
            <HintIcon
              icon="?"
              size="sm"
              title="Detector Sensitivity"
              description="Adjust how sensitive violation detectors are to potential issues."
              examples={['Strict: Catch more violations', 'Moderate: Balanced', 'Lenient: Only major violations']}
              details="Higher sensitivity = more violations detected."
            />
          </div>
          <span>{expandedSections.includes('sensitivity') ? '▼' : '▶'}</span>
        </button>

        {expandedSections.includes('sensitivity') && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div className="space-y-3">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold">Vision Sensitivity</label>
                    <HintIcon
                      icon="?"
                      size="sm"
                      title="Vision Sensitivity"
                      description="How aggressive object detection is in analyzing camera feed."
                      examples={['High: Detect subtle objects', 'Medium: Standard detection', 'Low: Only obvious violations']}
                      details="Affects person, phone, document detection accuracy."
                    />
                  </div>
                  <span className="text-sm font-mono bg-slate-800 px-2 py-1 rounded">75%</span>
                </div>
                <input type="range" min="0" max="100" defaultValue={75} className="w-full" />
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold">Audio Sensitivity</label>
                    <HintIcon
                      icon="?"
                      size="sm"
                      title="Audio Sensitivity"
                      description="How aggressive speech detection and noise analysis is."
                      examples={['High: Detect subtle multiple speakers', 'Medium: Standard detection', 'Low: Only clear multi-speaker']}
                      details="Affects multiple speaker and noise detection."
                    />
                  </div>
                  <span className="text-sm font-mono bg-slate-800 px-2 py-1 rounded">60%</span>
                </div>
                <input type="range" min="0" max="100" defaultValue={60} className="w-full" />
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold">Behavior Sensitivity</label>
                    <HintIcon
                      icon="?"
                      size="sm"
                      title="Behavior Sensitivity"
                      description="How aggressive behavior analysis is for detecting suspicious patterns."
                      examples={['High: Detect minor head movements', 'Medium: Standard detection', 'Low: Only obvious behavior']}
                      details="Affects screen switch, head movement, hand detection."
                    />
                  </div>
                  <span className="text-sm font-mono bg-slate-800 px-2 py-1 rounded">70%</span>
                </div>
                <input type="range" min="0" max="100" defaultValue={70} className="w-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Simulation Settings */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <button
          onClick={() => toggleSection('simulation')}
          className="flex items-center justify-between w-full text-xl font-bold hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            🎮 Simulation Settings
            <HintIcon
              icon="?"
              size="sm"
              title="Simulation Settings"
              description="Configure how the simulator behaves and generates synthetic data."
              examples={['Violation frequency', 'Scoring calculation', 'Real-time simulation speed']}
              details="Control simulation parameters and behavior."
            />
          </div>
          <span>{expandedSections.includes('simulation') ? '▼' : '▶'}</span>
        </button>

        {expandedSections.includes('simulation') && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="font-semibold">Violation Frequency</label>
                  <HintIcon
                    icon="?"
                    size="sm"
                    title="Violation Frequency"
                    description="How often violations are generated in the simulation."
                    examples={['High: Many violations per minute', 'Medium: Moderate rate', 'Low: Few violations']}
                    details="Affects volume of violations for testing."
                  />
                </div>
                <select className="bg-slate-800 border border-slate-600 rounded px-3 py-2">
                  <option>Low</option>
                  <option selected>Medium</option>
                  <option>High</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="font-semibold">Simulation Speed</label>
                  <HintIcon
                    icon="?"
                    size="sm"
                    title="Simulation Speed"
                    description="How fast the simulation progresses (affects timing of violations and scoring)."
                    examples={['1x: Real-time', '2x: Twice as fast', '5x: 5x speed for testing']}
                    details="Useful for testing without waiting full duration."
                  />
                </div>
                <select className="bg-slate-800 border border-slate-600 rounded px-3 py-2">
                  <option selected>1x (Real-time)</option>
                  <option>2x</option>
                  <option>5x</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="font-semibold">Candidate Behavior</label>
                  <HintIcon
                    icon="?"
                    size="sm"
                    title="Candidate Behavior"
                    description="Pattern of how candidates behave in the simulation."
                    examples={['Honest: Minimal violations', 'Mixed: Some violations', 'Cheater: Frequent violations']}
                    details="Pre-generated across the 10 candidates."
                  />
                </div>
                <select className="bg-slate-800 border border-slate-600 rounded px-3 py-2">
                  <option selected>Mixed Distribution</option>
                  <option>All Honest</option>
                  <option>All Cheaters</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help & Documentation */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <button
          onClick={() => toggleSection('help')}
          className="flex items-center justify-between w-full text-xl font-bold hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            📚 Help & Documentation
            <HintIcon
              icon="?"
              size="sm"
              title="Help Documentation"
              description="Learn how to use the simulator platform and understand its features."
              examples={['Getting started', 'Feature guides', 'Troubleshooting']}
              details="Comprehensive documentation for all simulator pages."
            />
          </div>
          <span>{expandedSections.includes('help') ? '▼' : '▶'}</span>
        </button>

        {expandedSections.includes('help') && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                🚀 Getting Started
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Getting Started"
                  description="First steps for using the proctoring simulator."
                  details="Start here if new to the platform."
                />
              </h3>
              <p className="text-sm opacity-75">
                1. Go to Setup page and configure simulation parameters
              </p>
              <p className="text-sm opacity-75">2. Click 'Start Exam Session' to initialize simulation</p>
              <p className="text-sm opacity-75">3. Monitor candidates from Exam Monitor page</p>
              <p className="text-sm opacity-75">4. Use Admin Dashboard for batch operations</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                👥 Exam Monitor
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Exam Monitor Guide"
                  description="Overview of the main monitoring interface."
                  details="Real-time view of all candidates and violations."
                />
              </h3>
              <p className="text-sm opacity-75">
                • View all candidates with scores, violations, and status
              </p>
              <p className="text-sm opacity-75">• Filter by violation type or risk level</p>
              <p className="text-sm opacity-75">• Click candidate row for detailed view</p>
              <p className="text-sm opacity-75">• Refresh button reloads latest data</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                📊 Scoring System
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Scoring Explanation"
                  description="How proctoring scores are calculated."
                  details="Understanding the scoring algorithm helps interpret results."
                />
              </h3>
              <p className="text-sm opacity-75">• Base Score: 100 points</p>
              <p className="text-sm opacity-75">• Deductions: Based on violations (weighted by category)</p>
              <p className="text-sm opacity-75">• Z-Score: Statistical measure of score compared to peers</p>
              <p className="text-sm opacity-75">• Risk Level: Derived from Z-score distribution</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                🛠️ Batch Operations
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Batch Operations Guide"
                  description="How to manage multiple candidates at once."
                  details="Save time with bulk actions."
                />
              </h3>
              <p className="text-sm opacity-75">1. Check boxes to select candidates</p>
              <p className="text-sm opacity-75">2. Click action button (Lock, Pause, Resume, etc.)</p>
              <p className="text-sm opacity-75">3. For Lock, set duration before applying</p>
              <p className="text-sm opacity-75">4. Action applies immediately to all selected</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                ⚖️ Rules Configuration
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Rules Configuration Guide"
                  description="How to configure violation detection rules."
                  details="Fine-tune detection behavior per session."
                />
              </h3>
              <p className="text-sm opacity-75">• Enable/disable detection by category (Vision, Audio, Behavior)</p>
              <p className="text-sm opacity-75">• Adjust thresholds for each detector</p>
              <p className="text-sm opacity-75">• Configure scoring penalty per violation type</p>
              <p className="text-sm opacity-75">• Save changes apply to current session</p>
            </div>
          </div>
        )}
      </div>

      {/* Violation Categories */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <button
          onClick={() => toggleSection('violations')}
          className="flex items-center justify-between w-full text-xl font-bold hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            📋 Violation Categories
            <HintIcon
              icon="?"
              size="sm"
              title="Violation Categories"
              description="Types of violations detected by the proctoring system."
              examples={['Vision: People, phones, documents', 'Audio: Multiple speakers, noise', 'Behavior: Screen switch, head movement']}
              details="Understanding violations helps interpret monitoring results."
            />
          </div>
          <span>{expandedSections.includes('violations') ? '▼' : '▶'}</span>
        </button>

        {expandedSections.includes('violations') && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-blue-300">👁️ Vision Violations</h3>
              <p className="text-sm opacity-75">
                <strong>Person Detected:</strong> Another person detected in camera frame
              </p>
              <p className="text-sm opacity-75">
                <strong>Phone Detected:</strong> Unauthorized mobile device detected
              </p>
              <p className="text-sm opacity-75">
                <strong>Documents Detected:</strong> Physical materials (notes, books) visible
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-purple-300">🎤 Audio Violations</h3>
              <p className="text-sm opacity-75">
                <strong>Multiple Speakers:</strong> More than one distinct voice detected
              </p>
              <p className="text-sm opacity-75">
                <strong>Excessive Noise:</strong> Background noise exceeds threshold
              </p>
              <p className="text-sm opacity-75">
                <strong>Suspicious Audio:</strong> Pattern matching known suspicious indicators
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-green-300">🎯 Behavior Violations</h3>
              <p className="text-sm opacity-75">
                <strong>Screen Switch:</strong> Candidate left exam window (Alt+Tab detected)
              </p>
              <p className="text-sm opacity-75">
                <strong>Head Turn:</strong> Head turned significantly away from screen
              </p>
              <p className="text-sm opacity-75">
                <strong>Hand Movements:</strong> Suspicious hand movements or gestures detected
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Risk Level Guide */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <button
          onClick={() => toggleSection('risk')}
          className="flex items-center justify-between w-full text-xl font-bold hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            📊 Risk Level Guide
            <HintIcon
              icon="?"
              size="sm"
              title="Risk Level Classification"
              description="Understanding what each risk level means."
              examples={['Excellent: Very safe', 'Critical: Requires attention', 'Average: Monitor']}
              details="Risk levels guide intervention decisions."
            />
          </div>
          <span>{expandedSections.includes('risk') ? '▼' : '▶'}</span>
        </button>

        {expandedSections.includes('risk') && (
          <div className="space-y-3 pt-4 border-t border-slate-700">
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-3">
              <div className="font-semibold text-green-300">✅ Excellent (Z ≥ 0.5)</div>
              <p className="text-sm opacity-75">Minimal violations, strong performance indicator</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500 rounded-lg p-3">
              <div className="font-semibold text-emerald-300">✅ Good (0 ≤ Z &lt; 0.5)</div>
              <p className="text-sm opacity-75">Few violations, normal proctoring behavior</p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-3">
              <div className="font-semibold text-yellow-300">⚠️ Average (-1 ≤ Z &lt; 0)</div>
              <p className="text-sm opacity-75">Moderate violations, monitor closely</p>
            </div>

            <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-3">
              <div className="font-semibold text-orange-300">⚠️ High-Risk (-1.5 ≤ Z &lt; -1)</div>
              <p className="text-sm opacity-75">Multiple violations, consider intervention</p>
            </div>

            <div className="bg-red-500/10 border border-red-500 rounded-lg p-3">
              <div className="font-semibold text-red-300">🚨 Critical (Z &lt; -1.5)</div>
              <p className="text-sm opacity-75">Severe violations, immediate action recommended</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/">
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
            ← Back to Home
          </button>
        </Link>
      </div>
    </div>
  )
}
