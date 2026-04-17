import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const sessionData = await request.json();
    
    // Validate required fields
    const { candidateId, examId, organizationId, examConfig } = sessionData;
    
    if (!candidateId || !examId || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call Control Plane P6 from server-side (avoids CORS)
    const controlPlaneResponse = await fetch('http://localhost:4101/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'demo-key'
      },
      body: JSON.stringify({
        candidateId,
        examId,
        organizationId,
        examConfig
      })
    });

    if (!controlPlaneResponse.ok) {
      const errorText = await controlPlaneResponse.text();
      console.error('Control Plane P6 error:', controlPlaneResponse.status, errorText);
      return NextResponse.json(
        { success: false, message: 'Failed to create proctoring session' },
        { status: 500 }
      );
    }

    const controlPlaneData = await controlPlaneResponse.json();

    // Return the session data to the client
    return NextResponse.json(controlPlaneData);

  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}