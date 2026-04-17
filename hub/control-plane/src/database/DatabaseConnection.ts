import { Pool, Client, QueryResult } from 'pg';
import { Logger } from '../utils/Logger';

export class DatabaseConnection {
  private pool: Pool;
  private logger = Logger.getInstance();

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '12541'),
      database: process.env.DB_NAME || 'phase7_proctoring',
      user: process.env.DB_USER || 'phase7_user',
      password: process.env.DB_PASSWORD || 'phase7_password',
      max: 20, // Maximum pool connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('PostgreSQL pool error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      // Initialize database schema
      await this.initializeSchema();

      this.logger.info('✅ P7 Control Plane connected to PostgreSQL (port 12541)');
    } catch (error) {
      this.logger.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      this.logger.error('Database query error:', { query: text, params, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info('📊 PostgreSQL pool closed');
    } catch (error) {
      this.logger.error('Error closing PostgreSQL pool:', error);
    }
  }

  private async initializeSchema(): Promise<void> {
    try {
      // Create p7_sessions table
      await this.query(`
        CREATE TABLE IF NOT EXISTS p7_sessions (
          session_id VARCHAR(36) PRIMARY KEY,
          candidate_id VARCHAR(36) NOT NULL,
          exam_id VARCHAR(36) NOT NULL,
          tenant_id VARCHAR(36) NOT NULL,
          proctoring_model VARCHAR(20) CHECK (proctoring_model IN ('basic', 'advanced')) DEFAULT 'basic',
          proctor_ratio INTEGER DEFAULT 15,
          status VARCHAR(30) CHECK (status IN (
            'PENDING', 'PENDING_APPROVAL', 'WAITING_ROOM', 
            'AI_SCANNING', 'APPROVED', 'IN_PROGRESS', 
            'REJECTED', 'COMPLETED'
          )) DEFAULT 'PENDING',
          assigned_proctor_id VARCHAR(36),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          approved_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create p7_proctors table
      await this.query(`
        CREATE TABLE IF NOT EXISTS p7_proctors (
          proctor_id VARCHAR(36) PRIMARY KEY,
          tenant_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(50),
          credentials TEXT NOT NULL,
          status VARCHAR(20) CHECK (status IN ('ACTIVE', 'BUSY', 'OFFLINE', 'SUSPENDED')) DEFAULT 'OFFLINE',
          current_load INTEGER DEFAULT 0,
          max_capacity INTEGER DEFAULT 15,
          assigned_sessions TEXT[] DEFAULT '{}',
          efficiency JSONB DEFAULT '{"avgApprovalTime": 0, "throughput": 0, "accuracy": 0, "rank": "REGULAR"}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_active_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create p7_model_switches table for audit trail
      await this.query(`
        CREATE TABLE IF NOT EXISTS p7_model_switches (
          switch_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(36) NOT NULL,
          old_model VARCHAR(20),
          new_model VARCHAR(20),
          requested_by VARCHAR(255) NOT NULL,
          reason TEXT,
          affected_sessions INTEGER DEFAULT 0,
          switched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes for performance
      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_tenant_status 
        ON p7_sessions(tenant_id, status);
      `);

      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_proctor 
        ON p7_sessions(assigned_proctor_id);
      `);

      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_proctors_tenant_status 
        ON p7_proctors(tenant_id, status);
      `);

      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_proctors_load 
        ON p7_proctors(current_load, max_capacity);
      `);

      // Create update triggers
      await this.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await this.query(`
        DROP TRIGGER IF EXISTS update_sessions_updated_at ON p7_sessions;
        CREATE TRIGGER update_sessions_updated_at 
          BEFORE UPDATE ON p7_sessions 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);

      await this.query(`
        DROP TRIGGER IF EXISTS update_proctors_updated_at ON p7_proctors;
        CREATE TRIGGER update_proctors_updated_at 
          BEFORE UPDATE ON p7_proctors 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);

      this.logger.info('✅ P7 Control Plane database schema initialized');

    } catch (error) {
      this.logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; timestamp: Date; latency: number }> {
    const start = Date.now();
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      return {
        status: 'healthy',
        timestamp: new Date(),
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        latency: Date.now() - start
      };
    }
  }
}