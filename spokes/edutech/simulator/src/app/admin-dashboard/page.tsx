'use client'

import Link from 'next/link'

export default function DeprecatedSimulatorAdminPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6 text-center space-y-6">
      <h1 className="text-3xl font-bold">Simulator Admin View Moved</h1>
      <p className="text-slate-300">
        Candidate administration is now handled in the tenant admin application. Use the Admin dashboard to view and manage simulated sessions.
      </p>
      <div className="flex items-center justify-center gap-3">
        <a
          href="http://localhost:3001/admin/dashboard"
          className="rounded-lg bg-cyan-600 px-5 py-2 font-semibold text-white hover:bg-cyan-500"
        >
          Open Tenant Admin Dashboard
        </a>
        <Link
          href="/exam-monitor"
          className="rounded-lg border border-slate-600 px-5 py-2 font-semibold text-slate-200 hover:bg-slate-800"
        >
          Back to Exam Monitor
        </Link>
      </div>
    </div>
  )
}
