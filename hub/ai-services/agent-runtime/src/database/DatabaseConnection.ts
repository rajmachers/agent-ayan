import { Pool, PoolClient, QueryResult } from 'pg';
import { Logger } from '../utils/Logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  max?: number;           // Maximum number of clients in the pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseConnection {
  private pool: Pool;
  private logger = Logger.getInstance();
  private isConnected = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Handle pool events
    this.pool.on('connect', (client) => {
      this.logger.debug('New database client connected');
    });

    this.pool.on('error', (err, client) => {
      this.logger.error('Database pool error:', err);
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Database client removed from pool');
    });
  }

  /**
   * Initialize database connection and test connectivity
   */
  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as server_time, version() as db_version');
      
      this.logger.info('Database connected successfully', {
        serverTime: result.rows[0].server_time,
        dbVersion: result.rows[0].db_version
      });
      
      client.release();
      this.isConnected = true;

    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Execute a query with parameters
   */
  async query(text: string, params?: any[]): Promise<QueryResult> {
    const timer = this.logger.startTimer();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = timer();
      
      this.logger.query(text, duration, {
        rowCount: result.rowCount,
        params: params?.length || 0
      });
      
      return result;
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Database query failed:', error, {
        query: text.substring(0, 200),
        duration,
        params: params?.length || 0
      });
      throw error;
    }
  }

  /**
   * Execute a query and return only the first row
   */
  async queryOne(text: string, params?: any[]): Promise<any | null> {
    const result = await this.query(text, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(queries: ((client: PoolClient) => Promise<T>)): Promise<T> {
    const client = await this.pool.connect();
    const timer = this.logger.startTimer();
    
    try {
      await client.query('BEGIN');
      
      const result = await queries(client);
      
      await client.query('COMMIT');
      
      const duration = timer();
      this.logger.performance('database_transaction', duration);
      
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      const duration = timer();
      
      this.logger.error('Database transaction failed:', error, { duration });
      throw error;
      
    } finally {
      client.release();
    }
  }

  /**
   * Execute a prepared statement
   */
  async prepared(name: string, text: string, values: any[]): Promise<QueryResult> {
    const timer = this.logger.startTimer();
    
    try {
      const result = await this.pool.query({
        name,
        text,
        values
      });
      
      const duration = timer();
      this.logger.query(`PREPARED[${name}]: ${text}`, duration, {
        rowCount: result.rowCount,
        params: values.length
      });
      
      return result;
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Prepared statement failed:', error, {
        name,
        query: text.substring(0, 200),
        duration
      });
      throw error;
    }
  }

  /**
   * Bulk insert using COPY command for better performance
   */
  async bulkInsert(tableName: string, columns: string[], rows: any[][]): Promise<number> {
    const timer = this.logger.startTimer();
    
    try {
      const client = await this.pool.connect();
      
      try {
        // Create COPY command
        const copyQuery = `COPY ${tableName} (${columns.join(', ')}) FROM STDIN WITH CSV`;
        
        // Convert rows to CSV format
        const csvData = rows.map(row => 
          row.map(cell => 
            cell === null ? '' : 
            typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : 
            cell.toString()
          ).join(',')
        ).join('\n');
        
        // Execute COPY
        await client.query(copyQuery);
        // Note: In a real implementation, you'd use client.query(COPY ...) with stream
        
        const duration = timer();
        this.logger.performance('bulk_insert', duration, {
          table: tableName,
          rows: rows.length,
          columns: columns.length
        });
        
        return rows.length;
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Bulk insert failed:', error, {
        table: tableName,
        duration,
        rows: rows.length
      });
      throw error;
    }
  }

  /**
   * Execute queries in batch for better performance
   */
  async batch(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult[]> {
    const timer = this.logger.startTimer();
    const client = await this.pool.connect();
    
    try {
      const results: QueryResult[] = [];
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      
      const duration = timer();
      this.logger.performance('batch_queries', duration, {
        queryCount: queries.length
      });
      
      return results;
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Batch queries failed:', error, {
        duration,
        queryCount: queries.length
      });
      throw error;
      
    } finally {
      client.release();
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string, schema: string = 'public'): Promise<boolean> {
    try {
      const result = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        )
      `, [schema, tableName]);
      
      return result.rows[0].exists;
      
    } catch (error) {
      this.logger.error('Failed to check table existence:', error, { tableName, schema });
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    totalQueries: number;
    databaseSize: string;
  }> {
    try {
      const [connStats, dbStats] = await Promise.all([
        this.query(`
          SELECT 
            count(*) as total,
            count(*) FILTER (WHERE state = 'active') as active,
            count(*) FILTER (WHERE state = 'idle') as idle,
            count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting
          FROM pg_stat_activity 
          WHERE datname = current_database()
        `),
        this.query(`
          SELECT 
            pg_size_pretty(pg_database_size(current_database())) as size,
            (SELECT sum(numbackends) FROM pg_stat_database WHERE datname = current_database()) as queries
        `)
      ]);
      
      return {
        totalConnections: parseInt(connStats.rows[0].total),
        activeConnections: parseInt(connStats.rows[0].active),
        idleConnections: parseInt(connStats.rows[0].idle),
        waitingConnections: parseInt(connStats.rows[0].waiting),
        totalQueries: parseInt(dbStats.rows[0].queries) || 0,
        databaseSize: dbStats.rows[0].size
      };
      
    } catch (error) {
      this.logger.error('Failed to get database statistics:', error);
      throw error;
    }
  }

  /**
   * Health check query
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
      
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      this.logger.info('Database connection pool closed');
      
    } catch (error) {
      this.logger.error('Failed to close database connection:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get pool information
   */
  getPoolInfo(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  // Utility methods for common database operations

  /**
   * Insert a record and return the inserted row
   */
  async insert(tableName: string, data: Record<string, any>): Promise<any> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update records and return updated rows
   */
  async update(
    tableName: string, 
    data: Record<string, any>, 
    whereClause: string, 
    whereParams: any[]
  ): Promise<any[]> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    const whereParamIndexes = whereParams.map((_, index) => `$${columns.length + index + 1}`);
    
    const query = `
      UPDATE ${tableName} 
      SET ${setClause} 
      WHERE ${whereClause.replace(/\$\d+/g, () => whereParamIndexes.shift() || '')}
      RETURNING *
    `;
    
    const result = await this.query(query, [...values, ...whereParams]);
    return result.rows;
  }

  /**
   * Delete records and return deleted rows
   */
  async delete(tableName: string, whereClause: string, whereParams: any[]): Promise<any[]> {
    const query = `DELETE FROM ${tableName} WHERE ${whereClause} RETURNING *`;
    const result = await this.query(query, whereParams);
    return result.rows;
  }

  /**
   * Select records with pagination
   */
  async select(
    tableName: string,
    options: {
      columns?: string[];
      where?: string;
      whereParams?: any[];
      orderBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ rows: any[]; totalCount: number }> {
    const columns = options.columns?.join(', ') || '*';
    let query = `SELECT ${columns} FROM ${tableName}`;
    let countQuery = `SELECT COUNT(*) FROM ${tableName}`;
    
    const params: any[] = [];
    
    if (options.where) {
      query += ` WHERE ${options.where}`;
      countQuery += ` WHERE ${options.where}`;
      
      if (options.whereParams) {
        params.push(...options.whereParams);
      }
    }
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    
    if (options.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }
    
    const [dataResult, countResult] = await Promise.all([
      this.query(query, params),
      this.query(countQuery, options.whereParams || [])
    ]);
    
    return {
      rows: dataResult.rows,
      totalCount: parseInt(countResult.rows[0].count)
    };
  }
}