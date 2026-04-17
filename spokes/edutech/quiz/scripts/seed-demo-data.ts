#!/usr/bin/env node

/**
 * Demo Quiz Seeding Script
 * Creates sample data for Ayan.ai proctoring system integration demo
 * 
 * Entity Structure:
 * Organisation → Exam → Batch → Delivery → Session
 * 
 * This script generates:
 * - Sample organization (Computer Science Department)
 * - Financial Literacy Exam definition
 * - Multiple batches (Fall 2026, Spring 2027)
 * - Scheduled deliveries with date ranges
 * - Sample candidate sessions
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Organisation {
  id: string;
  external_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
    font_family: string;
    organization_name: string;
    support_email: string;
    support_phone: string;
    verification_messages: {
      welcome: string;
      camera_check: string;
      id_capture: string;
      room_scan: string;
      rules_title: string;
      completion: string;
    };
  };
  created_at: string;
}

interface Exam {
  id: string;
  external_id: string;
  org_id: string;
  title: string;
  description: string;
  duration_min: number;
  instructions: string;
  exam_app_url: string;
  addons_config: {
    face_verify: boolean;
    id_verify: boolean;
    env_scan: boolean;
    screen_record: boolean;
    browser_lock: boolean;
  };
  metrics_config: {
    face_detection_weight: number;
    browser_violation_weight: number;
    audio_violation_weight: number;
    motion_violation_weight: number;
  };
  rules_config: {
    allow_calculator: boolean;
    allow_notes: boolean;
    allow_breaks: boolean;
    max_violations: number;
  };
  callback_url: string | null;
  created_at: string;
}

interface Batch {
  id: string;
  external_id: string;
  exam_id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Delivery {
  id: string;
  external_id: string;
  batch_id: string;
  scheduled_at: string;
  end_at: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  candidate_ids: string[];
  created_at: string;
}

interface Session {
  id: string;
  external_id: string;
  delivery_id: string;
  batch_id: string;
  exam_id: string;
  candidate_id: string;
  room_id: string | null;
  agent_id: string | null;
  status: 'created' | 'active' | 'completed' | 'interrupted';
  credibility_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  started_at: string | null;
  ended_at: string | null;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function createSampleData() {
  const now = new Date().toISOString();
  
  // Create organization
  const org: Organisation = {
    id: 'org_cs_dept_2026',
    external_id: 'tao_cs_dept_001',
    name: 'Computer Science Department',
    slug: 'cs-dept',
    logo_url: 'https://university.edu/assets/cs-dept-logo.png',
    theme: {
      primary_color: '#1e40af',
      secondary_color: '#f59e0b',
      background_color: '#f8fafc',
      text_color: '#1f2937',
      font_family: 'Inter, sans-serif',
      organization_name: 'Computer Science Department - University',
      support_email: 'exams@cs.university.edu',
      support_phone: '+1-555-CS-EXAMS',
      verification_messages: {
        welcome: 'Welcome to your Computer Science Department exam verification',
        camera_check: 'Please ensure your camera is working properly for this CS exam',
        id_capture: 'Please upload a clear photo of your University student ID',
        room_scan: 'Show your exam environment as per CS Department guidelines',
        rules_title: 'CS Department Examination Policies',
        completion: 'Thank you. Your CS exam has been submitted successfully to the department.'
      }
    },
    created_at: now
  };

  // Create financial literacy exam
  const exam: Exam = {
    id: 'fin_lit_2026',
    external_id: 'tao_exam_fin_lit_001',
    org_id: org.id,
    title: 'Financial Literacy Challenge 2026',
    description: 'Comprehensive assessment of financial concepts and principles for Computer Science students',
    duration_min: 15,
    instructions: 'This quiz tests your understanding of basic financial concepts. You have 15 minutes to complete 10 questions. Each question is worth 10 points. A score of 70% or higher is required to pass.',
    exam_app_url: 'http://localhost:3001', // Demo quiz app
    addons_config: {
      face_verify: true,
      id_verify: true,
      env_scan: true,
      screen_record: true,
      browser_lock: true
    },
    metrics_config: {
      face_detection_weight: 0.25,
      browser_violation_weight: 0.30,
      audio_violation_weight: 0.20,
      motion_violation_weight: 0.25
    },
    rules_config: {
      allow_calculator: false,
      allow_notes: false,
      allow_breaks: false,
      max_violations: 5
    },
    callback_url: null,
    created_at: now
  };

  // Create batches
  const batches: Batch[] = [
    {
      id: 'batch_fall_2026',
      external_id: 'tao_batch_fall_001',
      exam_id: exam.id,
      name: 'Fall 2026 CS Cohort',
      description: 'Financial literacy assessment for Fall 2026 Computer Science students',
      created_at: now
    },
    {
      id: 'batch_spring_2027',
      external_id: 'tao_batch_spring_001', 
      exam_id: exam.id,
      name: 'Spring 2027 CS Cohort',
      description: 'Financial literacy assessment for Spring 2027 Computer Science students',
      created_at: now
    }
  ];

  // Create deliveries with realistic scheduling
  const today = new Date();
  const deliveries: Delivery[] = [
    {
      id: 'delivery_001',
      external_id: 'tao_delivery_001',
      batch_id: batches[0].id,
      scheduled_at: addDays(today, 1).toISOString(), // Tomorrow
      end_at: addDays(today, 1).toISOString(),
      status: 'scheduled',
      candidate_ids: ['candidate_001', 'candidate_002', 'candidate_003'],
      created_at: now
    },
    {
      id: 'delivery_002',
      external_id: 'tao_delivery_002',
      batch_id: batches[0].id,
      scheduled_at: addDays(today, 3).toISOString(), // In 3 days
      end_at: addDays(today, 3).toISOString(),
      status: 'scheduled',
      candidate_ids: ['candidate_004', 'candidate_005'],
      created_at: now
    },
    {
      id: 'delivery_003',
      external_id: 'tao_delivery_003',
      batch_id: batches[1].id,
      scheduled_at: addDays(today, 7).toISOString(), // Next week
      end_at: addDays(today, 7).toISOString(),
      status: 'scheduled',
      candidate_ids: ['candidate_006', 'candidate_007', 'candidate_008'],
      created_at: now
    }
  ];

  // Create sample sessions
  const sessions: Session[] = [
    {
      id: 'session_001',
      external_id: 'tao_session_001',
      delivery_id: deliveries[0].id,
      batch_id: batches[0].id,
      exam_id: exam.id,
      candidate_id: 'candidate_001',
      room_id: null,
      agent_id: null,
      status: 'created',
      credibility_score: null,
      risk_level: null,
      started_at: null,
      ended_at: null
    },
    {
      id: 'session_002', 
      external_id: 'tao_session_002',
      delivery_id: deliveries[0].id,
      batch_id: batches[0].id,
      exam_id: exam.id,
      candidate_id: 'candidate_002',
      room_id: null,
      agent_id: null,
      status: 'created',
      credibility_score: null,
      risk_level: null,
      started_at: null,
      ended_at: null
    }
  ];

  return {
    organisation: org,
    exam,
    batches,
    deliveries,
    sessions
  };
}

function generateSQL(data: ReturnType<typeof createSampleData>): string {
  const { organisation, exam, batches, deliveries, sessions } = data;
  
  return `-- Demo Quiz Seeding Script
-- Generated on ${new Date().toISOString()}
-- 
-- This script sets up sample data for Ayan.ai proctoring system demo
-- Entity structure: Organisation → Exam → Batch → Delivery → Session

-- Clean up existing demo data (optional)
DELETE FROM sessions WHERE exam_id = '${exam.id}';
DELETE FROM deliveries WHERE batch_id LIKE 'batch_%_2026' OR batch_id LIKE 'batch_%_2027';
DELETE FROM batches WHERE exam_id = '${exam.id}';
DELETE FROM exams WHERE id = '${exam.id}';
DELETE FROM organisations WHERE id = '${organisation.id}';

-- Insert organisation
INSERT INTO organisations (id, external_id, name, slug, logo_url, theme, default_rules_config, keycloak_realm, api_keys, created_at)
VALUES (
  '${organisation.id}',
  '${organisation.external_id}',
  '${organisation.name}',
  '${organisation.slug}',
  ${organisation.logo_url ? `'${organisation.logo_url}'` : 'NULL'},
  '${JSON.stringify(organisation.theme)}'::jsonb,
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '${organisation.created_at}'
);

-- Insert exam
INSERT INTO exams (id, external_id, org_id, title, description, duration_min, instructions, exam_app_url, addons_config, metrics_config, rules_config, callback_url, created_by, created_at)
VALUES (
  '${exam.id}',
  '${exam.external_id}',
  '${exam.org_id}',
  '${exam.title}',
  '${exam.description}',
  ${exam.duration_min},
  '${exam.instructions}',
  '${exam.exam_app_url}',
  '${JSON.stringify(exam.addons_config)}'::jsonb,
  '${JSON.stringify(exam.metrics_config)}'::jsonb,
  '${JSON.stringify(exam.rules_config)}'::jsonb,
  ${exam.callback_url ? `'${exam.callback_url}'` : 'NULL'},
  'system',
  '${exam.created_at}'
);

-- Insert batches
${batches.map(batch => `
INSERT INTO batches (id, external_id, exam_id, name, description, created_at)
VALUES (
  '${batch.id}',
  '${batch.external_id}',
  '${batch.exam_id}',
  '${batch.name}',
  '${batch.description}',
  '${batch.created_at}'
);`).join('')}

-- Insert deliveries
${deliveries.map(delivery => `
INSERT INTO deliveries (id, external_id, batch_id, scheduled_at, end_at, status, candidate_ids, created_at)
VALUES (
  '${delivery.id}',
  '${delivery.external_id}',
  '${delivery.batch_id}',
  '${delivery.scheduled_at}',
  '${delivery.end_at}',
  '${delivery.status}',
  '${JSON.stringify(delivery.candidate_ids)}'::jsonb,
  '${delivery.created_at}'
);`).join('')}

-- Insert sessions
${sessions.map(session => `
INSERT INTO sessions (id, external_id, delivery_id, batch_id, exam_id, candidate_id, room_id, agent_id, status, credibility_score, risk_level, started_at, ended_at)
VALUES (
  '${session.id}',
  '${session.external_id}',
  '${session.delivery_id}',
  '${session.batch_id}',
  '${session.exam_id}',
  '${session.candidate_id}',
  ${session.room_id ? `'${session.room_id}'` : 'NULL'},
  ${session.agent_id ? `'${session.agent_id}'` : 'NULL'},
  '${session.status}',
  ${session.credibility_score || 'NULL'},
  ${session.risk_level ? `'${session.risk_level}'` : 'NULL'},
  ${session.started_at ? `'${session.started_at}'` : 'NULL'},
  ${session.ended_at ? `'${session.ended_at}'` : 'NULL'}
);`).join('')}

-- Demo session URLs for testing
-- Use these URLs to start demo proctoring sessions:
${sessions.map((session, index) => `
-- Session ${index + 1}: https://ayan.nunmai.local/session/${session.id}
-- Candidate: ${session.candidate_id} | Exam: ${exam.title} | Batch: ${batches.find(b => b.id === session.batch_id)?.name}`).join('')}

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
WHERE o.id = '${organisation.id}'
GROUP BY o.name, e.title, b.name, d.scheduled_at
ORDER BY d.scheduled_at;
`;
}

function main() {
  console.log('🎯 Generating demo quiz seeding data...');
  
  // Generate sample data
  const data = createSampleData();
  
  // Create output directory
  const outputDir = join(__dirname, '..', 'seed-data');
  mkdirSync(outputDir, { recursive: true });
  
  // Generate SQL script
  const sql = generateSQL(data);
  const sqlPath = join(outputDir, 'demo-quiz-seed.sql');
  writeFileSync(sqlPath, sql, 'utf8');
  
  // Generate JSON data for reference
  const jsonPath = join(outputDir, 'demo-data.json');
  writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  
  console.log('✅ Demo seeding data generated:');
  console.log(`📄 SQL Script: ${sqlPath}`);
  console.log(`📋 JSON Data: ${jsonPath}`);
  console.log('');
  console.log('🚀 To use:');
  console.log('1. Run the SQL script against your PostgreSQL database');
  console.log('2. Start the demo quiz app: npm run dev');
  console.log('3. Start the main Ayan.ai system');
  console.log('4. Create a proctoring session using one of the generated session IDs');
  console.log('');
  console.log('Demo URLs will be available at:');
  console.log('- Quiz App: http://localhost:3001');
  console.log('- Proctoring: https://ayan.nunmai.local/session/<session_id>');
}

if (require.main === module) {
  main();
}