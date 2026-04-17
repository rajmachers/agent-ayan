import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from './logger';

// Create PostgreSQL connection pool
export const dbPool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Pool event handlers
dbPool.on('connect', (client: PoolClient) => {
  logger.debug('New PostgreSQL client connected');
});

dbPool.on('error', (err: Error) => {
  logger.error('PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a query with tenant isolation
 * Automatically sets the org_id context for RLS policies
 */
export async function executeQuery(
  text: string,
  params?: any[],
  orgId?: string,
  isSuperAdmin?: boolean
): Promise<any> {
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Set tenant context for Row Level Security
    if (orgId && !isSuperAdmin) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_org_id',
        orgId
      ]);
    }
    
    // Set super admin flag
    if (isSuperAdmin) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.is_super_admin',
        'true'
      ]);
    }
    
    const result = await client.query(text, params);
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a single transaction
 */
export async function executeTransaction(
  queries: Array<{ text: string; params?: any[] }>,
  orgId?: string,
  isSuperAdmin?: boolean
): Promise<any[]> {
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Set tenant context
    if (orgId && !isSuperAdmin) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_org_id',
        orgId
      ]);
    }
    
    if (isSuperAdmin) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.is_super_admin',
        'true'
      ]);
    }
    
    const results = [];
    for (const query of queries) {
      const result = await client.query(query.text, query.params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await dbPool.query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}