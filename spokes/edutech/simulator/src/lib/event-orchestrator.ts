import { Candidate, Violation, Alert, SimulationSession } from '@/types'
import { ScoreCalculator } from './score-calculator'
import { VIOLATION_TYPES } from './constants'

export class EventOrchestrator {
  /**
   * Inject a violation for a candidate
   */
  static injectViolation(
    candidate: Candidate,
    violationType: string,
    severity: 'watch' | 'warning' | 'critical'
  ): { candidate: Candidate; escalated: boolean } {
    const violation: Violation = {
      id: `vio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: violationType as any,
      severity,
      timestamp: Date.now(),
      description: VIOLATION_TYPES.find((v) => v.id === violationType)?.description || 'Unknown violation',
    }

    // Add violation to candidate
    const updatedCandidate = {
      ...candidate,
      violations: [...candidate.violations, violation],
    }

    // Recalculate score based on violation weights
    const violationWeights = updatedCandidate.violations.map((v) => {
      const type = VIOLATION_TYPES.find((t) => t.id === v.type)
      return (type?.weight || 1) * (v.severity === 'critical' ? 1.5 : 1)
    })

    updatedCandidate.score = ScoreCalculator.calculateScore(updatedCandidate.violations.length, violationWeights)

    // Check if escalation is needed (auto-lock, auto-pause, etc.)
    let escalated = false
    if (ScoreCalculator.shouldAutoLock(updatedCandidate.zScore)) {
      updatedCandidate.status = 'locked'
      updatedCandidate.lockExpiresAt = Date.now() + 300000 // 5 minutes
      escalated = true

      const alert: Alert = {
        id: `alt_${Date.now()}`,
        tier: 4,
        message: 'Automatic lock triggered due to critical violations',
        timestamp: Date.now(),
        severity: 'danger',
      }
      updatedCandidate.alerts = [...updatedCandidate.alerts, alert]
    } else if (ScoreCalculator.shouldAutoPause(updatedCandidate.zScore)) {
      updatedCandidate.status = 'paused'
      escalated = true

      const alert: Alert = {
        id: `alt_${Date.now()}`,
        tier: 3,
        message: 'Automatic pause triggered due to multiple violations',
        timestamp: Date.now(),
        severity: 'danger',
      }
      updatedCandidate.alerts = [...updatedCandidate.alerts, alert]
    } else if (ScoreCalculator.shouldFlag(updatedCandidate.zScore)) {
      const alert: Alert = {
        id: `alt_${Date.now()}`,
        tier: 2,
        message: 'Candidate flagged for manual review',
        timestamp: Date.now(),
        severity: 'warning',
      }
      updatedCandidate.alerts = [...updatedCandidate.alerts, alert]
    }

    return { candidate: updatedCandidate, escalated }
  }

  /**
   * Apply batch action to multiple candidates
   */
  static applyBatchAction(
    candidates: Candidate[],
    selectedIds: string[],
    action: 'lock' | 'pause' | 'resume' | 'flag' | 'terminate',
    durationMinutes?: number
  ): Candidate[] {
    return candidates.map((candidate) => {
      if (!selectedIds.includes(candidate.id)) return candidate

      const updated = { ...candidate }

      switch (action) {
        case 'lock':
          updated.status = 'locked'
          updated.lockExpiresAt = Date.now() + (durationMinutes ? durationMinutes * 60000 : 300000)
          break
        case 'pause':
          updated.status = 'paused'
          break
        case 'resume':
          updated.status = 'active'
          delete updated.lockExpiresAt
          break
        case 'flag':
          const flagAlert: Alert = {
            id: `alt_${Date.now()}_${Math.random()}`,
            tier: 2,
            message: 'Manually flagged by admin',
            timestamp: Date.now(),
            severity: 'warning',
          }
          updated.alerts = [...updated.alerts, flagAlert]
          break
        case 'terminate':
          updated.status = 'terminated'
          break
      }

      return updated
    })
  }

  /**
   * Check and unlock expired locks
   */
  static checkAllLocks(candidates: Candidate[]): Candidate[] {
    const now = Date.now()
    return candidates.map((candidate) => {
      if (candidate.status === 'locked' && candidate.lockExpiresAt && candidate.lockExpiresAt < now) {
        return {
          ...candidate,
          status: 'active',
          lockExpiresAt: undefined,
        }
      }
      return candidate
    })
  }

  /**
   * Get alert message based on tier
   */
  static getAlertMessage(tier: 1 | 2 | 3 | 4): string {
    const messages = {
      1: '✅ Excellent performance - no concerns',
      2: '🟡 Minor violations detected - monitor closely',
      3: '🟠 Multiple violations - intervention encouraged',
      4: '🔴 Critical violations - immediate action required',
    }
    return messages[tier] || 'Unknown alert'
  }

  /**
   * Simulate auto-escalation based on cohort performance
   */
  static checkAutoEscalation(candidates: Candidate[], session: SimulationSession): Candidate[] {
    const cohortStats = ScoreCalculator.calculateCohortStats(candidates)
    const escalationThreshold = cohortStats.meanScore * 0.7 // If 70% below mean

    return candidates.map((candidate) => {
      if (candidate.score < escalationThreshold && candidate.status === 'active') {
        const alert: Alert = {
          id: `alt_${Date.now()}_${Math.random()}`,
          tier: 3,
          message: 'Significantly below cohort average - escalation triggered',
          timestamp: Date.now(),
          severity: 'danger',
        }

        return {
          ...candidate,
          alerts: [...candidate.alerts, alert],
        }
      }
      return candidate
    })
  }
}
