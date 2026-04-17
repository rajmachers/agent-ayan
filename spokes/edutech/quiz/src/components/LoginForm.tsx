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
        organizationId = '123e4567-e89b-12d3-a456-426614174000'; // Engineering College
        examId = 'engineering-midterm-2024';
      } else if (candidateId.includes('@business.school.edu')) {
        organizationId = '987fcdeb-51a2-43d7-8f9e-123456789abc'; // Business School
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

          <div className="mt-6 space-y-4">
            {/* Manual Entry Instructions */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-700 mb-2">Login Instructions</h3>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• Use simulated candidate credentials generated from the Simulator app</li>
                <li>• Candidate ID should be a valid tenant email (for example: user@cs.university.edu)</li>
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