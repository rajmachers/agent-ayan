/**
 * Database service for PostgreSQL with TimescaleDB integration
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { config } from '../config';

export class DatabaseService {
  private pool: Pool | null = null;
  private isInitialized = false;

  constructor() {
    // Initialize will be called explicitly
  }

  async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();

      this.isInitialized = true;
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      // Create extensions if they don't exist
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE');

      // Create recordings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS recordings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id VARCHAR(255) UNIQUE NOT NULL,
          participant_id VARCHAR(255) NOT NULL,
          tenant_id VARCHAR(255) NOT NULL,
          file_path VARCHAR(1000) NOT NULL,
          file_size BIGINT,
          duration_seconds NUMERIC,
          format VARCHAR(50),
          resolution VARCHAR(50),
          status VARCHAR(50) DEFAULT 'uploaded',
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create violations table with TimescaleDB
      await client.query(`
        CREATE TABLE IF NOT EXISTS violations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id VARCHAR(255) NOT NULL,
          participant_id VARCHAR(255) NOT NULL,
          violation_code VARCHAR(10) NOT NULL,
          violation_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          confidence NUMERIC(3,2) NOT NULL,
          description TEXT,
          timestamp_ms BIGINT NOT NULL,
          duration_ms INTEGER,
          ai_service VARCHAR(50),
          evidence_urls TEXT[],
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Convert violations table to hypertable for time-series optimization
      await client.query(`
        SELECT create_hypertable('violations', 'created_at', if_not_exists => TRUE);
      `);

      // Create analysis jobs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS analysis_jobs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id VARCHAR(255) NOT NULL,
          job_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          error_message TEXT,
          result JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create audit reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id VARCHAR(255) NOT NULL,
          report_type VARCHAR(50) NOT NULL,
          format VARCHAR(20) NOT NULL,
          file_path VARCHAR(1000),
          file_size BIGINT,
          violation_count INTEGER DEFAULT 0,
          confidence_score NUMERIC(3,2),
          status VARCHAR(50) DEFAULT 'generated',
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
        CREATE INDEX IF NOT EXISTS idx_recordings_tenant_id ON recordings(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_violations_session_id ON violations(session_id);
        CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp_ms);
        CREATE INDEX IF NOT EXISTS idx_violations_participant_id ON violations(participant_id);
        CREATE INDEX IF NOT EXISTS idx_analysis_jobs_session_id ON analysis_jobs(session_id);
        CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_audit_reports_session_id ON audit_reports(session_id);
      `);

      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Error running database migrations:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isInitialized = false;
      logger.info('Database service closed');
    }
  }

  get isReady(): boolean {
    return this.isInitialized && this.pool !== null;
  }
}