'use client'

import { useSimulation } from '@/context/SimulationContext'
import { useState } from 'react'
import { Copy, ExternalLink, User, Key, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function CredentialsPage() {
  const { session } = useSimulation()
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold">🔐 Candidate Credentials</h1>
          <p className="text-slate-400">No active session found</p>
          <Link 
            href="/setup" 
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Create New Session
          </Link>
        </div>
      </div>
    )
  }

  const accessCodes = ['EXAM2024', 'MIDTERM2024', 'FINAL2024', 'DEMO2026', 'TEST2026']

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const getQuizAppUrl = () => {
    // Determine organization based on tenant
    if (session.tenantId === 'eng-college') {
      return 'http://localhost:3101?org=eng.college.edu'
    } else if (session.tenantId === 'business-school') {
      return 'http://localhost:3101?org=business.school.edu'
    } else {
      return 'http://localhost:3101?org=cs.university.edu'
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">🔐 Candidate Credentials</h1>
        <p className="text-slate-400">Use these credentials to manually test the Quiz App experience</p>
      </div>

      {/* Session Info */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">📋 Session Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Session ID</p>
            <p className="font-mono text-sm text-cyan-400">{session.id}</p>
          </div>
          <div>
            <p className="text-slate-400">Organization</p>
            <p className="font-semibold">{session.tenantName}</p>
          </div>
          <div>
            <p className="text-slate-400">Batch</p>
            <p className="font-semibold">{session.batchId}</p>
          </div>
          <div>
            <p className="text-slate-400">Candidates</p>
            <p className="font-semibold">{session.candidates.length}</p>
          </div>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-blue-400">🚀 Quick Test</h3>
            <p className="text-sm text-slate-300">Open Quiz App in new tab for quick testing</p>
          </div>
          <a
            href={getQuizAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ExternalLink size={16} />
            Open Quiz App
          </a>
        </div>
      </div>

      {/* Access Codes Info */}
      <div className="bg-green-900/30 border border-green-600 rounded-lg p-6">
        <h3 className="text-lg font-bold text-green-400 mb-3">🔑 Valid Access Codes</h3>
        <div className="flex flex-wrap gap-2">
          {accessCodes.map((code, index) => (
            <button
              key={code}
              onClick={() => copyToClipboard(code, -index - 1)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {copiedIndex === -index - 1 ? <CheckCircle size={14} /> : <Copy size={14} />}
              {code}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Click any code to copy to clipboard</p>
      </div>

      {/* Candidate Credentials */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">👥 Candidate Login Credentials</h2>
        <div className="space-y-3">
          {session.candidates.map((candidate, index) => (
            <div key={candidate.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-600 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center font-bold text-sm">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400" />
                    <span className="font-semibold">{candidate.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Key size={14} />
                    <code className="bg-slate-700 px-2 py-0.5 rounded">{candidate.email}</code>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(candidate.email, index)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm transition-colors"
                  title={`Copy ${candidate.name}'s email`}
                >
                  {copiedIndex === index ? <CheckCircle size={14} /> : <Copy size={14} />}
                  Copy Email
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-6">
        <h3 className="text-lg font-bold text-yellow-400 mb-3">📝 Testing Instructions</h3>
        <div className="space-y-2 text-sm">
          <p><strong>Step 1:</strong> Copy any candidate email above</p>
          <p><strong>Step 2:</strong> Open Quiz App (use button above or go to localhost:3101)</p> 
          <p><strong>Step 3:</strong> Paste email as Candidate ID</p>
          <p><strong>Step 4:</strong> Use any access code (e.g., EXAM2024, DEMO2026)</p>
          <p><strong>Step 5:</strong> Experience the full proctoring workflow</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Link 
          href="/setup" 
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition-colors"
        >
          ← Back to Setup
        </Link>
        <Link 
          href="/exam-monitor" 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          View Simulation →
        </Link>
      </div>
    </div>
  )
}