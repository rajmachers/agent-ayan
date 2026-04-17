import type { Metadata } from 'next'
import { SimulationProvider } from '@/context/SimulationContext'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Agentic AI Proctoring - Simulator',
  description: 'Interactive simulator for Phase 6 AI Proctoring Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SimulationProvider>
          <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
              <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold">🎯 Agentic AI Proctoring Simulator</h1>
                    <p className="text-sm text-slate-400 mt-1">Real-time monitoring & violation detection</p>
                  </div>
                  <a href="/help" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-all">
                    ❓ Help
                  </a>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
              {children}
            </main>

            <footer className="border-t border-slate-700 bg-slate-900/50 mt-12 backdrop-blur">
              <div className="max-w-7xl mx-auto px-6 py-4 text-sm text-slate-400">
                <p>Phase 6 Agentic Intelligence Platform | v0.1.0</p>
              </div>
            </footer>
          </div>
        </SimulationProvider>
      </body>
    </html>
  )
}
