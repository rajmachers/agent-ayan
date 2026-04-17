import { NextRequest, NextResponse } from 'next/server';
import { addSession, updateSession, getAllSessions, findSession } from './storage';

// Mock session data with different organizations
const mockSessions = [
  {
    sessionId: 'session_cs_001',
    candidateId: 'cs_student_001',
    candidateName: 'Alice Johnson',
    examId: 'financial-literacy-2026',
    examName: 'Financial Literacy Assessment 2026',
    organizationId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94', // CS Department
    status: 'completed',
    credibilityScore: 87,
    riskLevel: 'low',
    violations: [
      { type: 'tab_focus_lost', severity: 'warning', timestamp: new Date(Date.now() - 300000).toISOString() }
    ],
    startedAt: new Date(Date.now() - 900000).toISOString(),
    completedAt: new Date(Date.now() - 100000).toISOString(),
    duration: 800,
    score: 85,
    passed: true
  },
  {
    sessionId: 'session_eng_001', 
    candidateId: 'eng_student_001',
    candidateName: 'Bob Smith',
    examId: 'engineering-math-2026',
    examName: 'Engineering Mathematics Assessment 2026',
    organizationId: '123e4567-e89b-12d3-a456-426614174000', // Engineering College
    status: 'in-progress',
    credibilityScore: 92,
    riskLevel: 'low',
    violations: [],
    startedAt: new Date(Date.now() - 600000).toISOString(),
    duration: 600
  },
  {
    sessionId: 'session_biz_001',
    candidateId: 'biz_student_001', 
    candidateName: 'Carol Wilson',
    examId: 'business-ethics-2026',
    examName: 'Business Ethics Assessment 2026',
    organizationId: '987fcdeb-51a2-43d7-8f9e-123456789abc', // Business School
    status: 'active',
    credibilityScore: 95,
    riskLevel: 'low',
    violations: [
      { type: 'background_noise', severity: 'info', timestamp: new Date(Date.now() - 120000).toISOString() }
    ],
    startedAt: new Date(Date.now() - 400000).toISOString(),
    duration: 400
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const examId = searchParams.get('examId');
    const batchId = searchParams.get('batchId');
    const candidateName = searchParams.get('candidateName');

    // Update mock sessions with more metadata
    const enhancedMockSessions = mockSessions.map(session => ({
      ...session,
      lastSyncAt: new Date(Date.now() - Math.random() * 60000).toISOString(),
      batchId: session.organizationId.includes('554be') ? 'batch_fall_2026' : 
               session.organizationId.includes('123e') ? 'batch_winter_2026' : 'batch_spring_2027'
    }));

    let filteredSessions = [...enhancedMockSessions, ...getAllSessions()];

    // Remove duplicates based on sessionId
    let uniqueSessions = filteredSessions.filter((session, index, self) => 
      index === self.findIndex(s => s.sessionId === session.sessionId)
    );

    // Apply filters
    if (organizationId) {
      uniqueSessions = uniqueSessions.filter(
        session => session.organizationId === organizationId
      );
    }

    if (status) {
      uniqueSessions = uniqueSessions.filter(
        session => session.status === status
      );
    }

    if (examId) {
      uniqueSessions = uniqueSessions.filter(
        session => session.examId === examId
      );
    }

    if (batchId) {
      uniqueSessions = uniqueSessions.filter(
        session => session.batchId === batchId
      );
    }

    if (candidateName) {
      uniqueSessions = uniqueSessions.filter(
        session => session.candidateName?.toLowerCase().includes(candidateName.toLowerCase()) ||
                   session.candidateId?.toLowerCase().includes(candidateName.toLowerCase())
      );
    }

    return NextResponse.json({
      success: true,
      sessions: uniqueSessions,
      total: uniqueSessions.length,
      filters: {
        organization: organizationId,
        status: status,
        exam: examId,
        batch: batchId,
        candidate: candidateName
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await request.json();
    
    // Validate required fields
    const requiredFields = ['sessionId', 'candidateId', 'examId', 'organizationId'];
    for (const field of requiredFields) {
      if (!sessionData[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Check if session already exists (prevent duplicates)
    const existingSession = findSession(sessionData.sessionId);
    if (existingSession) {
      console.log(`⚠️  Session ${sessionData.sessionId} already exists, returning existing session`);
      return NextResponse.json({
        success: true,
        session: existingSession,
        message: 'Session already exists'
      });
    }

    const newSession = addSession({
      ...sessionData,
      createdAt: now,
      startedAt: sessionData.startedAt || now,
      lastSyncAt: now,
      status: sessionData.status || 'in-progress',
      credibilityScore: sessionData.credibilityScore || 100,
      riskLevel: sessionData.riskLevel || 'low',
      violations: sessionData.violations || [],
      duration: sessionData.duration || 0,
      batchId: sessionData.batchId || 'batch_fall_2026',
      candidateName: sessionData.candidateName || sessionData.candidateId
    });
    console.log(`✅ Created new session: ${newSession.sessionId} for candidate: ${newSession.candidateName}`);

    // Notify control plane about new session
    try {
      await fetch('http://localhost:4101/api/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key'
        },
        body: JSON.stringify({
          sessionId: newSession.sessionId,
          candidateId: newSession.candidateId,
          examId: newSession.examId,
          organizationId: newSession.organizationId,
          metadata: newSession
        })
      });
    } catch (controlPlaneError) {
      console.warn('Failed to notify control plane:', controlPlaneError);
    }

    return NextResponse.json({
      success: true,
      session: newSession
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const updateData = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Find and update session
    const updatedSession = updateSession(sessionId, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    
    if (!updatedSession) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Notify control plane about session update
    try {
      await fetch(`http://localhost:4101/api/v1/sessions/${sessionId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key'
        },
        body: JSON.stringify({
          action: updateData.status === 'completed' ? 'complete' : 'update',
          metadata: updatedSession
        })
      });
    } catch (controlPlaneError) {
      console.warn('Failed to notify control plane:', controlPlaneError);
    }

    return NextResponse.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}