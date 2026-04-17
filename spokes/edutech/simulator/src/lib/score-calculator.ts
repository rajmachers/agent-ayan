import { Candidate, RiskLevel } from '@/types'
import { ALERT_TIERS, AUTO_ACTION_THRESHOLDS, RISK_LEVELS } from './constants'

export class ScoreCalculator {
  /**
   * Calculate score (0-100) based on violations
   * Base score 100, each violation reduces it
   */
  static calculateScore(violationCount: number, violationWeights: number[]): number {
    const totalWeight = violationWeights.reduce((a, b) => a + b, 0)
    const penalty = Math.min(totalWeight * 2, 100) // Max 100 point penalty
    return Math.max(0, 100 - penalty)
  }

  /**
   * Calculate Z-Score for a candidate compared to cohort
   * Z = (X - μ) / σ
   */
  static calculateZScore(score: number, cohortMean: number, cohortStdDev: number): number {
    if (cohortStdDev === 0) return 0
    return (score - cohortMean) / cohortStdDev
  }

  /**
   * Calculate percentile rank based on Z-score (normal distribution)
   * Uses approximation of normal CDF
   */
  static calculatePercentile(zScore: number): number {
    // Use error function approximation for normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(zScore))
    const d = 0.3989423 * Math.exp(-zScore * zScore / 2)
    const prob =
      1 - d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))

    // Handle negative Z-scores
    if (zScore < 0) {
      return (1 - prob) * 100
    }
    return prob * 100
  }

  /**
   * Get risk level based on Z-score
   */
  static getRiskLevel(zScore: number): RiskLevel {
    for (const [level, config] of Object.entries(RISK_LEVELS)) {
      if (zScore >= config.zScoreRange[0] && zScore < config.zScoreRange[1]) {
        return level as RiskLevel
      }
    }
    return 'critical'
  }

  /**
   * Get alert tier based on Z-score
   */
  static getAlertTier(zScore: number): 1 | 2 | 3 | 4 {
    for (let i = ALERT_TIERS.length - 1; i >= 0; i--) {
      if (zScore >= ALERT_TIERS[i].zScoreThreshold) {
        return ALERT_TIERS[i].tier as 1 | 2 | 3 | 4
      }
    }
    return 4
  }

  /**
   * Determine if candidate should be auto-locked
   */
  static shouldAutoLock(zScore: number): boolean {
    return zScore <= AUTO_ACTION_THRESHOLDS.autoLockScore
  }

  /**
   * Determine if candidate should be auto-paused
   */
  static shouldAutoPause(zScore: number): boolean {
    return zScore <= AUTO_ACTION_THRESHOLDS.autoPauseScore && zScore > AUTO_ACTION_THRESHOLDS.autoLockScore
  }

  /**
   * Determine if candidate should be flagged
   */
  static shouldFlag(zScore: number): boolean {
    return zScore <= AUTO_ACTION_THRESHOLDS.flagScore
  }

  /**
   * Calculate cohort statistics
   */
  static calculateCohortStats(candidates: Candidate[]) {
    if (candidates.length === 0) {
      return { meanScore: 0, stdDev: 0, totalViolations: 0, alertsTriggered: 0 }
    }

    const scores = candidates.map((c) => c.score)
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length

    const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length
    const stdDev = Math.sqrt(variance)

    const totalViolations = candidates.reduce((sum, c) => sum + c.violations.length, 0)
    const alertsTriggered = candidates.reduce((sum, c) => sum + c.alerts.length, 0)

    return { meanScore, stdDev, totalViolations, alertsTriggered }
  }

  /**
   * Recalculate all scores for candidates
   */
  static recalculateAllScores(candidates: Candidate[]): Candidate[] {
    const cohortStats = this.calculateCohortStats(candidates)

    return candidates.map((candidate) => {
      const zScore = this.calculateZScore(candidate.score, cohortStats.meanScore, cohortStats.stdDev)
      const percentile = this.calculatePercentile(zScore)

      return {
        ...candidate,
        zScore,
        percentile,
      }
    })
  }

  /**
   * Get all candidates by risk level
   */
  static getCandidatesByRiskLevel(candidates: Candidate[]) {
    const byRisk = {
      excellent: [] as Candidate[],
      good: [] as Candidate[],
      average: [] as Candidate[],
      'high-risk': [] as Candidate[],
      critical: [] as Candidate[],
    }

    candidates.forEach((candidate) => {
      const riskLevel = this.getRiskLevel(candidate.zScore)
      byRisk[riskLevel].push(candidate)
    })

    return byRisk
  }

  /**
   * Calculate adaptive weight based on time elapsed
   * Older violations have less impact
   */
  static getAdaptiveWeight(violationAge: number, maxAge: number = 300000): number {
    // Decay weight over time (5 minutes max)
    return Math.max(0, 1 - violationAge / maxAge)
  }
}
