-- ═══════════════════════════════════════════════════════════════
-- EDUTECH SPOKE — Spoke-Specific Tables
-- These are education/proctoring-specific tables.
-- Hub tables (hub_*) are shared across all spokes.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE edu_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES hub_organizations(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_questions INTEGER DEFAULT 0,
  passing_score DECIMAL(5,2),
  exam_mode VARCHAR(20) NOT NULL DEFAULT 'auto-proctor'
    CHECK (exam_mode IN ('auto-proctor', 'hybrid-proctor')),
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE edu_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES edu_exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(30) NOT NULL DEFAULT 'multiple-choice'
    CHECK (question_type IN ('multiple-choice', 'true-false', 'short-answer', 'essay')),
  options JSONB DEFAULT '[]',
  correct_answer TEXT,
  points DECIMAL(5,2) DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE edu_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES hub_users(id),
  organization_id UUID REFERENCES hub_organizations(id),
  student_id VARCHAR(100),
  department VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE edu_exam_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES edu_exams(id) ON DELETE CASCADE,
  -- Also register in hub_exam_configurations for hub-level mode resolution
  webcam_required BOOLEAN DEFAULT true,
  microphone_required BOOLEAN DEFAULT true,
  screen_share_required BOOLEAN DEFAULT false,
  id_verification_required BOOLEAN DEFAULT false,
  allowed_resources TEXT[] DEFAULT '{}',
  custom_violation_rules JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE edu_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id),
  exam_id UUID REFERENCES edu_exams(id),
  candidate_id UUID REFERENCES edu_candidates(id),
  score DECIMAL(5,2),
  total_possible DECIMAL(5,2),
  percentage DECIMAL(5,2),
  passed BOOLEAN,
  answers JSONB DEFAULT '{}',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_edu_results_exam ON edu_results(exam_id);
CREATE INDEX idx_edu_results_candidate ON edu_results(candidate_id);
