'use client';

import { useState } from 'react';
import { ShieldCheck, User, Key, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onLogin: (candidateData: {
    candidateId: string;
    accessCode: string;
    sessionId: string;
  }) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [candidateId, setCandidateId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (!candidateId.trim() || !accessCode.trim()) {
        throw new Error('Please fill in all fields');
      }

      // Demo validation (in real implementation, this would call the API)
      const validAccessCodes = ['DEMO2026', 'TEST2026', 'EXAM2024', 'MIDTERM2024', 'FINAL2024'];
      if (!validAccessCodes.includes(accessCode)) {
        throw new Error('Invalid access code. Please use one of: EXAM2024, MIDTERM2024, FINAL2024');
      }

      // Determine organization based on candidate email domain
      let organizationId = '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94'; // Default CS University
      let examId = 'financial-literacy-2026';
      
      if (candidateId.includes('@eng.college.edu')) {
        organizationId = '443be9e2-7918-4c1f-8d5b-ad2a3a2abd95'; // Engineering College
        examId = 'engineering-midterm-2024';
      } else if (candidateId.includes('@business.school.edu')) {
        organizationId = '332be9e2-7918-4c1f-8d5b-ad2a3a2abd96'; // Business School
        examId = 'business-final-2024';
      } else if (candidateId.includes('@cs.university.edu')) {
        organizationId = '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94'; // CS University
        examId = 'financial-literacy-2026';
      }

      // Create proctoring session via Next.js API (avoids CORS)
      const sessionResponse = await fetch('/api/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          candidateId: candidateId.trim(),
          examId: examId,
          organizationId: organizationId,
          examConfig: {
            duration: 900, // 15 minutes
            allowedDevices: ['computer'],
            strictMode: true,
            aiMonitoring: {
              vision: true,
              audio: true,
              behavior: true
            },
            recordingRequired: true,
            identityVerification: true
          }
        })
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create proctoring session');
      }

      const sessionData = await sessionResponse.json();

      if (!sessionData.success) {
        throw new Error(sessionData.message || 'Session creation failed');
      }

      // Wait a moment for AI agents to deploy
      setTimeout(() => {
        onLogin({
          candidateId: candidateId.trim(),
          accessCode: accessCode.trim(),
          sessionId: sessionData.sessionId
        });
      }, 2000); // 2 second delay to allow AI agent deployment

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ayan.ai Proctoring</h1>
          <p className="text-gray-600">Financial Literacy Assessment</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="candidateId" className="block text-sm font-medium text-gray-700 mb-2">
                Candidate ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="candidateId"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your candidate ID"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-2">
                Access Code
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  id="accessCode"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter access code"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !candidateId.trim() || !accessCode.trim()}
              className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Session...
                </>
              ) : (
                'Start Proctored Exam'
              )}
            </button>
          </form>

          {/* Quick Test Accounts */}
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Test Accounts</h3>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCandidateId('student001@cs.university.edu');
                    setAccessCode('EXAM2024');
                  }}
                  className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">Clean Session</div>
                  <div className="text-xs text-gray-500">student001@cs.university.edu • No violations expected</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setCandidateId('student002@cs.university.edu');
                    setAccessCode('EXAM2024');
                  }}
                  className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">Minor Violations</div>
                  <div className="text-xs text-gray-500">student002@cs.university.edu • Background noise, brief focus loss</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCandidateId('student003@cs.university.edu');
                    setAccessCode('EXAM2024');
                  }}
                  className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">High-Risk Session</div>
                  <div className="text-xs text-gray-500">student003@cs.university.edu • Multiple violations, camera issues</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCandidateId('student101@eng.college.edu');
                    setAccessCode('MIDTERM2024');
                  }}
                  className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">Engineering College</div>
                  <div className="text-xs text-gray-500">student101@eng.college.edu • Multiple people detected</div>
                </button>
              </div>
            </div>

            {/* Manual Entry Instructions */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-700 mb-2">Manual Entry</h3>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• Use any email as Candidate ID</li>
                <li>• Access Codes: EXAM2024, MIDTERM2024, FINAL2024</li>
                <li>• AI monitoring: Vision, Audio, Behavior tracking</li>
                <li>• Session duration: 15 minutes</li>
              </ul>
            </div>
          </div>

          {/* AI Monitoring Notice */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">AI Proctoring Enabled</p>
                <p className="text-xs text-blue-600 mt-1">
                  This exam uses advanced AI monitoring for face detection, audio analysis, and behavioral patterns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Powered by Ayan.ai • Secure AI Proctoring Platform
          </p>
        </div>
      </div>
    </div>
  );
}