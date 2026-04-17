import { NextRequest, NextResponse } from 'next/server';

interface Session {
  sessionId: string;
  candidateId: string;
  examId: string;
  organizationId: string;
  organizationName: string;
  status: 'active' | 'completed' | 'terminated' | 'in-progress';
  credibilityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  violations: any[];
  duration: number;
  startedAt: string;
  endedAt?: string;
  lastSyncAt?: string;
  candidateName?: string;
  examName?: string;
  batchId?: string;
  createdAt: string;
  updatedAt: string;
}

// Mock organizations for reference
const organizations = {
  'system-admin-001': 'Ayan.ai System Administration',
  '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94': 'Computer Science Department - University',
  '123e4567-e89b-12d3-a456-426614174000': 'Engineering College Assessment Center',
  '987fcdeb-51a2-43d7-8f9e-123456789abc': 'Business School Testing Services'
};

// Generate mock session data with real-time variations
function generateMockSessions(organizationId?: string): Session[] {
  const now = Date.now();
  const timeVariation = Math.sin(now / 100000) * 0.3;
  
  const allSessions: Session[] = [
    // University sessions (CS Department)
    {
      sessionId: 'sess_univ_001',
      candidateId: 'student001',
      examId: 'exam_cs101_midterm',
      organizationId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94',
      organizationName: 'Computer Science Department - University',
      status: 'active', // Always keep some active for testing
      credibilityScore: Math.floor(88 + Math.random() * 7),
      riskLevel: Math.random() > 0.8 ? 'medium' : 'low',
      violations: Math.random() > 0.7 ? [
        { type: 'background_noise', timestamp: new Date(now - Math.random() * 300000).toISOString() }
      ] : [],
      duration: Math.floor(2400 + Math.random() * 1200),
      startedAt: new Date(now - (2400000 + Math.random() * 600000)).toISOString(),
      candidateName: 'John Smith (student001@cs.university.edu)',
      examName: 'Computer Science 101 - Midterm Examination',
      batchId: 'CS101_FALL2024_BATCH1',
      createdAt: new Date(now - (2400000 + Math.random() * 600000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 300000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 60000).toISOString()
    },
    {
      sessionId: 'sess_univ_002',
      candidateId: 'student002', 
      examId: 'exam_cs102_quiz',
      organizationId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94',
      organizationName: 'Computer Science Department - University',
      status: 'active',
      credibilityScore: Math.floor(65 + Math.random() * 15),
      riskLevel: 'high',
      violations: [
        { type: 'multiple_people', timestamp: new Date(now - Math.random() * 600000).toISOString() },
        { type: 'multiple_voices', timestamp: new Date(now - Math.random() * 400000).toISOString() },
        { type: 'face_not_visible', timestamp: new Date(now - Math.random() * 200000).toISOString() }
      ],
      duration: Math.floor(1800 + Math.random() * 900),
      startedAt: new Date(now - (1800000 + Math.random() * 900000)).toISOString(),
      candidateName: 'Jane Doe (student002@cs.university.edu)',
      examName: 'Data Structures Quiz',
      batchId: 'CS102_FALL2024_BATCH1',
      createdAt: new Date(now - (1800000 + Math.random() * 900000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 200000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 60000).toISOString()
    },
    {
      sessionId: 'sess_univ_003',
      candidateId: 'student003',
      examId: 'exam_math201_final',
      organizationId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94', 
      organizationName: 'Computer Science Department - University',
      status: Math.random() > 0.5 ? 'completed' : 'active',
      credibilityScore: Math.floor(75 + Math.random() * 20),
      riskLevel: Math.random() > 0.6 ? 'medium' : 'low',
      violations: Math.random() > 0.4 ? [
        { type: 'tab_focus_lost', timestamp: new Date(now - Math.random() * 800000).toISOString() },
        { type: 'fullscreen_exit', timestamp: new Date(now - Math.random() * 600000).toISOString() }
      ] : [],
      duration: Math.floor(7200 + Math.random() * 1800),
      startedAt: new Date(now - (7200000 + Math.random() * 1800000)).toISOString(),
      endedAt: Math.random() > 0.5 ? new Date(now - Math.random() * 600000).toISOString() : undefined,
      candidateName: 'Mike Johnson (student003@cs.university.edu)', 
      examName: 'Advanced Mathematics Final',
      batchId: 'MATH201_FALL2024_BATCH1',
      createdAt: new Date(now - (7200000 + Math.random() * 1800000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 600000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 300000).toISOString()
    },
    {
      sessionId: 'sess_univ_002',
      candidateId: 'candidate_002',
      examId: 'exam_math201',
      organizationId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94',
      organizationName: 'Computer Science Department - University',
      status: Math.random() > 0.6 ? 'completed' : 'in-progress',
      credibilityScore: Math.floor(85 + Math.random() * 10),
      riskLevel: Math.random() > 0.5 ? 'medium' : 'low',
      violations: Math.random() > 0.4 ? [
        { type: 'face_not_detected', timestamp: new Date(now - Math.random() * 600000).toISOString() }
      ] : [],
      duration: Math.floor(7200 + Math.random() * 1800),
      startedAt: new Date(now - (7200000 + Math.random() * 1800000)).toISOString(),
      endedAt: Math.random() > 0.4 ? new Date(now - Math.random() * 600000).toISOString() : undefined,
      candidateName: 'Jane Doe',
      examName: 'Advanced Mathematics',
      batchId: 'batch_math_fall2024',
      createdAt: new Date(now - (7200000 + Math.random() * 1800000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 600000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 300000).toISOString()
    },
    // Engineering College sessions
    {
      sessionId: 'sess_eng_001',
      candidateId: 'student101',
      examId: 'exam_physics301_lab',
      organizationId: '123e4567-e89b-12d3-a456-426614174000',
      organizationName: 'Engineering College Assessment Center',
      status: 'active',
      credibilityScore: Math.floor(85 + Math.random() * 10),
      riskLevel: 'low',
      violations: [],
      duration: Math.floor(3600 + Math.random() * 1800),
      startedAt: new Date(now - (3600000 + Math.random() * 1800000)).toISOString(),
      candidateName: 'Sarah Wilson (student101@eng.college.edu)',
      examName: 'Physics 301 - Laboratory Assessment',
      batchId: 'PHYS301_SPRING2024_LAB',
      createdAt: new Date(now - (3600000 + Math.random() * 1800000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 900000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 120000).toISOString()
    },
    {
      sessionId: 'sess_eng_002',
      candidateId: 'student102',
      examId: 'exam_chem201_midterm',
      organizationId: '123e4567-e89b-12d3-a456-426614174000',
      organizationName: 'Engineering College Assessment Center',
      status: 'active',
      credibilityScore: Math.floor(55 + Math.random() * 25),
      riskLevel: 'critical',
      violations: [
        { type: 'camera_blocked', timestamp: new Date(now - Math.random() * 300000).toISOString() },
        { type: 'multiple_people', timestamp: new Date(now - Math.random() * 600000).toISOString() },
        { type: 'background_noise', timestamp: new Date(now - Math.random() * 400000).toISOString() },
        { type: 'tab_focus_lost', timestamp: new Date(now - Math.random() * 200000).toISOString() }
      ],
      duration: Math.floor(2400 + Math.random() * 1200),
      startedAt: new Date(now - (2400000 + Math.random() * 1200000)).toISOString(),
      candidateName: 'Alex Rodriguez (student102@eng.college.edu)',
      examName: 'Chemistry 201 - Midterm Exam',
      batchId: 'CHEM201_SPRING2024_MID',
      createdAt: new Date(now - (2400000 + Math.random() * 1200000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 300000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 60000).toISOString()
    },
    // Business School sessions
    {
      sessionId: 'sess_biz_001',
      candidateId: 'student201',
      examId: 'exam_finance101_final',
      organizationId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
      organizationName: 'Business School Testing Services',
      status: Math.random() > 0.4 ? 'completed' : 'active',
      credibilityScore: Math.floor(90 + Math.random() * 8),
      riskLevel: 'low',
      violations: [],
      duration: Math.floor(5400 + Math.random() * 1800),
      startedAt: new Date(now - (5400000 + Math.random() * 1800000)).toISOString(),
      endedAt: Math.random() > 0.4 ? new Date(now - Math.random() * 300000).toISOString() : undefined,
      candidateName: 'Robert Chen (student201@business.school.edu)',
      examName: 'Finance Fundamentals - Final Exam',
      batchId: 'FIN101_WINTER2024_FINAL',
      createdAt: new Date(now - (5400000 + Math.random() * 1800000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 300000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 180000).toISOString()
    },
    {
      sessionId: 'sess_biz_002',
      candidateId: 'student202',
      examId: 'exam_marketing201_case',
      organizationId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
      organizationName: 'Business School Testing Services',
      status: Math.random() > 0.8 ? 'terminated' : 'active',
      credibilityScore: Math.floor(35 + Math.random() * 30),
      riskLevel: 'critical',
      violations: [
        { type: 'face_not_visible', timestamp: new Date(now - Math.random() * 900000).toISOString() },
        { type: 'multiple_people', timestamp: new Date(now - Math.random() * 1200000).toISOString() },
        { type: 'camera_blocked', timestamp: new Date(now - Math.random() * 800000).toISOString() },
        { type: 'tab_focus_lost', timestamp: new Date(now - Math.random() * 600000).toISOString() },
        { type: 'fullscreen_exit', timestamp: new Date(now - Math.random() * 1500000).toISOString() },
        { type: 'multiple_voices', timestamp: new Date(now - Math.random() * 700000).toISOString() }
      ].slice(0, Math.floor(Math.random() * 6) + 2),
      duration: Math.floor(1800 + Math.random() * 1200),
      startedAt: new Date(now - (1800000 + Math.random() * 1200000)).toISOString(),
      endedAt: Math.random() > 0.8 ? new Date(now - Math.random() * 900000).toISOString() : undefined,
      candidateName: 'Emma Davis (student202@business.school.edu)',
      examName: 'Marketing Strategy - Case Study Analysis',
      batchId: 'MKT201_WINTER2024_CASE',
      createdAt: new Date(now - (1800000 + Math.random() * 1200000)).toISOString(),
      updatedAt: new Date(now - Math.random() * 900000).toISOString(),
      lastSyncAt: new Date(now - Math.random() * 900000).toISOString()
    }
  ];

  // If it's super admin (system-admin-001), return all sessions
  if (organizationId === 'system-admin-001') {
    return allSessions;
  }

  // Otherwise, filter by organization
  if (organizationId) {
    return allSessions.filter(session => session.organizationId === organizationId);
  }

  return allSessions;
}

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

    // Get sessions based on organization
    let sessions = generateMockSessions(organizationId || undefined);

    // Apply filters
    if (status && status !== 'all') {
      sessions = sessions.filter(session => session.status === status);
    }

    if (examId) {
      sessions = sessions.filter(session => session.examId.includes(examId));
    }

    if (batchId) {
      sessions = sessions.filter(session => session.batchId?.includes(batchId));
    }

    if (candidateName) {
      sessions = sessions.filter(session => 
        session.candidateName?.toLowerCase().includes(candidateName.toLowerCase())
      );
    }

    console.log(`📊 Returning ${sessions.length} sessions for organization: ${organizationId || 'all'}`);

    return NextResponse.json({
      success: true,
      sessions,
      count: sessions.length,
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