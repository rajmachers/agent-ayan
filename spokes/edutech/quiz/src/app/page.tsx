'use client';

import { useState } from 'react';
import QuizInterface from '@/components/QuizInterface';
import LoginForm from '@/components/LoginForm';
import PreExamSetup from '@/components/PreExamSetup';

interface CandidateData {
  candidateId: string;
  accessCode: string;
  sessionId: string;
}

type AppState = 'login' | 'setup' | 'quiz';

export default function QuizPage() {
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [appState, setAppState] = useState<AppState>('login');
  const [setupData, setSetupData] = useState<any>(null);

  const handleLogin = (data: CandidateData) => {
    setCandidateData(data);
    setAppState('setup');
  };

  const handleSetupComplete = (data: any) => {
    setSetupData(data);
    setAppState('quiz');
  };

  const handleSetupCancel = () => {
    setCandidateData(null);
    setAppState('login');
  };

  const handleLogout = () => {
    setCandidateData(null);
    setSetupData(null);
    setAppState('login');
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {appState === 'login' && (
        <LoginForm onLogin={handleLogin} />
      )}
      
      {appState === 'setup' && candidateData && (
        <PreExamSetup 
          candidateData={candidateData}
          onSetupComplete={handleSetupComplete}
          onCancel={handleSetupCancel}
        />
      )}
      
      {appState === 'quiz' && candidateData && (
        <QuizInterface 
          candidateData={candidateData} 
          onLogout={handleLogout} 
        />
      )}
    </main>
  );
}