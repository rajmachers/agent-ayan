import { NextRequest, NextResponse } from 'next/server';

/**
 * Fetch a session from the Control Plane API.
 */
async function fetchSessionFromControlPlane(sessionId: string): Promise<any> {
  try {
    const response = await fetch(`http://localhost:4101/api/v1/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-key',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Control Plane API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.error('❌ Error fetching from Control Plane:', error);
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID is required' }, { status: 400 });
    }

    console.log(`🔍 Fetching session detail from Control Plane for ID: ${sessionId}`);

    const session = await fetchSessionFromControlPlane(sessionId);

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // Calculate duration
    const startedAt = session.startedAt ? new Date(session.startedAt) : new Date();
    const endedAt = session.endedAt ? new Date(session.endedAt) : new Date();
    const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    // Sort violations reverse chronologically (newest first)
    const sortedViolations = (session.violations || [])
      .map((v: any, i: number) => ({
        id: v.id || `v-${i}`,
        type: v.type,
        severity: v.severity || 'warning',
        timestamp: v.timestamp,
        description: v.description,
        confidence: v.confidence || 85,
        resolved: false,
        source: v.source || 'browser-monitor',
        evidence: v.evidence || null
      }))
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        shortId: session.sessionId?.slice(0, 8) || '',
        candidateId: session.candidateId || `${session.candidates?.length || 0} candidates`,
        candidateName: session.tenantName || 'Multiple Candidates',
        examId: session.examType || 'exam',
        organizationId: session.tenantId || 'unknown',
        status: session.status || 'active',
        score: session.score || 0,
        credibilityScore: 100,
        riskLevel: 'low',
        violations: sortedViolations,
        duration,
        startedAt: startedAt.toISOString(),
        completedAt: session.endedAt || null,
        candidates: session.candidates || [],
        aiAgents: {
          vision:   { status: 'active', healthScore: 95 },
          audio:    { status: 'active', healthScore: 92 },
          behavior: { status: 'active', healthScore: 98 }
        }
      }
    });
  } catch (error) {
    console.error('❌ Session Detail API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session detail' },
      { status: 500 }
    );
  }
}