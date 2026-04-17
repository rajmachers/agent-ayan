import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from './logger';

// Create connection pool
export const dbPool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.username,
  password: config.database.password,
  ssl: config.database.ssl,
  max: config.database.poolSize,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Connection event handlers
dbPool.on('connect', () => {
  logger.debug('Connected to PostgreSQL database');
});

dbPool.on('error', (err) => {
  logger.error('PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a database query with optional tenant isolation
 */
export async function executeQuery(
  text: string,
  params: any[] = [],
  orgId?: string
): Promise<{ rows: any[]; rowCount: number }> {
  const client: PoolClient = await dbPool.connect();
  
  try {
    // Set tenant context for RLS if orgId provided
    if (orgId) {
      await client.query('SELECT set_config(\'app.current_org_id\', $1, true)', [orgId]);
    }
    
    const result = await client.query(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } finally {
    client.release();
  }
}

/**
 * Get database health status
 */
export async function getDatabaseHealth(): Promise<{ healthy: boolean; latency?: number }> {
  const start = Date.now();
  
  try {
    await dbPool.query('SELECT 1');
    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return { healthy: false };
  }
}