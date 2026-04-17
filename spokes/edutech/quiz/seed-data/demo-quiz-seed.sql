-- Demo Quiz Seeding Script
-- Generated on 2026-04-05T18:13:38.107Z
-- 
-- This script sets up sample data for Ayan.ai proctoring system demo
-- Entity structure: Organisation → Exam → Batch → Delivery → Session

-- Clean up existing demo data (optional)
DELETE FROM sessions WHERE exam_id = 'fin_lit_2026';
DELETE FROM deliveries WHERE batch_id LIKE 'batch_%_2026' OR batch_id LIKE 'batch_%_2027';
DELETE FROM batches WHERE exam_id = 'fin_lit_2026';
DELETE FROM exams WHERE id = 'fin_lit_2026';
DELETE FROM organisations WHERE id = 'org_cs_dept_2026';

-- Insert organisation
INSERT INTO organisations (id, external_id, name, slug, logo_url, theme, default_rules_config, keycloak_realm, api_keys, created_at)
VALUES (
  'org_cs_dept_2026',
  'tao_cs_dept_001',
  'Computer Science Department',
  'cs-dept',
  'https://university.edu/assets/cs-dept-logo.png',
  '{"primary_color":"#1e40af","secondary_color":"#f59e0b","background_color":"#f8fafc","text_color":"#1f2937","font_family":"Inter, sans-serif","organization_name":"Computer Science Department - University","support_email":"exams@cs.university.edu","support_phone":"+1-555-CS-EXAMS","verification_messages":{"welcome":"Welcome to your Computer Science Department exam verification","camera_check":"Please ensure your camera is working properly for this CS exam","id_capture":"Please upload a clear photo of your University student ID","room_scan":"Show your exam environment as per CS Department guidelines","rules_title":"CS Department Examination Policies","completion":"Thank you. Your CS exam has been submitted successfully to the department."}}'::jsonb,
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '2026-04-05T18:13:38.105Z'
);

-- Insert exam
INSERT INTO exams (id, external_id, org_id, title, description, duration_min, instructions, exam_app_url, addons_config, metrics_config, rules_config, callback_url, created_by, created_at)
VALUES (
  'fin_lit_2026',
  'tao_exam_fin_lit_001',
  'org_cs_dept_2026',
  'Financial Literacy Challenge 2026',
  'Comprehensive assessment of financial concepts and principles for Computer Science students',
  15,
  'This quiz tests your understanding of basic financial concepts. You have 15 minutes to complete 10 questions. Each question is worth 10 points. A score of 70% or higher is required to pass.',
  'http://localhost:3001',
  '{"face_verify":true,"id_verify":true,"env_scan":true,"screen_record":true,"browser_lock":true}'::jsonb,
  '{"face_detection_weight":0.25,"browser_violation_weight":0.3,"audio_violation_weight":0.2,"motion_violation_weight":0.25}'::jsonb,
  '{"allow_calculator":false,"allow_notes":false,"allow_breaks":false,"max_violations":5}'::jsonb,
  NULL,
  'system',
  '2026-04-05T18:13:38.105Z'
);

-- Insert batches

INSERT INTO batches (id, external_id, exam_id, name, description, created_at)
VALUES (
  'batch_fall_2026',
  'tao_batch_fall_001',
  'fin_lit_2026',
  'Fall 2026 CS Cohort',
  'Financial literacy assessment for Fall 2026 Computer Science students',
  '2026-04-05T18:13:38.105Z'
);
INSERT INTO batches (id, external_id, exam_id, name, description, created_at)
VALUES (
  'batch_spring_2027',
  'tao_batch_spring_001',
  'fin_lit_2026',
  'Spring 2027 CS Cohort',
  'Financial literacy assessment for Spring 2027 Computer Science students',
  '2026-04-05T18:13:38.105Z'
);

-- Insert deliveries

INSERT INTO deliveries (id, external_id, batch_id, scheduled_at, end_at, status, candidate_ids, created_at)
VALUES (
  'delivery_001',
  'tao_delivery_001',
  'batch_fall_2026',
  '2026-04-06T18:13:38.105Z',
  '2026-04-06T18:13:38.105Z',
  'scheduled',
  '["candidate_001","candidate_002","candidate_003"]'::jsonb,
  '2026-04-05T18:13:38.105Z'
);
INSERT INTO deliveries (id, external_id, batch_id, scheduled_at, end_at, status, candidate_ids, created_at)
VALUES (
  'delivery_002',
  'tao_delivery_002',
  'batch_fall_2026',
  '2026-04-08T18:13:38.105Z',
  '2026-04-08T18:13:38.105Z',
  'scheduled',
  '["candidate_004","candidate_005"]'::jsonb,
  '2026-04-05T18:13:38.105Z'
);
INSERT INTO deliveries (id, external_id, batch_id, scheduled_at, end_at, status, candidate_ids, created_at)
VALUES (
  'delivery_003',
  'tao_delivery_003',
  'batch_spring_2027',
  '2026-04-12T18:13:38.105Z',
  '2026-04-12T18:13:38.105Z',
  'scheduled',
  '["candidate_006","candidate_007","candidate_008"]'::jsonb,
  '2026-04-05T18:13:38.105Z'
);

-- Insert sessions

INSERT INTO sessions (id, external_id, delivery_id, batch_id, exam_id, candidate_id, room_id, agent_id, status, credibility_score, risk_level, started_at, ended_at)
VALUES (
  'session_001',
  'tao_session_001',
  'delivery_001',
  'batch_fall_2026',
  'fin_lit_2026',
  'candidate_001',
  NULL,
  NULL,
  'created',
  NULL,
  NULL,
  NULL,
  NULL
);
INSERT INTO sessions (id, external_id, delivery_id, batch_id, exam_id, candidate_id, room_id, agent_id, status, credibility_score, risk_level, started_at, ended_at)
VALUES (
  'session_002',
  'tao_session_002',
  'delivery_001',
  'batch_fall_2026',
  'fin_lit_2026',
  'candidate_002',
  NULL,
  NULL,
  'created',
  NULL,
  NULL,
  NULL,
  NULL
);

-- Demo session URLs for testing
-- Use these URLs to start demo proctoring sessions:

-- Session 1: https://ayan.nunmai.local/session/session_001
-- Candidate: candidate_001 | Exam: Financial Literacy Challenge 2026 | Batch: Fall 2026 CS Cohort
-- Session 2: https://ayan.nunmai.local/session/session_002
-- Candidate: candidate_002 | Exam: Financial Literacy Challenge 2026 | Batch: Fall 2026 CS Cohort

-- Query to verify data
SELECT 
  o.name AS organisation,
  e.title AS exam,
  b.name AS batch,
  d.scheduled_at AS delivery_date,
  COUNT(s.id) AS session_count
FROM organisations o
JOIN exams e ON e.org_id = o.id
JOIN batches b ON b.exam_id = e.id  
JOIN deliveries d ON d.batch_id = b.id
LEFT JOIN sessions s ON s.delivery_id = d.id
WHERE o.id = 'org_cs_dept_2026'
GROUP BY o.name, e.title, b.name, d.scheduled_at
ORDER BY d.scheduled_at;
