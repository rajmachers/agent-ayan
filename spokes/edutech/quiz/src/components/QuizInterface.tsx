'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface QuizInterfaceProps {
  candidateData: {
    candidateId: string;
    accessCode: string;
    sessionId: string;
  };
  onLogout: () => void;
}

declare global {
  interface Window {
    __PROCTOR_SESSION_MANAGER_URL?: string;
    __PROCTOR_SESSION_MANAGER_URLS?: string[];
  }
}

// Demo quiz data
const DEMO_QUESTIONS = [
  {
    question: "What is the primary purpose of diversification in investing?",
    options: [
      "To maximize returns regardless of risk",
      "To minimize risk by spreading investments across different assets",
      "To concentrate wealth in the best performing stocks",
      "To time the market effectively"
    ],
    correct: 1
  },
  {
    question: "Which of the following best describes compound interest?",
    options: [
      "Interest paid only on the original principal",
      "Interest that decreases over time",
      "Interest earned on both the original principal and previously earned interest",
      "Interest paid at the end of an investment term only"
    ],
    correct: 2
  },
  {
    question: "What is a credit score primarily used for?",
    options: [
      "To determine investment returns",
      "To assess creditworthiness for loans and financial products",
      "To calculate tax obligations",
      "To measure inflation rates"
    ],
    correct: 1
  },
  {
    question: "Which type of account typically offers the highest liquidity?",
    options: [
      "Certificate of Deposit (CD)",
      "Savings Account",
      "Money Market Account",  
      "Checking Account"
    ],
    correct: 3
  },
  {
    question: "What does APR stand for in financial terms?",
    options: [
      "Annual Percentage Rate",
      "Average Principal Return",
      "Automated Payment Reminder",
      "Asset Protection Ratio"
    ],
    correct: 0
  }
];

