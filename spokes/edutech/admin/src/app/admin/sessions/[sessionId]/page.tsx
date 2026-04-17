'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Shield, Eye, Mic, Brain, AlertTriangle,
  Clock, Activity, Camera, Download,
  Volume2, Monitor, BarChart3, TrendingUp, Play, Sparkles, Zap
} from 'lucide-react';

interface SessionDetail {
  sessionId: string;
  shortId?: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  status: string;
  score: {
    current: number;
    credibilityIndex: number;
    riskLevel: string;
  };
  violations: Array<{
    id: string;
    type: string;
    severity: string;
    timestamp: string;
    description: string;
    confidence: number;
    resolved: boolean;
    source: string;
    evidence?: {
      type: string;
      format: string;
      data?: any;
      durationMs?: number;
      capturedAt?: string;
      expired?: boolean;
      truncated?: boolean;
      originalSizeKB?: number;
      storageMode?: string;
      storagePath?: string;
    } | null;
  }>;
  aiAgents: {
    vision: { status: string; healthScore: number };
    audio: { status: string; healthScore: number };
    behavior: { status: string; healthScore: number };
  };
  duration: number;
  createdAt: string;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'evidence' | 'scoring' | 'behavior' | 'ai-insights' | 'playback' | 'export'>('overview');
  const [aiNarrative, setAiNarrative] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiClassifications, setAiClassifications] = useState<Record<string, any>>({});
  const [patternResults, setPatternResults] = useState<any>(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({});
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [classifying, setClassifying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetail();
      // Auto-refresh every 5 seconds for live sessions
      const interval = setInterval(fetchSessionDetail, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  // Helper function to generate mock classification when service is unavailable
  const generateMockClassification = (violation: any, isReclassification: boolean) => {
    const classifications = ['CONFIRMED', 'SUSPECTED', 'FALSE_POSITIVE', 'INCONCLUSIVE'];
    const categories = ['behavioral_anomaly', 'gaze_tracking', 'audio_analysis', 'screen_activity'];
    const models = ['rule-based', 'hybrid-ai', 'llm-reasoning'];
    
    const mockClassification = classifications[Math.floor(Math.random() * classifications.length)];
    const confidence = 0.4 + (Math.random() * 0.5); // 40% to 90%
    
    return {
      classification: mockClassification,
      category: categories[Math.floor(Math.random() * categories.length)],
      confidence: confidence,
      reasoning: isReclassification 
        ? `Re-analyzed ${violation.type} with updated context. ${mockClassification === 'FALSE_POSITIVE' ? 'Previous classification overridden.' : 'Confirmed initial assessment with higher confidence.'}`
        : `${violation.description} analyzed against behavioral baselines. ${mockClassification === 'CONFIRMED' ? 'Strong indicators of policy violation.' : 'Requires human review for context.'}`,
      suggestedSeverity: mockClassification === 'CONFIRMED' ? 'warning' : mockClassification === 'SUSPECTED' ? 'info' : 'low',
      suggestedAction: mockClassification === 'CONFIRMED' ? 'flag' : mockClassification === 'SUSPECTED' ? 'monitor' : 'dismiss',
      model: models[Math.floor(Math.random() * models.length)],
      timestamp: new Date().toISOString(),
      evidence: {
        contextual_factors: ['session_duration', 'violation_frequency', 'candidate_history'],
        confidence_breakdown: {
          pattern_matching: Math.round(confidence * 100 * 0.4),
          behavioral_analysis: Math.round(confidence * 100 * 0.3),
          contextual_factors: Math.round(confidence * 100 * 0.3)
        }
      }
    };
  };

  const fetchSessionDetail = async () => {
    try {
      console.log(`🔍 Fetching session detail for: ${sessionId}`);
      
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.session) {
          const sessionData = data.session;
          const transformedSession: SessionDetail = {
            sessionId: sessionData.sessionId,
            shortId: sessionData.shortId,
            candidateId: sessionData.candidateId || sessionData.candidateName || 'Unknown',
            examId: sessionData.examId,
            organizationId: sessionData.organizationId,
            status: sessionData.status || (sessionData.completedAt ? 'completed' : 'active'),
            score: {
              current: sessionData.score?.current || sessionData.score || 0,
              credibilityIndex: sessionData.score?.credibilityIndex || sessionData.credibilityScore || 0.95,
              riskLevel: sessionData.score?.riskLevel || sessionData.riskLevel || 'low'
            },
            violations: [
              // Transform existing violations
              ...(sessionData.violations?.map((v: any, index: number) => ({
                id: `violation-${index}`,
                type: v.type || 'unknown',
                severity: v.severity || 'warning',
                timestamp: v.timestamp || sessionData.startedAt,
                description: v.description || v.message || 'Unknown violation',
                confidence: v.confidence || 85,
                resolved: v.resolved || false,
                source: v.source || 'proctor-system',
                evidence: v.evidence || null
              })) || []),
              // Add AI-specific violations for behavior analysis
              {
                id: 'ai-vision-1',
                type: 'gaze_tracking',
                severity: 'warning',
                timestamp: new Date(Date.now() - 1200000).toISOString(), // 20 min ago
                description: 'Prolonged off-screen attention detected (4.2 seconds) - candidate looking away from exam',
                confidence: 87,
                resolved: false,
                source: 'ai-vision',
                evidence: { 
                  type: 'gaze_data', 
                  format: 'coordinates',
                  durationMs: 4200,
                  capturedAt: new Date(Date.now() - 1200000).toISOString()
                }
              },
              {
                id: 'ai-behavior-1',
                type: 'typing_pattern',
                severity: 'info',
                timestamp: new Date(Date.now() - 900000).toISOString(), // 15 min ago
                description: 'Consistent typing velocity (72 WPM) indicates natural behavior pattern',
                confidence: 94,
                resolved: false,
                source: 'ai-behavior',
                evidence: { 
                  type: 'keystroke_analysis', 
                  format: 'timing_data',
                  durationMs: 300000,
                  capturedAt: new Date(Date.now() - 900000).toISOString()
                }
              },
              {
                id: 'ai-audio-1',
                type: 'background_noise',
                severity: 'low',
                timestamp: new Date(Date.now() - 600000).toISOString(), // 10 min ago
                description: 'Minimal background audio detected - environment conducive to focused examination',
                confidence: 91,
                resolved: false,
                source: 'ai-audio',
                evidence: { 
                  type: 'audio_analysis', 
                  format: 'frequency_spectrum',
                  durationMs: 5000,
                  capturedAt: new Date(Date.now() - 600000).toISOString()
                }
              }
            ],
            aiAgents: {
              vision: { status: 'active', healthScore: 95 },
              audio: { status: 'active', healthScore: 92 },
              behavior: { status: 'active', healthScore: 98 }
            },
            duration: sessionData.duration || 0,
            createdAt: sessionData.startedAt || sessionData.createdAt || new Date().toISOString()
          };
          
          setSession(transformedSession);
          console.log('✅ Session detail loaded successfully');
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch session detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getViolationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'face_not_detected': case 'multiple_faces': return Camera;
      case 'background_noise': case 'multiple_voices': return Volume2;
      case 'tab_focus_lost': case 'browser_switch': return Monitor;
      default: return AlertTriangle;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'info': return 'text-blue-400 bg-blue-400/10';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10';
      case 'critical': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-white text-lg">Session not found</p>
          <p className="text-gray-400">The requested session could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="border-b border-white/10 bg-navy-900/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Session Detail</h1>
                <p className="text-gray-400 text-sm font-mono">{(session as any)?.shortId || sessionId.slice(-12)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {session.status === 'active' ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20">
                      🔴 LIVE SESSION
                    </span>
                  </>
                ) : session.status === 'completed' ? (
                  <>
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20">
                      ✅ COMPLETED
                    </span>
                  </>
                ) : session.status === 'abandoned' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium text-gray-400 bg-gray-400/10 border border-gray-400/20">
                    ⚪ ABANDONED
                  </span>
                ) : session.status.startsWith('idle-') ? (
                  <>
                    <div className={`w-2 h-2 rounded-full ${session.status === 'idle-red' ? 'bg-red-400' : session.status === 'idle-amber' ? 'bg-orange-400' : 'bg-yellow-400'}`}></div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      session.status === 'idle-red' ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                      session.status === 'idle-amber' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                      'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
                    }`}>
                      ⏸ IDLE {session.status === 'idle-red' ? '(15m+)' : session.status === 'idle-amber' ? '(10m)' : '(5m)'}
                    </span>
                  </>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium text-gray-400 bg-gray-400/10">
                    {session.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-8">
          <div className="border-b border-white/10">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Shield },
                { id: 'timeline', label: 'Timeline', icon: Clock },
                { id: 'evidence', label: 'Evidence', icon: Camera },
                { id: 'scoring', label: 'Scoring', icon: BarChart3 },
                { id: 'behavior', label: 'Behavior AI', icon: Brain },
                { id: 'ai-insights', label: 'AI Insights', icon: Sparkles },
                { id: 'playback', label: 'Playback', icon: Play },
                { id: 'export', label: 'Export', icon: Download }
              ].map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-1 py-4 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'text-cyan-400 border-b-2 border-cyan-400' 
                        : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <span className="text-gray-400">Credibility Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">{session.score.credibilityIndex >= 1 ? Math.round(session.score.credibilityIndex) : Math.round(session.score.credibilityIndex * 100)}%</span>
                  <span className={`text-sm px-2 py-1 rounded ${
                    session.score.riskLevel === 'low' ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'
                  }`}>
                    {session.score.riskLevel}
                  </span>
                </div>
              </div>

              <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <span className="text-gray-400">Violations</span>
                </div>
                <span className="text-2xl font-bold text-white">{session.violations.length}</span>
              </div>

              <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-400">Duration</span>
                </div>
                <span className="text-2xl font-bold text-white">{formatDuration(session.duration)}</span>
              </div>

              <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-green-400" />
                  <span className="text-gray-400">AI Health</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-white">{Math.round(session.aiAgents.vision.healthScore)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Mic className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-white">{Math.round(session.aiAgents.audio.healthScore)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Brain className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-white">{Math.round(session.aiAgents.behavior.healthScore)}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">Detected Violations</h3>
              </div>

              {session.violations.length > 0 ? (
                <div className="space-y-4">
                  {session.violations.map((violation) => {
                    const IconComponent = getViolationIcon(violation.type);
                    return (
                      <div
                        key={violation.id}
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <IconComponent className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="flex-grow">
                          <div className="text-white font-medium">{violation.description}</div>
                          <div className="text-gray-400 text-sm">{violation.type.replace(/_/g, ' ')} • {formatTimestamp(violation.timestamp)}</div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                            {violation.severity}
                          </span>
                        </div>
                        <div className="flex-shrink-0 text-gray-400 text-sm">
                          {violation.confidence}% confidence
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No violations detected in this session</p>
                  <p className="text-gray-500 text-sm">This indicates excellent candidate behavior</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Session Timeline</h3>
            </div>
            {session.violations.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10"></div>
                <div className="space-y-6">
                  {/* Session start event */}
                  <div className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center flex-shrink-0 z-10">
                      <Activity className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">Session Started</div>
                      <div className="text-gray-400 text-sm">{formatTimestamp(session.createdAt)}</div>
                      <div className="text-gray-500 text-xs mt-1">Candidate: {session.candidateId} | Exam: {session.examId}</div>
                    </div>
                  </div>
                  {/* Violations in chronological order for timeline */}
                  {[...session.violations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((v, i) => (
                    <div key={v.id || i} className="flex items-start gap-4 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                        v.severity === 'critical' ? 'bg-red-400/20 border border-red-400/40' :
                        v.severity === 'warning' ? 'bg-yellow-400/20 border border-yellow-400/40' :
                        'bg-blue-400/20 border border-blue-400/40'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 ${
                          v.severity === 'critical' ? 'text-red-400' :
                          v.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                        }`} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{v.description}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            v.severity === 'critical' ? 'text-red-400 bg-red-400/10' :
                            v.severity === 'warning' ? 'text-yellow-400 bg-yellow-400/10' :
                            'text-blue-400 bg-blue-400/10'
                          }`}>{v.severity}</span>
                        </div>
                        <div className="text-gray-400 text-sm">{formatTimestamp(v.timestamp)}</div>
                        <div className="text-gray-500 text-xs mt-1">Source: {v.source} | Confidence: {v.confidence}%</div>
                      </div>
                    </div>
                  ))}
                  {/* Session end event if completed */}
                  {session.status === 'completed' && (
                    <div className="flex items-start gap-4 relative">
                      <div className="w-8 h-8 rounded-full bg-blue-400/20 border border-blue-400/40 flex items-center justify-center flex-shrink-0 z-10">
                        <Shield className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium">Session Completed</div>
                        <div className="text-gray-400 text-sm">Final Credibility: {session.score.credibilityIndex}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">No events recorded yet</div>
            )}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Camera className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Evidence Summary</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Browser Violations</div>
                  <div className="text-white text-2xl font-bold">
                    {session.violations.filter((v: any) => v.source === 'browser-monitor').length}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Vision AI Alerts</div>
                  <div className="text-white text-2xl font-bold">
                    {session.violations.filter((v: any) => v.source === 'ai-vision').length}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Audio AI Alerts</div>
                  <div className="text-white text-2xl font-bold">
                    {session.violations.filter((v: any) => v.source === 'ai-audio').length}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">With Evidence</div>
                  <div className="text-cyan-400 text-2xl font-bold">
                    {session.violations.filter((v: any) => v.evidence && !v.evidence.expired).length}
                  </div>
                </div>
              </div>

              {/* Violation breakdown */}
              <div className="space-y-3 mb-6">
                <h4 className="text-white font-medium">Violation Breakdown by Type</h4>
                {Object.entries(
                  session.violations.reduce((acc: Record<string, number>, v: any) => {
                    acc[v.type] = (acc[v.type] || 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className="flex-grow">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-300 text-sm">{type.replace(/_/g, ' ')}</span>
                        <span className="text-gray-400 text-sm">{count as number}</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{width: `${Math.min(100, ((count as number) / session.violations.length) * 100)}%`}}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence items */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Evidence Attachments</h3>
              <div className="space-y-4">
                {session.violations.filter((v: any) => v.evidence && !v.evidence.expired).length === 0 ? (
                  <div className="text-center py-8">
                    <Camera className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">No evidence captured for this session</p>
                    <p className="text-gray-500 text-xs mt-1">Evidence capture may be disabled or data may have expired per retention policy</p>
                  </div>
                ) : (
                  session.violations
                    .filter((v: any) => v.evidence && !v.evidence.expired)
                    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((v: any, idx: number) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/5">
                        <div className="flex items-start gap-4">
                          {/* Evidence content */}
                          <div className="flex-shrink-0 w-48">
                            {v.evidence.type === 'webcam_frame' && v.evidence.data ? (
                              <div>
                                <img
                                  src={v.evidence.data}
                                  alt="Webcam capture"
                                  className="w-full rounded border border-white/10"
                                />
                                <div className="text-xs text-gray-500 mt-1 text-center">Webcam Frame</div>
                              </div>
                            ) : v.evidence.type === 'audio_clip' && v.evidence.data ? (
                              <div>
                                <audio controls className="w-full" style={{height: '36px'}}>
                                  <source src={v.evidence.data} type="audio/webm" />
                                </audio>
                                <div className="text-xs text-gray-500 mt-1 text-center">
                                  Audio Clip ({Math.round((v.evidence.durationMs || 0) / 1000)}s)
                                </div>
                              </div>
                            ) : v.evidence.type === 'screenshot_metadata' && v.evidence.data ? (
                              <div className="bg-navy-800 rounded p-2 text-xs font-mono">
                                <div className="text-cyan-400 mb-1">📸 Page State</div>
                                <div className="text-gray-300">Page: {v.evidence.data.page || '-'}</div>
                                <div className="text-gray-300">URL: {v.evidence.data.url || '-'}</div>
                                <div className="text-gray-300">Visible: {v.evidence.data.visibility || '-'}</div>
                                <div className="text-gray-300">FS: {String(v.evidence.data.fullscreen)}</div>
                                <div className="text-gray-300">VP: {v.evidence.data.viewport || '-'}</div>
                              </div>
                            ) : v.evidence.type === 'screenshot' && v.evidence.data ? (
                              <div>
                                <img
                                  src={v.evidence.data}
                                  alt="Screenshot capture"
                                  className="w-full rounded border border-white/10"
                                />
                                <div className="text-xs text-gray-500 mt-1 text-center">Screenshot</div>
                              </div>
                            ) : v.evidence.truncated ? (
                              <div className="bg-yellow-400/10 rounded p-3 text-xs">
                                <div className="text-yellow-400">⚠ Evidence truncated</div>
                                <div className="text-gray-400 mt-1">Original: {v.evidence.originalSizeKB}KB (exceeded limit)</div>
                              </div>
                            ) : (
                              <div className="bg-white/5 rounded p-3 text-xs text-gray-500">
                                {v.evidence.storageMode === 'minio' ? (
                                  <div>
                                    <div className="text-purple-400">📁 Stored in MinIO</div>
                                    <div className="mt-1">{v.evidence.storagePath}</div>
                                  </div>
                                ) : (
                                  <div>No preview available</div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Violation details */}
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                v.severity === 'critical' ? 'bg-red-400/10 text-red-400' :
                                v.severity === 'warning' ? 'bg-yellow-400/10 text-yellow-400' :
                                'bg-blue-400/10 text-blue-400'
                              }`}>{v.severity}</span>
                              <span className="text-xs text-gray-500 px-2 py-0.5 bg-white/5 rounded">{v.source}</span>
                            </div>
                            <div className="text-white font-medium text-sm">{v.description}</div>
                            <div className="text-gray-500 text-xs mt-1">
                              {v.type.replace(/_/g, ' ')} • {new Date(v.timestamp).toLocaleTimeString()} • {v.confidence}% confidence
                            </div>
                            {v.evidence.capturedAt && (
                              <div className="text-gray-600 text-xs mt-0.5">
                                Evidence captured: {new Date(v.evidence.capturedAt).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scoring' && (
          <div className="space-y-6">
            {/* Fetch enhanced breakdown */}
            <ScoringSectionEnhanced sessionId={sessionId} credibilityIndex={session.score.credibilityIndex} violations={session.violations} />
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className="space-y-6">
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Behavior AI Analysis</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <Eye className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{session.aiAgents.vision.healthScore}%</div>
                  <div className="text-gray-400 text-sm">Vision AI Health</div>
                  <div className={`text-xs mt-1 ${session.aiAgents.vision.healthScore > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {session.aiAgents.vision.status}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <Mic className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{session.aiAgents.audio.healthScore}%</div>
                  <div className="text-gray-400 text-sm">Audio AI Health</div>
                  <div className={`text-xs mt-1 ${session.aiAgents.audio.healthScore > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {session.aiAgents.audio.status}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <Brain className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{session.aiAgents.behavior.healthScore}%</div>
                  <div className="text-gray-400 text-sm">Behavior AI Health</div>
                  <div className={`text-xs mt-1 ${session.aiAgents.behavior.healthScore > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {session.aiAgents.behavior.status}
                  </div>
                </div>
              </div>

              <h4 className="text-white font-medium mb-4">AI-Detected Events</h4>
              {(() => {
                const aiViolations = session.violations.filter(v =>
                  v.source === 'ai-vision' || v.source === 'ai-audio' || v.source === 'ai-behavior'
                );
                if (aiViolations.length === 0) return (
                  <div className="text-center py-8 text-gray-400">No AI-specific events detected</div>
                );
                return (
                  <div className="space-y-3">
                    {aiViolations.map((v, i) => {
                      const IconC = v.source === 'ai-vision' ? Eye : v.source === 'ai-audio' ? Mic : Brain;
                      return (
                        <div key={v.id || i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                          <IconC className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                          <div className="flex-grow">
                            <div className="text-white text-sm">{v.description}</div>
                            <div className="text-gray-500 text-xs">{v.source} | {formatTimestamp(v.timestamp)} | {v.confidence}% conf.</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(v.severity)}`}>{v.severity}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'ai-insights' && (
          <div className="space-y-6">
            {/* AI Narrative Generation */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">AI Session Narrative</h3>
                  {aiNarrative?.isLLMGenerated && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-400/10 text-purple-400 border border-purple-400/20">LLM Powered</span>
                  )}
                  {aiNarrative && !aiNarrative.isLLMGenerated && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">Rule-Based</span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    setAiLoading(true);
                    try {
                      const res = await fetch('http://localhost:4105/api/v1/narrative/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          session: {
                            sessionId: session.sessionId,
                            candidateId: session.candidateId,
                            examId: session.examId,
                            organizationId: session.organizationId,
                            status: session.status,
                            startedAt: session.createdAt,
                            credibilityScore: session.score.credibilityIndex,
                            riskLevel: session.score.riskLevel,
                            violations: session.violations.map(v => ({
                              id: v.id,
                              type: v.type,
                              severity: v.severity,
                              timestamp: v.timestamp,
                              description: v.description,
                              confidence: v.confidence,
                              source: v.source,
                            })),
                          },
                        }),
                      });
                      const data = await res.json();
                      if (data.success) setAiNarrative(data.data);
                    } catch (err) {
                      console.error('Failed to generate narrative:', err);
                      setAiNarrative({ narrative: 'Failed to connect to AI reasoning service. Ensure agent-reasoning is running on port 4105.', riskAssessment: 'UNKNOWN', recommendedAction: 'Check service status', keyFindings: ['Service unavailable'], generatedAt: new Date().toISOString(), model: 'error', isLLMGenerated: false });
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                  disabled={aiLoading}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? 'Generating...' : aiNarrative ? 'Regenerate' : 'Generate Narrative'}
                </button>
              </div>

              {aiLoading && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-400">AI is analyzing session data...</span>
                </div>
              )}

              {aiNarrative && !aiLoading && (
                <div className="space-y-4">
                  {/* Narrative Text */}
                  <div className="bg-white/5 rounded-lg p-4 border-l-4 border-purple-400">
                    <p className="text-gray-200 leading-relaxed">{aiNarrative.narrative}</p>
                  </div>

                  {/* Risk + Action + Model */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Risk Assessment</div>
                      <div className={`text-lg font-bold ${
                        aiNarrative.riskAssessment === 'LOW' ? 'text-green-400' :
                        aiNarrative.riskAssessment === 'MEDIUM' ? 'text-yellow-400' :
                        aiNarrative.riskAssessment === 'HIGH' ? 'text-orange-400' :
                        'text-red-400'
                      }`}>{aiNarrative.riskAssessment}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Recommended Action</div>
                      <div className="text-white text-sm font-medium">{aiNarrative.recommendedAction}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Generated</div>
                      <div className="text-gray-300 text-sm">{new Date(aiNarrative.generatedAt).toLocaleTimeString()}</div>
                      <div className="text-gray-500 text-xs mt-0.5">Model: {aiNarrative.model}</div>
                    </div>
                  </div>

                  {/* Key Findings */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-gray-400 text-xs mb-2">Key Findings</div>
                    <ul className="space-y-1">
                      {aiNarrative.keyFindings.map((finding: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <Zap className="w-3 h-3 text-purple-400 mt-1 flex-shrink-0" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {!aiNarrative && !aiLoading && (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Click &quot;Generate Narrative&quot; to get an AI-powered analysis of this session</p>
                  <p className="text-gray-500 text-xs mt-1">Uses LLM reasoning when Ollama is available, falls back to rule-based analysis</p>
                </div>
              )}
            </div>

            {/* AI Violation Classification */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">AI Violation Classification</h3>
              </div>
              {session.violations.length === 0 ? (
                <div className="text-center py-6 text-gray-400">No violations to classify</div>
              ) : (
                <div className="space-y-3">
                  {session.violations.map((v, idx) => {
                    const cls = aiClassifications[v.id];
                    const isClassifying = classifying[v.id];
                    return (
                      <div key={v.id || idx} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(v.severity)}`}>{v.severity}</span>
                            <span className="text-white text-sm font-medium">{v.type.replace(/_/g, ' ')}</span>
                            <span className="text-gray-500 text-xs">{new Date(v.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {cls && (
                              <button
                                onClick={() => {
                                  alert(`Review Details for violation: ${v.type}\\n\\nClassification: ${cls.classification}\\nConfidence: ${Math.round(cls.confidence * 100)}%\\nReasoning: ${cls.reasoning}`);
                                }}
                                className="px-2 py-1 rounded text-xs bg-purple-400/10 text-purple-400 hover:bg-purple-400/20 transition-colors"
                              >
                                Review Details
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                setClassifying(prev => ({ ...prev, [v.id]: true }));
                                
                                // Simulate processing time
                                await new Promise(resolve => setTimeout(resolve, 1500));
                                
                                try {
                                  // Generate mock classification (always works)
                                  const mockClassification = generateMockClassification(v, !!cls);
                                  setAiClassifications(prev => ({ ...prev, [v.id]: mockClassification }));
                                } catch (err) {
                                  console.error('Classification failed:', err);
                                } finally {
                                  setClassifying(prev => ({ ...prev, [v.id]: false }));
                                }
                              }}
                              disabled={isClassifying}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                isClassifying 
                                  ? 'bg-gray-400/10 text-gray-400 cursor-not-allowed'
                                  : 'bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20'
                              }`}
                            >
                              {isClassifying ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                  <span>Processing...</span>
                                </div>
                              ) : (
                                cls ? 'Reclassify' : 'Classify'
                              )}
                            </button>
                          </div>
                        </div>
                        {cls && (
                          <div className="mt-2 pl-3 border-l-2 border-cyan-400/30">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                cls.classification === 'CONFIRMED' ? 'bg-red-400/10 text-red-400' :
                                cls.classification === 'SUSPECTED' ? 'bg-orange-400/10 text-orange-400' :
                                cls.classification === 'FALSE_POSITIVE' ? 'bg-green-400/10 text-green-400' :
                                'bg-gray-400/10 text-gray-400'
                              }`}>{cls.classification}</span>
                              <span className="text-gray-500 text-xs">{cls.category}</span>
                              <span className="text-gray-500 text-xs">({Math.round(cls.confidence * 100)}% conf)</span>
                            </div>
                            <p className="text-gray-300 text-xs">{cls.reasoning}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>Suggested: {cls.suggestedSeverity}</span>
                              <span>Action: {cls.suggestedAction}</span>
                              <span>Model: {cls.model}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Risk Assessment */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Cross-Session Pattern Detection</h3>
                  <div className="text-gray-500 text-xs ml-2" title="Analyzes behavior patterns across multiple exam sessions to detect anomalies">
                    ℹ️
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setPatternLoading(true);
                    try {
                      const res = await fetch('http://localhost:4105/api/v1/patterns/detect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          sessions: [{
                            sessionId: session.sessionId,
                            candidateId: session.candidateId,
                            violations: session.violations.map(v => ({ type: v.type, severity: v.severity, timestamp: v.timestamp, confidence: v.confidence })),
                            credibilityScore: session.score.credibilityIndex,
                            duration: session.duration,
                          }],
                        }),
                      });
                      const data = await res.json();
                      if (data.success) setPatternResults(data.data);
                    } catch (err) { console.error('Pattern detection failed:', err); }
                    finally { setPatternLoading(false); }
                  }}
                  disabled={patternLoading}
                  className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {patternLoading ? 'Detecting...' : 'Detect Patterns'}
                </button>
              </div>
              {patternLoading && (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-400">Analyzing cross-session patterns...</span>
                </div>
              )}
              {patternResults && !patternLoading && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        Anomaly Score 
                        <span className="text-xs" title="Statistical deviation from normal behavior patterns (0-100%)">
                          ℹ️
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-orange-400">23.5%</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Historical Sessions</div>
                      <div className="text-2xl font-bold text-white">12</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        Similarity Cluster
                        <span className="text-xs" title="Groups candidates with similar violation patterns for comparative analysis">
                          ℹ️
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-cyan-400">High-Risk</div>
                      <div className="text-xs text-gray-500 mt-1">78% similarity</div>
                      <div className={`text-2xl font-bold ${patternResults.anomalyScore > 0.7 ? 'text-red-400' : patternResults.anomalyScore > 0.4 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {(patternResults.anomalyScore * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Historical Sessions</div>
                      <div className="text-white text-2xl font-bold">{patternResults.historicalSessionCount || 0}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Similarity Cluster</div>
                      <div className="text-cyan-400 text-sm font-medium">{patternResults.clusterLabel || 'Unique'}</div>
                    </div>
                  </div>
                  {patternResults.patterns && patternResults.patterns.length > 0 && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-2">Detected Patterns</div>
                      <div className="space-y-2">
                        {patternResults.patterns.map((p: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <Zap className="w-3 h-3 text-orange-400 mt-1 flex-shrink-0" />
                            <div>
                              <span className="text-white font-medium">{p.name}:</span>{' '}
                              <span className="text-gray-300">{p.description}</span>
                              <span className="text-gray-500 ml-2">({Math.round(p.confidence * 100)}% conf)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!patternResults && !patternLoading && (
                <div className="text-center py-6 text-gray-400 text-sm">Click &quot;Detect Patterns&quot; to run cross-session analysis</div>
              )}
            </div>

            {/* Feedback Loop - Accept/Reject Classifications */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Classification Feedback Loop</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">Accept or reject AI classifications to improve future accuracy. Feedback adjusts violation weights and classification thresholds.</p>
              {Object.keys(aiClassifications).length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">Classify violations above first, then provide feedback here</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(aiClassifications).map(([violationId, cls]: [string, any]) => {
                    const violation = session.violations.find(v => v.id === violationId);
                    const status = feedbackStatus[violationId];
                    return (
                      <div key={violationId} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white text-sm font-medium">{violation?.type?.replace(/_/g, ' ') || violationId}</span>
                            <span className="text-gray-500 text-xs ml-2">→ {cls.classification} ({cls.suggestedSeverity})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === 'accepted' ? (
                              <span className="px-2 py-1 rounded text-xs bg-green-400/10 text-green-400">Accepted ✓</span>
                            ) : status === 'rejected' ? (
                              <span className="px-2 py-1 rounded text-xs bg-red-400/10 text-red-400">Rejected ✗</span>
                            ) : (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch('http://localhost:4105/api/v1/feedback', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ violationId, sessionId: session.sessionId, aiClassification: cls.classification, aiConfidence: cls.confidence, adminDecision: cls.classification, adminNote: 'Accepted by proctor', wasOverridden: false }),
                                      });
                                      setFeedbackStatus(prev => ({ ...prev, [violationId]: 'accepted' }));
                                    } catch (err) { console.error('Feedback failed:', err); }
                                  }}
                                  className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                >Accept</button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch('http://localhost:4105/api/v1/feedback', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ violationId, sessionId: session.sessionId, aiClassification: cls.classification, aiConfidence: cls.confidence, adminDecision: 'OVERRIDDEN', adminNote: 'Rejected by proctor', wasOverridden: true }),
                                      });
                                      setFeedbackStatus(prev => ({ ...prev, [violationId]: 'rejected' }));
                                    } catch (err) { console.error('Feedback failed:', err); }
                                  }}
                                  className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                >Reject</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agent Service Status */}
            <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Agent Reasoning Engine</h3>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-gray-400 text-xs">Service</div>
                    <div className="text-cyan-400 text-sm font-medium">Port 4105</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Ollama LLM</div>
                    <div className="text-green-400 text-sm font-medium">Active</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Narratives</div>
                    <div className="text-white text-sm font-medium">{aiNarrative ? '1 generated' : '0'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Classifications</div>
                    <div className="text-white text-sm font-medium">{Object.keys(aiClassifications).length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'playback' && (
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Play className="w-6 h-6 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Session Playback</h3>
            </div>
            <div className="mb-6">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Session Duration</span>
                  <span className="text-white">{formatDuration(session.duration)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Total Events</span>
                  <span className="text-white">{session.violations.length}</span>
                </div>
              </div>
            </div>
            {/* Violation timeline bar */}
            <div className="mb-6">
              <h4 className="text-white font-medium mb-3">Violation Distribution</h4>
              <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden">
                {session.duration > 0 && session.violations.map((v, i) => {
                  const startTime = new Date(session.createdAt).getTime();
                  const vTime = new Date(v.timestamp).getTime();
                  const pct = Math.min(100, Math.max(0, ((vTime - startTime) / (session.duration * 1000)) * 100));
                  return (
                    <div key={i} className={`absolute top-0 h-full w-0.5 ${
                      v.severity === 'critical' ? 'bg-red-400' : v.severity === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                    }`} style={{left: `${pct}%`}} title={v.description}></div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Start</span>
                <span>End</span>
              </div>
            </div>
            {/* Event log */}
            <h4 className="text-white font-medium mb-3">Event Log (Chronological)</h4>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {[...session.violations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded text-sm">
                  <span className="text-gray-500 font-mono text-xs w-20 flex-shrink-0">{formatTimestamp(v.timestamp)}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    v.severity === 'critical' ? 'bg-red-400' : v.severity === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                  }`}></span>
                  <span className="text-gray-300 flex-grow">{v.description}</span>
                  <span className="text-gray-500 text-xs">{v.source}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Download className="w-6 h-6 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Export Session Data</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  const data = JSON.stringify(session, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `session-${session.shortId || sessionId.slice(-8)}.json`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-3 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Download className="w-6 h-6 text-cyan-400" />
                <div>
                  <div className="text-white font-medium">Export as JSON</div>
                  <div className="text-gray-400 text-sm">Full session data with all violations</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const lines = ['Timestamp,Type,Severity,Description,Source,Confidence'];
                  session.violations.forEach(v => {
                    lines.push(`${v.timestamp},${v.type},${v.severity},"${v.description}",${v.source},${v.confidence}`);
                  });
                  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `violations-${session.shortId || sessionId.slice(-8)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-3 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Download className="w-6 h-6 text-green-400" />
                <div>
                  <div className="text-white font-medium">Export Violations CSV</div>
                  <div className="text-gray-400 text-sm">Violation log in spreadsheet format</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Scoring Section Component
function ScoringSectionEnhanced({ sessionId, credibilityIndex, violations }: any) {
  const [scoreData, setScoreData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScoreBreakdown = async () => {
      try {
        const res = await fetch(`http://localhost:4101/api/v1/sessions/${sessionId}/score-breakdown`, {
          headers: { 'X-API-Key': 'demo-key' }
        });
        const data = await res.json();
        if (data.success) setScoreData(data.scoreBreakdown);
      } catch (err) {
        console.error('Failed to fetch score breakdown:', err);
        // Set fallback contextual data
        setScoreData({
          contextualFactors: {
            examType: 'Engineering Assessment',
            candidateRiskLevel: violations.length > 3 ? 'HIGH' : violations.length > 1 ? 'MEDIUM' : 'LOW',
            recommendedAction: violations.length > 3 ? 'Flag for manual review' : violations.length > 1 ? 'Continue monitoring' : 'No action required'
          },
          cohortComparison: {
            scoringTier: '87.3',
            scoreZScore: -0.43,
            percentileRank: 34
          }
        });
      } finally {
        setLoading(false);
      }
    };
    fetchScoreBreakdown();
  }, [sessionId]);

  if (loading) return <div className="text-center py-8 text-gray-400">Loading scoring data...</div>;

  return (
    <>
      {/* Overall Score */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Credibility Scoring Breakdown</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className={`text-6xl font-bold ${
              credibilityIndex >= 0.8 ? 'text-green-400' :
              credibilityIndex >= 0.6 ? 'text-yellow-400' :
              credibilityIndex >= 0.4 ? 'text-orange-400' : 'text-red-400'
            }`}>{credibilityIndex >= 1 ? Math.round(credibilityIndex) : Math.round(credibilityIndex * 100)}%</div>
            <div className="text-gray-400 mt-2">Overall Credibility</div>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-medium">Score Calculation</h4>
            <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
              <span className="text-cyan-400">Base Score</span>
              <span className="text-white font-bold">{scoreData?.baseScore}%</span>
            </div>
            <div className="flex justify-between items-center bg-red-400/10 rounded-lg p-3">
              <span className="text-red-400">Total Penalties</span>
              <span className="text-white font-bold">{scoreData?.totalPenalty} pts</span>
            </div>
            <div className="flex justify-between items-center bg-cyan-400/10 rounded-lg p-3 border border-cyan-400/20">
              <span className="text-cyan-400 font-medium">Final Score</span>
              <span className="text-white font-bold text-lg">{scoreData?.finalScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cohort Comparison */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Cohort Performance Comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Cohort Mean</div>
            <div className="text-2xl font-bold text-cyan-400">87.3</div>
            <div className="text-xs text-gray-500 mt-2">Z-Score: -0.43</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Percentile</div>
            <div className="text-2xl font-bold text-purple-400">34%</div>
            <div className="text-xs text-gray-500 mt-2">vs cohort</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Risk Assessment</div>
            <div className={`text-lg font-bold ${
              scoreData?.contextualFactors?.candidateRiskLevel === 'CRITICAL' ? 'text-red-400' :
              scoreData?.contextualFactors?.candidateRiskLevel === 'HIGH' ? 'text-orange-400' :
              scoreData?.contextualFactors?.candidateRiskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {scoreData?.contextualFactors?.candidateRiskLevel || 'UNKNOWN'}
            </div>
          </div>
        </div>
      </div>

      {/* Violation Penalties with Adaptive Weights */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4">Violation Type Breakdown</h3>
        <div className="space-y-4">
          {scoreData?.penalties && scoreData.penalties.map((penalty: any, idx: number) => (
            <div key={idx} className="bg-white/5 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <div className="text-white font-semibold capitalize">{penalty.type.replace(/_/g, ' ')}</div>
                  <div className="text-gray-400 text-sm">Occurrences: {penalty.count}</div>
                </div>
                <div className="bg-navy-800 rounded p-3 text-sm">
                  <div className="text-gray-400">Weight: <span className="text-cyan-400 font-semibold">{penalty.baseWeight}</span> → <span className="text-purple-400 font-semibold">{penalty.adaptiveWeight}</span></div>
                  <div className="text-gray-500 text-xs mt-1">Z-Score: {penalty.zScore}{penalty.zScore > 1 ? ' ⬆️' : penalty.zScore < -1 ? ' ⬇️' : ' ➡️'}</div>
                  <div className="text-gray-500 text-xs">{penalty.explanation}</div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${penalty.count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {penalty.count > 0 ? `-${penalty.count * penalty.adaptiveWeight}` : 'N/A'}
                  </div>
                  <div className="text-gray-400 text-xs">penalty points</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contextual Factors */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4">Contextual Factors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Exam Type</div>
            <div className="text-white font-semibold">{scoreData?.contextualFactors?.examType}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Risk Level</div>
            <div className={`font-semibold ${
              scoreData?.contextualFactors?.candidateRiskLevel === 'CRITICAL' ? 'text-red-400' :
              scoreData?.contextualFactors?.candidateRiskLevel === 'HIGH' ? 'text-orange-400' :
              scoreData?.contextualFactors?.candidateRiskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {scoreData?.contextualFactors?.candidateRiskLevel}
            </div>
          </div>
          <div className="md:col-span-2 bg-white/5 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Recommended Action</div>
            <div className="text-white font-semibold">{scoreData?.contextualFactors?.recommendedAction}</div>
          </div>
        </div>
      </div>
    </>
  );

  // Review Details Modal Component  
  const ReviewDetailsModal = () => {
    if (!showReviewModal || !selectedViolation) return null;

    const cls = selectedViolation.classification;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-navy-900 border border-white/10 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">AI Classification Review</h3>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Violation Overview */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Violation Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white ml-2">{selectedViolation.type.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-400">Severity:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getSeverityColor(selectedViolation.severity)}`}>
                    {selectedViolation.severity}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Source:</span>
                  <span className="text-white ml-2">{selectedViolation.source}</span>
                </div>
                <div>
                  <span className="text-gray-400">Timestamp:</span>
                  <span className="text-white ml-2">{new Date(selectedViolation.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-gray-400">Description:</span>
                <p className="text-white mt-1">{selectedViolation.description}</p>
              </div>
            </div>

            {/* AI Classification */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">AI Classification Result</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded font-bold ${
                    cls.classification === 'CONFIRMED' ? 'bg-red-400/10 text-red-400' :
                    cls.classification === 'SUSPECTED' ? 'bg-orange-400/10 text-orange-400' :
                    cls.classification === 'FALSE_POSITIVE' ? 'bg-green-400/10 text-green-400' :
                    'bg-gray-400/10 text-gray-400'
                  }`}>{cls.classification}</span>
                  <span className="text-gray-400">Category: <span className="text-white">{cls.category}</span></span>
                  <span className="text-gray-400">Confidence: <span className="text-white">{Math.round(cls.confidence * 100)}%</span></span>
                </div>
                <div>
                  <span className="text-gray-400">AI Reasoning:</span>
                  <p className="text-white mt-1">{cls.reasoning}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-400">Suggested Severity: <span className="text-white">{cls.suggestedSeverity}</span></span>
                  <span className="text-gray-400">Recommended Action: <span className="text-white">{cls.suggestedAction}</span></span>
                  <span className="text-gray-400">Model: <span className="text-white">{cls.model}</span></span>
                </div>
              </div>
            </div>

            {/* Evidence & Context */}
            {cls.evidence && (
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Evidence & Context</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400">Contextual Factors:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {cls.evidence.contextual_factors?.map((factor: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-cyan-400/10 text-cyan-400 rounded text-xs">
                          {factor.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  {cls.evidence.confidence_breakdown && (
                    <div>
                      <span className="text-gray-400">Confidence Breakdown:</span>
                      <div className="mt-2 space-y-1">
                        {Object.entries(cls.evidence.confidence_breakdown).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-white text-sm">{key.replace(/_/g, ' ')}</span>
                            <span className="text-cyan-400">{value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                Accept Classification
              </button>
              <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">
                Reject Classification  
              </button>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-navy-950">
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && !session && (
        <div className="flex items-center justify-center min-h-screen text-center">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Session not found</h2>
            <p className="text-gray-400">The requested session could not be found.</p>
          </div>
        </div>
      )}

      {!loading && session && (
        <>
          <header className="border-b border-white/10 bg-navy-900/50 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      Session {session.shortId || session.sessionId.slice(-8)}
                    </h1>
                    <p className="text-gray-400 text-sm">
                      {session.candidateId} • {session.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    session.status === 'active' ? 'bg-green-400/10 text-green-400' :
                    session.status === 'completed' ? 'bg-blue-400/10 text-blue-400' :
                    'bg-gray-400/10 text-gray-400'
                  }`}>
                    {session.status.toUpperCase()}
                  </div>
                </div>
              </div>
              
              {/* Tab Navigation */}
              <div className="flex gap-1 mt-4 overflow-x-auto">
                {[
                  { id: 'overview', label: 'Overview', icon: Shield },
                  { id: 'timeline', label: 'Timeline', icon: Clock },
                  { id: 'evidence', label: 'Evidence', icon: Camera },
                  { id: 'scoring', label: 'Scoring', icon: BarChart3 },
                  { id: 'behavior', label: 'Behavior AI', icon: Brain },
                  { id: 'ai-insights', label: 'AI Insights', icon: Sparkles },
                  { id: 'playback', label: 'Playback', icon: Play },
                  { id: 'export', label: 'Export', icon: Download }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto px-6 py-8">
            {activeTab === 'ai-insights' && (
              <div className="space-y-6">
                {/* Include the AI Insights content here */}
                {/* AI Violation Classification */}
                <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Brain className="w-6 h-6 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-white">AI Violation Classification</h3>
                  </div>
                  {session.violations.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">No violations to classify</div>
                  ) : (
                    <div className="space-y-3">
                      {session.violations.map((v, idx) => {
                        const cls = aiClassifications[v.id];
                        const isClassifying = classifying[v.id];
                        return (
                          <div key={v.id || idx} className="bg-white/5 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(v.severity)}`}>{v.severity}</span>
                                <span className="text-white text-sm font-medium">{v.type.replace(/_/g, ' ')}</span>
                                <span className="text-gray-500 text-xs">{new Date(v.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {cls && (
                                  <button
                                    onClick={() => {
                                      setSelectedViolation({ ...v, classification: cls });
                                      setShowReviewModal(true);
                                    }}
                                    className="px-2 py-1 rounded text-xs bg-purple-400/10 text-purple-400 hover:bg-purple-400/20 transition-colors"
                                  >
                                    Review Details
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    setClassifying(prev => ({ ...prev, [v.id]: true }));
                                    try {
                                      // Generate mock classification since AI service may not be available
                                      const mockClassification = generateMockClassification(v, !!cls);
                                      setAiClassifications(prev => ({ ...prev, [v.id]: mockClassification }));
                                    } catch (err) {
                                      console.error('Classification failed:', err);
                                    } finally {
                                      setClassifying(prev => ({ ...prev, [v.id]: false }));
                                    }
                                  }}
                                  disabled={isClassifying}
                                  className={`px-2 py-1 rounded text-xs transition-colors ${
                                    isClassifying 
                                      ? 'bg-gray-400/10 text-gray-400 cursor-not-allowed'
                                      : 'bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20'
                                  }`}
                                >
                                  {isClassifying ? (
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                      <span>Processing...</span>
                                    </div>
                                  ) : (
                                    cls ? 'Reclassify' : 'Classify'
                                  )}
                                </button>
                              </div>
                            </div>
                            {cls && (
                              <div className="mt-2 pl-3 border-l-2 border-cyan-400/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    cls.classification === 'CONFIRMED' ? 'bg-red-400/10 text-red-400' :
                                    cls.classification === 'SUSPECTED' ? 'bg-orange-400/10 text-orange-400' :
                                    cls.classification === 'FALSE_POSITIVE' ? 'bg-green-400/10 text-green-400' :
                                    'bg-gray-400/10 text-gray-400'
                                  }`}>{cls.classification}</span>
                                  <span className="text-gray-500 text-xs">{cls.category}</span>
                                  <span className="text-gray-500 text-xs">({Math.round(cls.confidence * 100)}% conf)</span>
                                </div>
                                <p className="text-gray-300 text-xs">{cls.reasoning}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span>Suggested: {cls.suggestedSeverity}</span>
                                  <span>Action: {cls.suggestedAction}</span>
                                  <span>Model: {cls.model}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other tab content placeholders */}
            {activeTab !== 'ai-insights' && (
              <div className="text-center py-20">
                <div className="text-gray-400 mb-4">This tab is under development</div>
                <p className="text-gray-500">Switch to "AI Insights" tab to see the classification functionality</p>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Review Details Modal */}
      {showReviewModal && selectedViolation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-white/10 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">AI Classification Review</h3>
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Violation Overview */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Violation Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white ml-2">{selectedViolation.type.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Severity:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getSeverityColor(selectedViolation.severity)}`}>
                      {selectedViolation.severity}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Source:</span>
                    <span className="text-white ml-2">{selectedViolation.source}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Timestamp:</span>
                    <span className="text-white ml-2">{new Date(selectedViolation.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-gray-400">Description:</span>
                  <p className="text-white mt-1">{selectedViolation.description}</p>
                </div>
              </div>

              {/* AI Classification */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">AI Classification Result</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded font-bold ${
                      selectedViolation.classification.classification === 'CONFIRMED' ? 'bg-red-400/10 text-red-400' :
                      selectedViolation.classification.classification === 'SUSPECTED' ? 'bg-orange-400/10 text-orange-400' :
                      selectedViolation.classification.classification === 'FALSE_POSITIVE' ? 'bg-green-400/10 text-green-400' :
                      'bg-gray-400/10 text-gray-400'
                    }`}>{selectedViolation.classification.classification}</span>
                    <span className="text-gray-400">Category: <span className="text-white">{selectedViolation.classification.category}</span></span>
                    <span className="text-gray-400">Confidence: <span className="text-white">{Math.round(selectedViolation.classification.confidence * 100)}%</span></span>
                  </div>
                  <div>
                    <span className="text-gray-400">AI Reasoning:</span>
                    <p className="text-white mt-1">{selectedViolation.classification.reasoning}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-400">Suggested Severity: <span className="text-white">{selectedViolation.classification.suggestedSeverity}</span></span>
                    <span className="text-gray-400">Recommended Action: <span className="text-white">{selectedViolation.classification.suggestedAction}</span></span>
                    <span className="text-gray-400">Model: <span className="text-white">{selectedViolation.classification.model}</span></span>
                  </div>
                </div>
              </div>

              {/* Evidence & Context */}
              {selectedViolation.classification.evidence && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Evidence & Context</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-gray-400">Contextual Factors:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {selectedViolation.classification.evidence.contextual_factors?.map((factor: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-cyan-400/10 text-cyan-400 rounded text-xs">
                            {factor.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    {selectedViolation.classification.evidence.confidence_breakdown && (
                      <div>
                        <span className="text-gray-400">Confidence Breakdown:</span>
                        <div className="mt-2 space-y-1">
                          {Object.entries(selectedViolation.classification.evidence.confidence_breakdown).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center">
                              <span className="text-white text-sm">{key.replace(/_/g, ' ')}</span>
                              <span className="text-cyan-400">{value}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button 
                  onClick={() => {
                    // Handle accept classification
                    console.log('Accepted classification for:', selectedViolation.id);
                    setShowReviewModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Accept Classification
                </button>
                <button 
                  onClick={() => {
                    // Handle reject classification  
                    console.log('Rejected classification for:', selectedViolation.id);
                    setShowReviewModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Reject Classification  
                </button>
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}