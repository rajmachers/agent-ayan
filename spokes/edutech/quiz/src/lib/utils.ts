export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function calculateScore(correctAnswers: number, totalQuestions: number): number {
  return Math.round((correctAnswers / totalQuestions) * 100);
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success-600';
  if (score >= 70) return 'text-warning-600';
  return 'text-error-600';
}

export function getTimerColor(secondsLeft: number, totalSeconds: number): string {
  const percentageLeft = (secondsLeft / totalSeconds) * 100;
  if (percentageLeft <= 10) return 'timer-critical';
  if (percentageLeft <= 25) return 'timer-warning';
  return 'text-gray-700';
}

// Communicate with parent iframe (for Tier 3 integration)
export function notifyProctorSystem(event: string, data?: any) {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'QUIZ_EVENT',
      event,
      data,
      timestamp: Date.now()
    }, '*');
  }
}

export interface QuizResult {
  examId: string;
  candidateId: string;
  startTime: number;
  endTime: number;
  answers: Record<number, number>;
  score: number;
  passed: boolean;
  timeSpent: number;
}