export default function QuizInterface({ candidateData, onLogout }: QuizInterfaceProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isCompleted, setIsCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [simulationEnabled, setSimulationEnabled] = useState(false);

  const getSessionManagerCandidates = () => {
    const envCandidates = [
      process.env.NEXT_PUBLIC_SESSION_MANAGER_WS_URL,
      process.env.NEXT_PUBLIC_PROCTOR_SESSION_MANAGER_WS_URL,
      process.env.NEXT_PUBLIC_WS_SESSION_MANAGER_URL,
      process.env.NEXT_PUBLIC_HUB_SESSION_MANAGER_WS_URL,
    ].filter((url): url is string => Boolean(url && url.trim()));

    const defaults = [
      'ws://localhost:14181',
      'ws://localhost:8181',
      'ws://localhost:8081',
      'ws://localhost:8080',
    ];

    return Array.from(new Set([...envCandidates, ...defaults]));
  };

  // Map candidateData to organization structure
  const getOrganizationId = () => {
    if (candidateData.accessCode.startsWith('EXAM')) return '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94'; // CS
    if (candidateData.accessCode.startsWith('MIDTERM')) return '123e4567-e89b-12d3-a456-426614174000'; // ENG
    return '987fcdeb-51a2-43d7-8f9e-123456789abc'; // Business
  };

  // Initialize proctoring SDK when component mounts
  useEffect(() => {
    const sessionManagerCandidates = getSessionManagerCandidates();
    window.__PROCTOR_SESSION_MANAGER_URLS = sessionManagerCandidates;
    window.__PROCTOR_SESSION_MANAGER_URL = sessionManagerCandidates[0];

    // Guard: only load script once
    if (document.getElementById('proctor-sdk-script')) return;
    const script = document.createElement('script');
    script.id = 'proctor-sdk-script';
    script.src = '/proctor-sdk-p6.js';
    script.onload = () => {
      console.log('ProctorSDK loaded successfully');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup SDK on unmount
      if (window.ProctorSDK) {
        const instance = window.ProctorSDK.getInstance();
        if (instance) {
          instance.destroy();
        }
      }
    };
  }, []);

  // Start proctoring when enabled
  useEffect(() => {
    if (!proctoringEnabled || !window.ProctorSDK) return;
    // Guard: don't re-init if already active
    const existing = window.ProctorSDK.getInstance();
    if (existing && existing.isActive) return;

    const sessionManagerCandidates = getSessionManagerCandidates();

    try {
        const proctor = window.ProctorSDK.init({
          candidateId: candidateData.candidateId,
          examId: 'financial-literacy-demo',
          organizationId: getOrganizationId(),
          sessionManager: sessionManagerCandidates[0],
          sessionManagerCandidates,
          enableSimulation: simulationEnabled,
          widgetUrl: '/widget.html',
          position: 'top-right',
          autoStart: true
        });

        // Set up event listeners
        proctor.on('violation', (violation: any) => {
          console.log('Violation detected:', violation);
        });

        proctor.on('credibility:updated', (score: number) => {
          console.log('Credibility score updated:', score);
        });

        proctor.on('session:started', () => {
          console.log('Proctoring session started');
        });

      } catch (error) {
        console.error('Failed to initialize proctoring:', error);
      }
  }, [proctoringEnabled, simulationEnabled, candidateData]);

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isCompleted) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isCompleted) {
      handleSubmit();
    }
  }, [timeLeft, isCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: answerIndex }));
  };

  const handleNext = () => {
    if (currentQuestion < DEMO_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    setIsCompleted(true);
    setShowResults(true);
    
    // Remove proctoring widget after exam submitted
    if (window.ProctorSDK) {
      const instance = window.ProctorSDK.getInstance();
      if (instance) {
        instance.destroy();
      }
    }
  };

  const calculateScore = () => {
    let correct = 0;
    DEMO_QUESTIONS.forEach((q, index) => {
      if (answers[index] === q.correct) correct++;
    });
    return Math.round((correct / DEMO_QUESTIONS.length) * 100);
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  // Show results screen
  if (showResults) {
    const finalScore = calculateScore();
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
          <div className="text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Exam Completed</h1>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Exam Score</h3>
                  <p className="text-3xl font-bold text-blue-600">{finalScore}%</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Proctoring Status</h3>
                  <p className={`text-3xl font-bold ${proctoringEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {proctoringEnabled ? 'Monitored' : 'Not Monitored'}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-gray-600 mb-6">
              <p>Completed: {new Date().toLocaleString()}</p>
              <p>Candidate: {candidateData.candidateId}</p>
            </div>

            <button
              onClick={onLogout}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">
                Financial Literacy Assessment
              </h1>
              <span className="text-sm text-gray-500">
                Candidate: {candidateData.candidateId}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-500' : 'text-gray-500'}`} />
                <span className={`font-mono text-lg ${timeLeft < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Proctoring Setup */}
        {!proctoringEnabled && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Exam Setup</h2>
              <p className="text-gray-600 mb-6">
                This exam can be proctored using AI monitoring. Would you like to enable proctoring?
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">🎯 New: Standalone Proctoring Widget</h3>
                <div className="text-sm text-blue-800 text-left space-y-1">
                  <p>• Self-contained iframe widget</p>
                  <p>• Independent session management</p>
                  <p>• Universal integration (works with any app)</p>
                  <p>• Real-time violation detection & alerts</p>
                  <p>• Persistent across page reloads</p>
                </div>
              </div>

              <div className="flex flex-col space-y-4 mb-6">
                <div className="flex items-center justify-center space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulationEnabled}
                      onChange={(e) => setSimulationEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Enable Violation Simulation (for testing)</span>
                  </label>
                </div>
              </div>
              
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={() => setProctoringEnabled(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  Start with Proctoring
                </button>
                <button
                  onClick={() => {}}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-400"
                >
                  Continue without Proctoring
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Proctoring Active Notice */}
        {proctoringEnabled && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-medium text-green-800">AI Proctoring Active</h3>
                <p className="text-sm text-green-700">
                  The standalone proctoring widget is monitoring your exam session. 
                  Check the widget on the right side of your screen for status updates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Progress */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-gray-600">
              Question {currentQuestion + 1} of {DEMO_QUESTIONS.length}
            </div>
            <div className="text-sm text-gray-600">
              {getAnsweredCount()} of {DEMO_QUESTIONS.length} answered
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / DEMO_QUESTIONS.length) * 100}%` }}
            ></div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {DEMO_QUESTIONS[currentQuestion].question}
            </h2>

            <div className="space-y-3">
              {DEMO_QUESTIONS[currentQuestion].options.map((option, index) => (
                <label
                  key={index}
                  className={`block p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    answers[currentQuestion] === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name={`question-${currentQuestion}`}
                      value={index}
                      checked={answers[currentQuestion] === index}
                      onChange={() => handleAnswerSelect(index)}
                      className="mr-3 text-blue-600"
                    />
                    <span className="text-gray-800">{option}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex space-x-3">
              {currentQuestion === DEMO_QUESTIONS.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={getAnsweredCount() < DEMO_QUESTIONS.length}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}