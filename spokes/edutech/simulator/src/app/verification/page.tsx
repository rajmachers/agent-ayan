'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSimulation } from '@/context/SimulationContext';
import { CheckCircle, AlertCircle, Camera, Mic, Monitor, Eye } from 'lucide-react';

export default function VerificationPage() {
  const { session } = useSimulation();
  const [systemChecks, setSystemChecks] = useState({
    camera: { status: 'checking', message: 'Checking camera...' },
    microphone: { status: 'checking', message: 'Checking microphone...' },
    screen: { status: 'checking', message: 'Checking screen capture...' },
    identity: { status: 'checking', message: 'Verifying identity...' },
  });

  useEffect(() => {
    // Simulate system checks
    const timer1 = setTimeout(() => {
      setSystemChecks(prev => ({
        ...prev,
        camera: { status: 'pass', message: 'Camera detected' },
      }));
    }, 800);

    const timer2 = setTimeout(() => {
      setSystemChecks(prev => ({
        ...prev,
        microphone: { status: 'pass', message: 'Microphone detected' },
      }));
    }, 1200);

    const timer3 = setTimeout(() => {
      setSystemChecks(prev => ({
        ...prev,
        screen: { status: 'pass', message: 'Screen capture enabled' },
      }));
    }, 1600);

    const timer4 = setTimeout(() => {
      setSystemChecks(prev => ({
        ...prev,
        identity: { status: 'pass', message: 'Identity verified' },
      }));
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const allChecksPassed = Object.values(systemChecks).every(check => check.status === 'pass');

  const getIcon = (type: string) => {
    const iconProps = { className: 'w-6 h-6' };
    switch (type) {
      case 'camera':
        return <Camera {...iconProps} />;
      case 'microphone':
        return <Mic {...iconProps} />;
      case 'screen':
        return <Monitor {...iconProps} />;
      case 'identity':
        return <Eye {...iconProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">System Verification</h1>
          <p className="text-slate-400">Preparing your proctoring environment</p>
        </div>

        {/* Session Info */}
        {session && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Session Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Organization:</span>
                <p className="text-white font-medium">{session.tenantName}</p>
              </div>
              <div>
                <span className="text-slate-400">Exam Type:</span>
                <p className="text-white font-medium">{session.examType}</p>
              </div>
              <div>
                <span className="text-slate-400">Batch:</span>
                <p className="text-white font-medium">{session.batchId}</p>
              </div>
              <div>
                <span className="text-slate-400">Candidates:</span>
                <p className="text-white font-medium">{session.candidates?.length || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* System Checks */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">System Checks</h2>
          <div className="space-y-4">
            {Object.entries(systemChecks).map(([key, check]) => (
              <div key={key} className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <div className="text-slate-400">{getIcon(key)}</div>
                <div className="flex-1">
                  <p className="text-white font-medium capitalize">{key}</p>
                  <p className="text-sm text-slate-400">{check.message}</p>
                </div>
                <div>
                  {check.status === 'checking' && (
                    <div className="animate-spin">
                      <div className="w-5 h-5 border-2 border-slate-600 border-t-cyan-400 rounded-full"></div>
                    </div>
                  )}
                  {check.status === 'pass' && (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                  {check.status === 'fail' && (
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href="/setup"
            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors text-center"
          >
            Back to Setup
          </Link>
          {allChecksPassed ? (
            <Link
              href="/exam-monitor"
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-center"
            >
              ✓ Start Exam
            </Link>
          ) : (
            <button
              disabled
              className="flex-1 px-6 py-3 bg-slate-600 text-slate-400 font-semibold rounded-lg cursor-not-allowed text-center"
            >
              Verifying...
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-slate-400">
          <p>Need help? Contact support@agenticproctor.com</p>
        </div>
      </div>
    </div>
  );
}
