import { NextRequest, NextResponse } from 'next/server';
import { getSessionManager } from '../../../lib/session-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const examId = searchParams.get('examId');
    const batchId = searchParams.get('batchId');
    const candidateName = searchParams.get('candidateName');

    console.log('📡 Sessions API called with params:', {
      organizationId,
      status,
      examId,
      batchId,
      candidateName
    });

    const sessionManager = getSessionManager();
    let sessions = sessionManager.getAllSessions();
    
    // Filter by organization if specified (super admin sees all)
    if (organizationId && organizationId !== 'system-admin-001') {
      sessions = sessions.filter(session => session.organizationId === organizationId);
    }
    
    // Apply additional filters
    if (status && status !== 'all') {
      sessions = sessions.filter(session => session.status === status);
    }
    
    if (examId) {
      sessions = sessions.filter(session => session.examId.includes(examId));
    }
    
    if (candidateName) {
      sessions = sessions.filter(session => 
        session.candidateId.toLowerCase().includes(candidateName.toLowerCase())
      );
    }
    
    // Sort by start time, most recent first
    sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    // Convert to API format expected by frontend
    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      candidateId: session.candidateId,
      examId: session.examId,
      organizationId: session.organizationId,
      organizationName: getOrganizationName(session.organizationId),
      status: session.status,
      credibilityScore: session.credibilityScore,
      riskLevel: session.riskLevel,
      violations: session.violations,
      duration: session.completedAt ? 
        Math.floor((session.completedAt.getTime() - session.startedAt.getTime()) / 1000) :
        Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000),
      startedAt: session.startedAt.toISOString(),
      endedAt: session.completedAt?.toISOString(),
      candidateName: session.candidateId, // Use candidateId as name for now
      examName: session.examId,
      batchId: session.metadata?.batchId || 'default_batch',
      createdAt: session.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString()
    }));

    console.log(`📊 Returning ${formattedSessions.length} sessions for organization: ${organizationId || 'all'}`);

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      count: formattedSessions.length,
      filters: {
        organizationId,
        status,
        examId,
        batchId,
        candidateName
      }
    });

  } catch (error) {
    console.error('❌ Sessions API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to get organization names
function getOrganizationName(organizationId: string): string {
  const organizations: Record<string, string> = {
    'system-admin-001': 'Ayan.ai System Administration',
    '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94': 'Computer Science Department - University',
    '123e4567-e89b-12d3-a456-426614174000': 'Engineering College Assessment Center',
    '987fcdeb-51a2-43d7-8f9e-123456789abc': 'Business School Testing Services'
  };
  
  return organizations[organizationId] || 'Unknown Organization';
}