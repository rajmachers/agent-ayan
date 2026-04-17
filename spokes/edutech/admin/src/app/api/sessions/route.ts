import { NextRequest, NextResponse } from 'next/server';
import { getSessionManager } from '../../../../lib/session-manager';

export const dynamic = 'force-dynamic';

type GatewaySession = {
  sessionId: string;
  candidateId: string;
  examId: string;
  batchId?: string;
  candidateCount?: number;
  candidates?: Array<{ id?: string; email?: string; name?: string }>;
  orgId: string;
  status: string;
  startTime: string;
  endTime?: string;
  violations?: any[];
  score?: {
    current?: number;
    riskLevel?: string;
  };
};

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

    let sessions: any[] = [];

    // Prefer gateway-backed sessions so quiz/simulator-created sessions appear in admin.
    try {
      const gatewayBaseUrl = process.env.HUB_GATEWAY_INTERNAL_URL || 'http://hub-gateway:3000';
      const gatewayParams = new URLSearchParams();
      if (organizationId) {
        gatewayParams.set('organizationId', organizationId);
      }
      if (status && status !== 'all') {
        gatewayParams.set('status', status);
      }

      const gatewayUrl = `${gatewayBaseUrl}/api/v1/sessions${gatewayParams.toString() ? `?${gatewayParams.toString()}` : ''}`;
      const gatewayResponse = await fetch(gatewayUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key'
        },
        cache: 'no-store'
      });

      if (gatewayResponse.ok) {
        const gatewayData = await gatewayResponse.json();
        const gatewaySessions: GatewaySession[] = Array.isArray(gatewayData.sessions) ? gatewayData.sessions : [];

        sessions = gatewaySessions.flatMap((session) => {
          const startedAt = new Date(session.startTime);
          const completedAt = session.endTime ? new Date(session.endTime) : undefined;

          const baseSession = {
            sessionId: session.sessionId,
            candidateId: session.candidateId,
            examId: session.examId,
            organizationId: session.orgId,
            status: session.status,
            credibilityScore: Math.max(
              0,
              Math.min(1, Number(session.score?.credibilityIndex ?? (session.score?.current ?? 0) / 100))
            ),
            riskLevel: session.score?.riskLevel || 'low',
            violations: session.violations || [],
            violationCount: Array.isArray(session.violations) ? session.violations.length : 0,
            candidates: Array.isArray(session.candidates) ? session.candidates : [],
            candidateCount: session.candidateCount || (Array.isArray(session.candidates) ? session.candidates.length : 1),
            startedAt,
            completedAt,
            metadata: {
              batchId: session.batchId || 'default_batch'
            }
          };

          if (!Array.isArray(session.candidates) || session.candidates.length === 0) {
            return [baseSession];
          }

          return session.candidates.map((candidate, index) => ({
            ...baseSession,
            // Keep rows unique in admin table while preserving linkage to parent session.
            sessionId: `${session.sessionId}__c${index + 1}`,
            candidateId: candidate?.email || candidate?.name || candidate?.id || `${baseSession.candidateId}-${index + 1}`
          }));
        });
      }
    } catch (gatewayError) {
      console.warn('⚠️ Gateway sessions fetch failed, falling back to local session manager:', gatewayError);
    }

    // Fallback path for legacy in-memory sessions is disabled by default to avoid
    // mixing mock/local-only data with gateway-authoritative lifecycle timestamps.
    const enableLocalFallback = process.env.ENABLE_ADMIN_LOCAL_SESSION_FALLBACK === 'true';
    if (sessions.length === 0 && enableLocalFallback) {
      const sessionManager = getSessionManager();
      sessions = sessionManager.getAllSessions();
    }
    
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
      violationCount: session.violationCount ?? (Array.isArray(session.violations) ? session.violations.length : 0),
      duration: session.completedAt ? 
        Math.floor((session.completedAt.getTime() - session.startedAt.getTime()) / 1000) :
        Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000),
      startedAt: session.startedAt.toISOString(),
      endedAt: session.completedAt?.toISOString(),
      candidateName: session.candidateId, // Use candidateId as name for now
      examName: session.examId,
      batchId: session.metadata?.batchId || 'default_batch',
      candidates: session.candidates || [],
      candidateCount: session.candidateCount || (Array.isArray(session.candidates) ? session.candidates.length : 1),
      createdAt: session.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString()
    }));

    console.log(`📊 Returning ${formattedSessions.length} sessions for organization: ${organizationId || 'all'}`);

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      count: formattedSessions.length,
      source: sessions.length > 0 ? 'gateway' : (enableLocalFallback ? 'local-fallback' : 'gateway-empty'),
      filters: {
        organizationId,
        status,
        examId,
        batchId,
        candidateName
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
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