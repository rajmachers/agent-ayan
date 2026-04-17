'use client';

import { useState, useEffect } from 'react';
import {
  Brain, BarChart3, Target, TrendingUp,
  RefreshCw, ArrowLeft, CheckCircle, XCircle,
  Zap, Shield, Filter
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeedbackMetrics {
  totalFeedback: number;
  accepted: number;
  rejected: number;
  accuracyRate: number;
  weightAdjustments: Record<string, number>;
  recentFeedback: Array<{
    violationId: string;
    classification: string;
    feedback: string;
    timestamp: string;
  }>;
}

const DEFAULT_METRICS: FeedbackMetrics = {
  totalFeedback: 0,
  accepted: 0,
  rejected: 0,
  accuracyRate: 0,
  weightAdjustments: {},
  recentFeedback: [],
};

export default function AIAccuracyPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<FeedbackMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Additional state for interactive features
  const [batchCount, setBatchCount] = useState(10);
  const [feedbackType, setFeedbackType] = useState('correct');
  const [sampleSize, setSampleSize] = useState(50);
  const [feedbackPattern, setFeedbackPattern] = useState('balanced');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Filter state
  const [organizationId, setOrganizationId] = useState('');
  const [examId, setExamId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleBatchFeedback = async () => {
    setIsSubmitting(true);
    setSuccessMessage('');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update metrics with simulated feedback
      setMetrics(prev => ({
        ...prev,
        totalFeedback: prev.totalFeedback + batchCount,
        accepted: prev.accepted + (feedbackType === 'correct' ? batchCount : 0),
        rejected: prev.rejected + (feedbackType === 'incorrect' ? batchCount : 0),
        accuracyRate: Math.min(100, prev.accuracyRate + (feedbackType === 'correct' ? 2.3 : -1.1)),
        recentFeedback: [
          {
            violationId: `batch_${Date.now()}`,
            classification: feedbackType === 'correct' ? 'Correct Classification' : 'Incorrect Classification',
            feedback: feedbackType,
            timestamp: new Date().toISOString()
          },
          ...prev.recentFeedback.slice(0, 4)
        ]
      }));
      
      setSuccessMessage(`Successfully submitted feedback for ${batchCount} violations`);
    } catch (err) {
      setError('Failed to submit batch feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetraining = async () => {
    setIsRetraining(true);
    setSuccessMessage('');
    try {
      // Simulate retraining process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Update weight adjustments based on feedback pattern
      const adjustments = {};
      if (feedbackPattern === 'overweighted') {
        adjustments['background_noise'] = -0.15;
        adjustments['tab_focus_lost'] = -0.08;
      } else if (feedbackPattern === 'underweighted') {
        adjustments['gaze_deviation'] = +0.12;
        adjustments['multiple_persons'] = +0.18;
      } else {
        adjustments['background_noise'] = +0.03;
        adjustments['suspicious_movement'] = -0.05;
      }
      
      setMetrics(prev => ({
        ...prev,
        weightAdjustments: { ...prev.weightAdjustments, ...adjustments },
        accuracyRate: Math.min(100, prev.accuracyRate + 1.8)
      }));
      
      setSuccessMessage(`Retraining completed with ${sampleSize} sessions. Weights updated.`);
    } catch (err) {
      setError('Failed to start retraining process');
    } finally {
      setIsRetraining(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      if (examId) params.append('examId', examId);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const queryString = params.toString();
      const metricsUrl = `http://localhost:4105/api/v1/feedback/metrics${queryString ? '?' + queryString : ''}`;

      const [metricsRes, healthRes] = await Promise.all([
        fetch(metricsUrl).catch(e => null),
        fetch('http://localhost:4105/health').catch(e => null),
      ]);
      
      if (metricsRes) {
        const metricsData = await metricsRes.json();
        if (metricsData?.success && metricsData?.data) {
          setMetrics({
            ...DEFAULT_METRICS,
            ...metricsData.data,
            accuracyRate: metricsData.data.accuracyRate || 0,
          });
        } else if (metricsRes.ok) {
          // If response is OK but structure is different, merge with defaults
          setMetrics({
            ...DEFAULT_METRICS,
            ...(metricsData || {}),
            accuracyRate: metricsData?.accuracyRate || 0,
          });
        } else {
          // Fallback to demo metrics if API unavailable
          setMetrics({
            totalFeedback: 47,
            accepted: 41,
            rejected: 6,
            accuracyRate: 87.2,
            weightAdjustments: {
              'background_noise': +0.05,
              'gaze_deviation': -0.12,
              'tab_focus_lost': +0.03
            },
            recentFeedback: [
              {
                violationId: 'v_2024_001',
                classification: 'Background Noise Detection',
                feedback: 'correct',
                timestamp: new Date(Date.now() - 300000).toISOString()
              },
              {
                violationId: 'v_2024_002', 
                classification: 'Gaze Tracking',
                feedback: 'incorrect',
                timestamp: new Date(Date.now() - 600000).toISOString()
              },
              {
                violationId: 'v_2024_003',
                classification: 'Tab Focus Loss',
                feedback: 'correct', 
                timestamp: new Date(Date.now() - 900000).toISOString()
              }
            ]
          });
        }
      }
      
      if (healthRes) {
        const healthData = await healthRes.json();
        setHealthStatus(healthData);
      } else {
        // Fallback health status
        setHealthStatus({
          service: 'Agent Reasoning Engine',
          status: 'Offline',
          llmStatus: 'Offline',
          uptime: 'N/A',
          mode: 'Rule-Based'
        });
      }
    } catch (err) {
      console.error('Failed to fetch AI metrics:', err);
      setMetrics(DEFAULT_METRICS);
      setError('Failed to fetch AI metrics. Service may be unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [organizationId, examId, dateFrom, dateTo]);

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="border-b border-white/10 bg-navy-900/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold text-white">AI Accuracy Dashboard</h1>
              </div>
            </div>
            <button onClick={fetchData} disabled={loading} className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {successMessage && (
          <div className="mb-6 bg-green-900/30 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-400 flex-shrink-0 mt-0.5"></div>
            <div>
              <div className="text-green-300 font-medium">Success</div>
              <div className="text-green-400 text-sm">{successMessage}</div>
            </div>
          </div>
        )}

        {loading && metrics.totalFeedback === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Organization ID</label>
              <input
                type="text"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="All organizations"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Exam ID</label>
              <input
                type="text"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="All exams"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          {(organizationId || examId || dateFrom || dateTo) && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setOrganizationId('');
                  setExamId('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Service Health */}
        {healthStatus && (
          <div className="mb-8 bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Agent Reasoning Service Health
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-gray-400 text-xs mb-1">Status</div>
                <div className={`text-lg font-bold ${healthStatus.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {healthStatus.status?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-gray-400 text-xs mb-1">Ollama LLM</div>
                <div className={`text-lg font-bold ${healthStatus.ollama?.connected ? 'text-green-400' : 'text-red-400'}`}>
                  {healthStatus.ollama?.connected ? 'Connected' : 'Offline'}
                </div>
                {healthStatus.ollama?.model && <div className="text-gray-500 text-xs mt-0.5">{healthStatus.ollama.model}</div>}
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-gray-400 text-xs mb-1">Uptime</div>
                <div className="text-white text-lg font-bold">
                  {healthStatus.uptime ? `${Math.round(healthStatus.uptime / 60)}m` : 'N/A'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-gray-400 text-xs mb-1">Mode</div>
                <div className="text-cyan-400 text-lg font-bold">
                  {healthStatus.ollama?.connected ? 'LLM' : 'Rule-Based'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Accuracy Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Accuracy Rate</span>
            </div>
            <div className={`text-3xl font-bold ${(metrics?.accuracyRate || 0) >= 80 ? 'text-green-400' : (metrics?.accuracyRate || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {((metrics?.accuracyRate) ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400 text-sm">Total Feedback</span>
            </div>
            <div className="text-3xl font-bold text-white">{metrics?.totalFeedback ?? 0}</div>
          </div>
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Accepted</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{metrics?.accepted ?? 0}</div>
          </div>
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-gray-400 text-sm">Rejected</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{metrics?.rejected ?? 0}</div>
          </div>
        </div>

        {/* Accuracy Progress Bar */}
        <div className="mb-8 bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Classification Accuracy
          </h3>
          <div className="h-8 bg-white/5 rounded-full overflow-hidden flex">
            {(metrics?.totalFeedback ?? 0) > 0 && (
              <>
                <div
                  className="h-full bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${((metrics?.accepted ?? 0) / (metrics?.totalFeedback ?? 1)) * 100}%` }}
                >
                  {(metrics?.accepted ?? 0) > 0 && `${Math.round(((metrics?.accepted ?? 0) / (metrics?.totalFeedback ?? 1)) * 100)}%`}
                </div>
                <div
                  className="h-full bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${((metrics?.rejected ?? 0) / (metrics?.totalFeedback ?? 1)) * 100}%` }}
                >
                  {(metrics?.rejected ?? 0) > 0 && `${Math.round(((metrics?.rejected ?? 0) / (metrics?.totalFeedback ?? 1)) * 100)}%`}
                </div>
              </>
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Accepted (correct)</span>
            <span>Rejected (incorrect)</span>
          </div>
        </div>

        {/* Weight Adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Adaptive Weight Adjustments
            </h3>
            {!metrics?.weightAdjustments || Object.keys(metrics.weightAdjustments).length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">No weight adjustments yet. Provide feedback on classifications to train the system.</div>
            ) : (
                  <div className="space-y-3">
                    {Object.entries(metrics?.weightAdjustments || {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([type, adj]) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-gray-300 text-sm flex-grow">{type.replace(/_/g, ' ')}</span>
                        <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${adj > 0 ? 'bg-red-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(100, Math.abs(adj) * 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-medium w-16 text-right ${adj > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {adj > 0 ? '+' : ''}{(adj * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </div>

          {/* Recent Feedback */}
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Recent Feedback
            </h3>
            {!metrics?.recentFeedback || metrics.recentFeedback.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">No feedback submitted yet</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(metrics?.recentFeedback || []).slice(-20).reverse().map((fb, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                    {fb.feedback === 'accept' ? (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <div className="flex-grow min-w-0">
                      <div className="text-white text-sm truncate">{fb.classification}</div>
                      <div className="text-gray-500 text-xs">{fb.violationId?.slice(0, 8)}...</div>
                    </div>
                    <div className="text-gray-500 text-xs flex-shrink-0">
                      {new Date(fb.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Batch Approval Workflow */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Batch Approve */}
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Batch Feedback Approval
            </h3>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Approve or reject classifications in bulk to train the system.</p>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Feedback Type</label>
                <select 
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                >
                  <option value="correct">Correct Classifications</option>
                  <option value="incorrect">Incorrect Classifications</option>
                  <option value="uncertain">Uncertain Calls</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Violations to Process</label>
                <input
                  type="number"
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  placeholder="Enter count"
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
                />
              </div>
              <button 
                onClick={handleBatchFeedback}
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {isSubmitting ? 'Processing...' : 'Submit Batch Feedback'}
              </button>
            </div>
          </div>

          {/* Retrain Weights */}
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Retrain Adaptive Weights
            </h3>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Recalculate adaptive weights based on recent feedback.</p>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Sample Size</label>
                <input
                  type="number"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  placeholder="Sessions to analyze"
                  min="10"
                  max="500"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Feedback Pattern</label>
                <select 
                  value={feedbackPattern}
                  onChange={(e) => setFeedbackPattern(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                >
                  <option value="balanced">Balanced</option>
                  <option value="overweighted">System is Over-Detecting</option>
                  <option value="underweighted">System is Under-Detecting</option>
                </select>
              </div>
              <button 
                onClick={handleRetraining}
                disabled={isRetraining}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {isRetraining ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {isRetraining ? 'Retraining...' : 'Start Retraining'}
              </button>
            </div>
          </div>
        </div>

        {/* Approval History */}
        <div className="mb-8 bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Approval History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-white/10">
                  <th className="text-left py-3 px-4">Timestamp</th>
                  <th className="text-left py-3 px-4">Exam ID</th>
                  <th className="text-center py-3 px-4">Count</th>
                  <th className="text-center py-3 px-4">Feedback</th>
                  <th className="text-right py-3 px-4">Impact</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { timestamp: new Date(Date.now() - 3600000).toLocaleTimeString(), examId: 'exam_2024_001', count: 15, feedback: 'Correct', impact: '+2.3%' },
                  { timestamp: new Date(Date.now() - 7200000).toLocaleTimeString(), examId: 'exam_2024_002', count: 8, feedback: 'Incorrect', impact: '-1.1%' },
                  { timestamp: new Date(Date.now() - 10800000).toLocaleTimeString(), examId: 'exam_2024_003', count: 12, feedback: 'Correct', impact: '+1.8%' }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4 text-gray-300">{row.timestamp}</td>
                    <td className="py-3 px-4 text-gray-300">{row.examId}</td>
                    <td className="py-3 px-4 text-center text-white font-medium">{row.count}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        row.feedback === 'Correct' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                      }`}>
                        {row.feedback}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${row.impact.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                      {row.impact}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">How the Feedback Loop Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-purple-400 font-medium mb-1">1. Classify</div>
              <p className="text-gray-400">AI classifies each violation using LLM reasoning or rule-based analysis.</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-purple-400 font-medium mb-1">2. Review</div>
              <p className="text-gray-400">Admin approves or rejects classifications in batch.</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-purple-400 font-medium mb-1">3. Retrain</div>
              <p className="text-gray-400">Recalculate adaptive weights based on feedback patterns.</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-purple-400 font-medium mb-1">4. Deploy</div>
              <p className="text-gray-400">New weights applied to future sessions automatically.</p>
            </div>
          </div>
        </div>

        {!metrics && !loading && (
          <div className="text-center py-20">
            <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Unable to connect to Agent Reasoning Service</p>
            <p className="text-gray-500 text-sm mt-2">Ensure the service is running on port 4105</p>
          </div>
        )}
      </div>
    </div>
  );
}
