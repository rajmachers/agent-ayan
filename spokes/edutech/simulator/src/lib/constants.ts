import { RiskLevel } from '@/types'

// Batches
export const BATCHES = [
  {
    id: 'batch-1',
    name: '🌅 Morning Batch',
    startTime: '08:00 AM',
    endTime: '10:00 AM',
    location: 'Hall A',
  },
  {
    id: 'batch-2',
    name: '☀️ Afternoon Batch',
    startTime: '02:00 PM',
    endTime: '04:00 PM',
    location: 'Hall B',
  },
  {
    id: 'batch-3',
    name: '🌙 Evening Batch',
    startTime: '06:00 PM',
    endTime: '08:00 PM',
    location: 'Hall C',
  },
]

// Exam Types
export const EXAM_TYPES = [
  {
    id: 'engineering',
    name: '⚙️ Engineering',
    duration: 120,
    difficulty: 'hard',
  },
  {
    id: 'data-science',
    name: '📊 Data Science',
    duration: 90,
    difficulty: 'medium',
  },
  {
    id: 'python',
    name: '🐍 Python',
    duration: 90,
    difficulty: 'medium',
  },
]

// Tenants (shared between Admin and Simulator)
export const TENANTS = [
  {
    id: 'cs-university',
    name: 'Computer Science Department - University',
    domain: 'cs.university.edu',
    status: 'active',
    plan: 'enterprise',
    spocName: 'Dr. Rajesh Kumar',
    spocEmail: 'rajesh@cs.university.edu',
  },
  {
    id: 'eng-college',
    name: 'Engineering College Assessment Center',
    domain: 'eng.college.edu',
    status: 'active',
    plan: 'professional',
    spocName: 'Prof. Sarah Chen',
    spocEmail: 'sarah@eng.college.edu',
  },
  {
    id: 'business-school',
    name: 'Business School Testing Services',
    domain: 'business.school.edu',
    status: 'trial',
    plan: 'starter',
    spocName: 'Mark Johnson',
    spocEmail: 'mark@business.school.edu',
  },
]

// Candidate Names by Batch
export const CANDIDATE_NAMES = {
  morning: [
    'Alice Johnson',
    'Bob Smith',
    'Carol White',
    'David Brown',
    'Eve Davis',
    'Frank Miller',
    'Grace Lee',
    'Henry Wilson',
    'Isabel Martinez',
    'Jack Taylor',
  ],
  afternoon: [
    'Karen Anderson',
    'Liam Thomas',
    'Mia Jackson',
    'Noah Harris',
    'Olivia Martin',
    'Paul Thompson',
    'Quinn Garcia',
    'Rachel Rodriguez',
    'Samuel Clark',
    'Tina Lewis',
  ],
  evening: [
    'Uma Walker',
    'Victor Hall',
    'Wendy Young',
    'Xavier Hernandez',
    'Yara King',
    'Zane Wright',
    'Amy Lopez',
    'Brian Hill',
    'Chloe Scott',
    'Dylan Green',
  ],
}

// Violation Types
export const VIOLATION_TYPES = [
  {
    id: 'eye_contact',
    name: 'Eye Contact Loss',
    weight: 2,
    description: 'Student not looking at screen',
  },
  {
    id: 'tab_switching',
    name: 'Tab Switching',
    weight: 3,
    description: 'Switching to another browser tab',
  },
  {
    id: 'audio',
    name: 'Audio Detection',
    weight: 4,
    description: 'Unusual background noise or talking',
  },
  {
    id: 'screen_share',
    name: 'Screen Share',
    weight: 5,
    description: 'Screen sharing detected',
  },
  {
    id: 'movement',
    name: 'Excessive Movement',
    weight: 1,
    description: 'Unusual physical movement detected',
  },
]

// Alert Tiers
export const ALERT_TIERS = [
  {
    tier: 1,
    label: '✅ Green - Excellent',
    zScoreThreshold: 1.5,
    description: 'Excellent behavior, no concerns',
    color: 'green',
  },
  {
    tier: 2,
    label: '🟡 Yellow - Monitor',
    zScoreThreshold: 0.5,
    description: 'Minor issues detected, monitor closely',
    color: 'yellow',
  },
  {
    tier: 3,
    label: '🟠 Orange - Critical',
    zScoreThreshold: -0.5,
    description: 'Multiple violations, intervention encouraged',
    color: 'orange',
  },
  {
    tier: 4,
    label: '🔴 Red - Emergency',
    zScoreThreshold: -1.5,
    description: 'Severe violations, immediate action required',
    color: 'red',
  },
]

// Risk Levels
export const RISK_LEVELS: Record<RiskLevel, { zScoreRange: [number, number]; color: string; severity: number }> = {
  excellent: { zScoreRange: [1.5, Infinity], color: 'green', severity: 0 },
  good: { zScoreRange: [0.5, 1.5], color: 'emerald', severity: 1 },
  average: { zScoreRange: [-0.5, 0.5], color: 'yellow', severity: 2 },
  'high-risk': { zScoreRange: [-1.5, -0.5], color: 'orange', severity: 3 },
  critical: { zScoreRange: [-Infinity, -1.5], color: 'red', severity: 4 },
}

// Scenarios
export const SCENARIOS = [
  {
    id: 'conservative',
    name: '🟢 Conservative',
    description: 'Few violations, good behavior',
    maxViolations: 2,
  },
  {
    id: 'realistic',
    name: '🟡 Realistic',
    description: 'Normal exam with some issues',
    maxViolations: 8,
  },
  {
    id: 'aggressive',
    name: '🔴 Aggressive',
    description: 'Many violations, challenging scenario',
    maxViolations: 15,
  },
]

// Violation Probabilities by Scenario
export const VIOLATION_PROBABILITIES = {
  conservative: {
    eye_contact: 0.05,
    tab_switching: 0.02,
    audio: 0.01,
    screen_share: 0.0,
    movement: 0.1,
  },
  realistic: {
    eye_contact: 0.15,
    tab_switching: 0.1,
    audio: 0.08,
    screen_share: 0.02,
    movement: 0.2,
  },
  aggressive: {
    eye_contact: 0.3,
    tab_switching: 0.25,
    audio: 0.2,
    screen_share: 0.15,
    movement: 0.35,
  },
}

// Z-Score Thresholds for Auto-Actions
export const AUTO_ACTION_THRESHOLDS = {
  autoLockScore: -2.0,
  autoPauseScore: -1.5,
  flagScore: -1.0,
}

// Controls for simulation behavior
export const SIMULATION_CONFIG = {
  refreshInterval: 5000, // 5 seconds
  scoreUpdateInterval: 3000, // 3 seconds
  autoLockDuration: 300000, // 5 minutes
  violationInjectionDelay: 1000, // 1 second
}
