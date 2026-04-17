'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { Candidate, SimulationSession, SimulationConfig } from '@/types'
import { ScoreCalculator } from '@/lib/score-calculator'
import { EventOrchestrator } from '@/lib/event-orchestrator'
import { apiClient } from '@/lib/api-client'
import { CANDIDATE_NAMES, BATCHES, SIMULATION_CONFIG, TENANTS } from '@/lib/constants'
import { v4 as uuidv4 } from 'uuid'

interface SimulationContextType {
  session: SimulationSession | null
  loading: boolean
  error: string | null
  initializeSession: (config: SimulationConfig) => Promise<void>
  injectViolation: (candidateId: string, violationType: string, severity: string) => Promise<void>
  executeBatchAction: (candidateIds: string[], action: string, durationMinutes?: number) => Promise<void>
  getCohortAnalytics: () => any
  simulateScenario: (violationCount: number) => Promise<void>
  loadSessionFromControlPlane: (sessionId: string) => Promise<void>
  clearSession: () => void
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

const STORAGE_KEY = 'simulator-session'

export const SimulationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SimulationSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSession(parsed)
      } catch (err) {
        console.error('Failed to load session from storage:', err)
      }
    }
  }, [])

  // Persist session to localStorage whenever it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    }
  }, [session])

  const initializeSession = useCallback(async (config: SimulationConfig) => {
    setLoading(true)
    setError(null)

    try {
      // Use tenant from config
      const tenantId = config.tenantId

      // Get batch info
      const batch = BATCHES.find((b) => b.id === config.batchId)
      const batchKey = config.batchId === 'batch-1' ? 'morning' : config.batchId === 'batch-2' ? 'afternoon' : 'evening'
      const names = CANDIDATE_NAMES[batchKey as keyof typeof CANDIDATE_NAMES]

      // Get tenant domain for email generation
      const tenant = TENANTS.find(t => t.id === tenantId)
      const emailDomain = tenant?.domain || 'cs.university.edu'

      // Generate candidates
      const candidates: Candidate[] = names.map((name) => ({
        id: uuidv4(),
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@${emailDomain}`,
        batchId: config.batchId,
        examType: config.examType,
        score: 85 + Math.random() * 15, // Random starting scores 85-100
        zScore: 0,
        percentile: 50,
        violations: [],
        alerts: [],
        status: 'active',
      }))

      // Calculate initial Z-scores
      const cohortStats = ScoreCalculator.calculateCohortStats(candidates)
      const updatedCandidates = candidates.map((c) => ({
        ...c,
        zScore: ScoreCalculator.calculateZScore(c.score, cohortStats.meanScore, cohortStats.stdDev),
        percentile: ScoreCalculator.calculatePercentile(
          ScoreCalculator.calculateZScore(c.score, cohortStats.meanScore, cohortStats.stdDev)
        ),
      }))

      // Create session on Control Plane with full candidate data
      const sessionId = await apiClient.createSessionsOnControlPlane(
        tenantId,
        config.batchId,
        config.examType,
        config.scenario,
        config.tenantName,
        updatedCandidates
      )

      // Create session object
      const newSession: SimulationSession = {
        id: sessionId,
        tenantId,
        tenantName: config.tenantName,
        tenantEmail: config.tenantEmail,
        batchId: config.batchId,
        examType: config.examType,
        scenario: config.scenario,
        candidates: updatedCandidates,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        cohortStats: ScoreCalculator.calculateCohortStats(updatedCandidates),
      }

      setSession(newSession)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize session'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const injectViolation = useCallback(
    async (candidateId: string, violationType: string, severity: string) => {
      if (!session) {
        setError('No active session')
        return
      }

      try {
        const candidate = session.candidates.find((c) => c.id === candidateId)
        if (!candidate) {
          setError('Candidate not found')
          return
        }

        // Inject violation using event orchestrator
        const { candidate: updated, escalated } = EventOrchestrator.injectViolation(
          candidate,
          violationType,
          severity as any
        )

        // Update session with new candidate
        const updatedCandidates = session.candidates.map((c) => (c.id === candidateId ? updated : c))

        // Recalculate all Z-scores
        const recalculated = ScoreCalculator.recalculateAllScores(updatedCandidates)

        const newSession = {
          ...session,
          candidates: recalculated,
          updatedAt: Date.now(),
          cohortStats: ScoreCalculator.calculateCohortStats(recalculated),
        }

        setSession(newSession)

        // Sync violations and candidates to Control Plane
        await apiClient.updateSessionViolations(
          session.id,
          recalculated.flatMap(c => c.violations),
          recalculated
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to inject violation'
        setError(message)
      }
    },
    [session]
  )

  const executeBatchAction = useCallback(
    async (candidateIds: string[], action: string, durationMinutes?: number) => {
      if (!session) {
        setError('No active session')
        return
      }

      try {
        // Apply batch action using event orchestrator
        const updated = EventOrchestrator.applyBatchAction(session.candidates, candidateIds, action as any, durationMinutes)

        setSession({
          ...session,
          candidates: updated,
          updatedAt: Date.now(),
          cohortStats: ScoreCalculator.calculateCohortStats(updated),
        })

        // Send to Control Plane
        await apiClient.executeBatchAction(session.id, candidateIds, action, { durationMinutes })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to execute batch action'
        setError(message)
      }
    },
    [session]
  )

  const getCohortAnalytics = useCallback(() => {
    if (!session) return null

    const cohortStats = ScoreCalculator.calculateCohortStats(session.candidates)
    const riskLevels = ScoreCalculator.getCandidatesByRiskLevel(session.candidates)

    const violationCounts = {
      eye_contact: 0,
      tab_switching: 0,
      audio: 0,
      screen_share: 0,
      movement: 0,
    }

    session.candidates.forEach((c) => {
      c.violations.forEach((v) => {
        violationCounts[v.type as keyof typeof violationCounts]++
      })
    })

    return {
      cohortStats,
      riskLevels,
      violationCounts,
      totalCandidates: session.candidates.length,
      activeCandidates: session.candidates.filter((c) => c.status === 'active').length,
      lockedCandidates: session.candidates.filter((c) => c.status === 'locked').length,
      pausedCandidates: session.candidates.filter((c) => c.status === 'paused').length,
    }
  }, [session])

  const simulateScenario = useCallback(
    async (violationCount: number) => {
      if (!session) {
        setError('No active session')
        return
      }

      try {
        let updatedCandidates = [...session.candidates]

        for (let i = 0; i < violationCount; i++) {
          const randomCandidate = updatedCandidates[Math.floor(Math.random() * updatedCandidates.length)]
          const violationTypes = ['eye_contact', 'tab_switching', 'audio', 'screen_share', 'movement']
          const randomViolation = violationTypes[Math.floor(Math.random() * violationTypes.length)]

          const { candidate: updated } = EventOrchestrator.injectViolation(
            randomCandidate,
            randomViolation,
            'warning'
          )

          updatedCandidates = updatedCandidates.map((c) => (c.id === randomCandidate.id ? updated : c))
        }

        // Recalculate all Z-scores
        const recalculated = ScoreCalculator.recalculateAllScores(updatedCandidates)

        setSession({
          ...session,
          candidates: recalculated,
          updatedAt: Date.now(),
          cohortStats: ScoreCalculator.calculateCohortStats(recalculated),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to simulate scenario'
        setError(message)
      }
    },
    [session]
  )

  const loadSessionFromControlPlane = useCallback(async (sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      // Fetch session from Control Plane
      const response = await fetch(`http://localhost:4101/api/v1/sessions/${sessionId}`, {
        headers: {
          'Authorization': 'Bearer demo-key',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.statusText}`)
      }

      const data = await response.json()
      const cpSession = data.session

      if (!cpSession) {
        throw new Error('Session not found')
      }

      // Convert Control Plane session format to SimulationSession
      const candidates: Candidate[] = (cpSession.candidates || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        batchId: cpSession.batchId,
        examType: cpSession.examType,
        score: c.score || 85,
        zScore: c.zScore || 0,
        percentile: c.percentile || 50,
        violations: c.violations || [],
        alerts: c.alerts || [],
        status: c.status || 'active',
      }))

      const loadedSession: SimulationSession = {
        id: cpSession.sessionId,
        tenantId: cpSession.tenantId,
        tenantName: cpSession.tenantName,
        tenantEmail: '',
        batchId: cpSession.batchId,
        examType: cpSession.examType,
        scenario: cpSession.scenario,
        candidates,
        startedAt: new Date(cpSession.createdAt || Date.now()).getTime(),
        updatedAt: Date.now(),
        cohortStats: ScoreCalculator.calculateCohortStats(candidates),
      }

      setSession(loadedSession)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load session from Control Plane'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearSession = useCallback(() => {
    setSession(null)
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value: SimulationContextType = {
    session,
    loading,
    error,
    initializeSession,
    injectViolation,
    executeBatchAction,
    getCohortAnalytics,
    simulateScenario,
    loadSessionFromControlPlane,
    clearSession,
  }

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}

export const useSimulation = (): SimulationContextType => {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider')
  }
  return context
}
