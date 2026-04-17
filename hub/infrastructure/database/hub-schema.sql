-- ═══════════════════════════════════════════════════════════════
-- AGENT-AYAN HUB — Core Database Schema
-- All spokes share these tables. Spoke-specific tables use their own prefix.
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- MULTI-TENANT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  spoke_id VARCHAR(50) NOT NULL DEFAULT 'edutech',
  keycloak_realm VARCHAR(100),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES hub_organizations(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('super-admin', 'tenant-admin', 'proctor', 'candidate')),
  display_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email, organization_id)
);

-- ═══════════════════════════════════════════════════════════════
-- SESSION MANAGEMENT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_exam_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  organization_id UUID REFERENCES hub_organizations(id),
  exam_mode VARCHAR(20) NOT NULL DEFAULT 'auto-proctor'
    CHECK (exam_mode IN ('auto-proctor', 'hybrid-proctor')),
  requires_human_approval BOOLEAN DEFAULT false,
  ai_complexity_threshold DECIMAL(3,2) DEFAULT 0.70,
  max_violations_before_pause INTEGER DEFAULT 10,
  max_violations_before_terminate INTEGER DEFAULT 25,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hub_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL,
  exam_id UUID NOT NULL,
  organization_id UUID REFERENCES hub_organizations(id),
  spoke_id VARCHAR(50) NOT NULL DEFAULT 'edutech',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'waiting-approval', 'active', 'paused', 'terminated', 'completed')),
  assigned_proctor_id UUID REFERENCES hub_users(id),
  violation_count INTEGER DEFAULT 0,
  cumulative_score DECIMAL(8,2) DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_status ON hub_sessions(status);
CREATE INDEX idx_sessions_spoke ON hub_sessions(spoke_id);
CREATE INDEX idx_sessions_org ON hub_sessions(organization_id);

-- ═══════════════════════════════════════════════════════════════
-- VIOLATIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence DECIMAL(3,2) NOT NULL,
  description TEXT,
  evidence JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_violations_session ON hub_violations(session_id);

-- ═══════════════════════════════════════════════════════════════
-- AI DECISIONS (Autonomous Agent)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id) ON DELETE CASCADE,
  complexity_score INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  reasoning TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_decisions_session ON hub_ai_decisions(session_id);

-- ═══════════════════════════════════════════════════════════════
-- HUMAN DECISIONS (Proctor)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_human_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id) ON DELETE CASCADE,
  proctor_id UUID REFERENCES hub_users(id),
  decision_type VARCHAR(50) NOT NULL
    CHECK (decision_type IN ('entry-gate', 'intervention', 'override', 'feedback')),
  decision VARCHAR(50) NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_human_decisions_session ON hub_human_decisions(session_id);

-- ═══════════════════════════════════════════════════════════════
-- GATEKEEPER (Hybrid Mode Entry)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_gatekeeper_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  exam_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  proctor_id UUID REFERENCES hub_users(id),
  evidence_payload JSONB DEFAULT '{}',
  decision_reason TEXT DEFAULT '',
  requested_at TIMESTAMP DEFAULT NOW(),
  decided_at TIMESTAMP
);

CREATE INDEX idx_gatekeeper_status ON hub_gatekeeper_queue(status);

-- ═══════════════════════════════════════════════════════════════
-- LEARNING ENGINE (Human-AI Feedback)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id) ON DELETE CASCADE,
  proctor_id UUID REFERENCES hub_users(id),
  ai_decision_id UUID REFERENCES hub_ai_decisions(id),
  human_override BOOLEAN NOT NULL DEFAULT false,
  correct_action VARCHAR(50),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- ANALYTICS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES hub_organizations(id),
  spoke_id VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_value DECIMAL(12,4),
  metadata JSONB DEFAULT '{}',
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_org_spoke ON hub_analytics(organization_id, spoke_id);

-- ═══════════════════════════════════════════════════════════════
-- LIVEKIT ROOMS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hub_livekit_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hub_sessions(id) ON DELETE CASCADE,
  room_name VARCHAR(255) NOT NULL UNIQUE,
  room_sid VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'active', 'closed')),
  num_participants INTEGER DEFAULT 0,
  recording_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

CREATE INDEX idx_livekit_rooms_session ON hub_livekit_rooms(session_id);
CREATE INDEX idx_livekit_rooms_status ON hub_livekit_rooms(status);

CREATE TABLE hub_livekit_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES hub_livekit_rooms(id) ON DELETE CASCADE,
  egress_id VARCHAR(255),
  storage_path VARCHAR(500),
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  status VARCHAR(30) NOT NULL DEFAULT 'recording'
    CHECK (status IN ('recording', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_recordings_room ON hub_livekit_recordings(room_id);
