import { NextRequest, NextResponse } from 'next/server';
import { findSession, updateSession, getAllSessions } from '../storage';

// Mock sessions for demo purposes
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
      { type: 'background_noise', severity: 'info', timestamp: new Date(Date.now() - 50000).toISOString() }
    ],
    startedAt: new Date(Date.now() - 400000).toISOString(),
    duration: 400
  }
];

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required'
      }, { status: 400 });
    }
    
    console.log(`🔍 Looking for session: ${sessionId}`);
    
    // Try to find session in real sessions first
    let session = findSession(sessionId);
    
    // If not found in real sessions, check mock sessions
    if (!session) {
      session = mockSessions.find(s => s.sessionId === sessionId);
    }
    
    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`);
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }
    
    console.log(`✅ Session found: ${sessionId}`);
    
    return NextResponse.json({
      success: true,
      session
    });
    
  } catch (error) {
    console.error('❌ Error fetching session:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const body = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required'
      }, { status: 400 });
    }
    
    console.log(`🔄 Updating session: ${sessionId}`, body);
    
    // Try to update real session first
    let updatedSession = updateSession(sessionId, body);
    
    // If not found in real sessions, update mock session
    if (!updatedSession) {
      const mockSessionIndex = mockSessions.findIndex(s => s.sessionId === sessionId);
      if (mockSessionIndex === -1) {
        return NextResponse.json({
          success: false,
          error: 'Session not found'
        }, { status: 404 });
      }
      
      mockSessions[mockSessionIndex] = {
        ...mockSessions[mockSessionIndex],
        ...body,
        updatedAt: new Date().toISOString()
      };
      updatedSession = mockSessions[mockSessionIndex];
    }
    
    console.log(`✅ Session updated: ${sessionId}`);
    
    return NextResponse.json({
      success: true,
      session: updatedSession
    });
    
  } catch (error) {
    console.error('❌ Error updating session:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}