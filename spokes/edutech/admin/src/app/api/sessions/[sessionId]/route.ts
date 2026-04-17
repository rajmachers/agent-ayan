import { NextRequest, NextResponse } from 'next/server';

type GatewaySession = {
  sessionId: string;
  candidateId: string;
  examId: string;
  batchId?: string;
  candidates?: Array<{ id?: string; email?: string; name?: string; score?: number; violations?: any[] }>;
  orgId: string;
  status: string;
  startTime: string;
  endTime?: string;
  violations?: any[];
  score?: {
    current?: number;
    credibilityIndex?: number;
    riskLevel?: string;
  };
};

function parseRowSessionId(rawSessionId: string): { baseSessionId: string; candidateIndex: number | null } {
  const marker = '__c';
  const markerIdx = rawSessionId.lastIndexOf(marker);
  if (markerIdx === -1) {
    return { baseSessionId: rawSessionId, candidateIndex: null };
  }

  const baseSessionId = rawSessionId.slice(0, markerIdx);
  const suffix = rawSessionId.slice(markerIdx + marker.length);
  const candidateIndex = Number.parseInt(suffix, 10) - 1;

  if (Number.isNaN(candidateIndex) || candidateIndex < 0) {
    return { baseSessionId: rawSessionId, candidateIndex: null };
  }

  return { baseSessionId, candidateIndex };
}

async function fetchSessionFromGateway(sessionId: string): Promise<GatewaySession | null> {
  const gatewayBaseUrl = process.env.HUB_GATEWAY_INTERNAL_URL || 'http://hub-gateway:3000';
  const response = await fetch(`${gatewayBaseUrl}/api/v1/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'demo-key',
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Gateway API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.session || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const requestedSessionId = params.sessionId;
    if (!requestedSessionId) {
      return NextResponse.json({ success: false, error: 'Session ID is required' }, { status: 400 });
    }

    const { baseSessionId, candidateIndex } = parseRowSessionId(requestedSessionId);
    const session = await fetchSessionFromGateway(baseSessionId);

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const candidate =
      candidateIndex !== null && Array.isArray(session.candidates)
        ? session.candidates[candidateIndex]
        : null;

    const startedAt = new Date(session.startTime);
    const endedAt = session.endTime ? new Date(session.endTime) : null;
    const duration = Math.floor(((endedAt || new Date()).getTime() - startedAt.getTime()) / 1000);

    const sessionViolations = Array.isArray(session.violations) ? session.violations : [];
    const candidateViolations = Array.isArray(candidate?.violations) ? candidate!.violations : [];
    const mergedViolations = [...sessionViolations, ...candidateViolations];

    const credibilityIndex = Math.max(
      0,
      Math.min(1, Number(session.score?.credibilityIndex ?? (session.score?.current ?? 95) / 100))
    );

    return NextResponse.json({
      success: true,
      session: {
        sessionId: requestedSessionId,
        baseSessionId,
        shortId: baseSessionId.slice(-8),
        candidateId: candidate?.email || candidate?.name || session.candidateId,
        examId: session.examId,
        organizationId: session.orgId,
        status: session.status,
        score: {
          current: Number(session.score?.current ?? Math.round(credibilityIndex * 100)),
          credibilityIndex,
          riskLevel: session.score?.riskLevel || 'low',
        },
        credibilityScore: credibilityIndex,
        riskLevel: session.score?.riskLevel || 'low',
        violations: mergedViolations,
        duration,
        startedAt: startedAt.toISOString(),
        completedAt: endedAt?.toISOString(),
        candidates: session.candidates || [],
        aiAgents: {
          vision: { status: 'active', healthScore: 95 },
          audio: { status: 'active', healthScore: 92 },
          behavior: { status: 'active', healthScore: 88 },
        },
      },
    });
  } catch (error) {
    console.error('❌ Session Detail API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session detail' },
      { status: 500 }
    );
  }
}
