export interface Violation {
  id: string
  type: 'eye_contact' | 'tab_switching' | 'audio' | 'screen_share' | 'movement'
  severity: 'watch' | 'warning' | 'critical'
  timestamp: number
  description: string
}

export interface Alert {
  id: string
  tier: 1 | 2 | 3 | 4
  message: string
  timestamp: number
  severity: 'info' | 'warning' | 'danger'
}

export interface Candidate {
  id: string
  name: string
  email: string
  batchId: string
  examType: string
  score: number
  zScore: number
  percentile: number
  violations: Violation[]
  alerts: Alert[]
  status: 'active' | 'paused' | 'locked' | 'terminated'
  lockExpiresAt?: number
}

export interface SimulationSession {
  id: string
  tenantId: string
  tenantName: string
  tenantEmail: string
  batchId: string
  examType: string
  scenario: string
  candidates: Candidate[]
  startedAt: number
  updatedAt: number
  cohortStats: {
    meanScore: number
    stdDev: number
    totalViolations: number
    alertsTriggered: number
  }
}

export type AlertTier = 1 | 2 | 3 | 4
export type RiskLevel = 'excellent' | 'good' | 'average' | 'high-risk' | 'critical'
export type CandidateStatus = 'active' | 'paused' | 'locked' | 'terminated'

export interface TestResult {
  testId: string
  name: string
  passed: boolean
  message: string
  duration: number
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  message: string
}

export interface SimulationConfig {
  tenantId: string
  tenantName: string
  tenantEmail: string
  batchId: string
  examType: string
  scenario: string
}
