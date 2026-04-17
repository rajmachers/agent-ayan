import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from './logger';

// Create Redis client with explicit type annotation
export const redisClient: RedisClientType = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
  password: config.redis.password || undefined,
  database: config.redis.db,
}) as RedisClientType;

// Connection event handlers
redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { error: err.message });
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    process.exit(1);
  }
})();

/**
 * Cache utility with tenant-aware keys
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  },

  /**
   * Set value in cache with optional expiration
   */
  async set(key: string, value: string, expirationSeconds?: number): Promise<boolean> {
    try {
      if (expirationSeconds) {
        await redisClient.setEx(key, expirationSeconds, value);
      } else {
        await redisClient.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  },

  /**
   * Set JSON value in cache
   */
  async setJSON(key: string, value: any, expirationSeconds?: number): Promise<boolean> {
    return this.set(key, JSON.stringify(value), expirationSeconds);
  },

  /**
   * Get JSON value from cache
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache JSON parse error', { key, error });
      return null;
    }
  },

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  },

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  },

  /**
   * Generate session-scoped cache key
   */
  sessionKey(sessionId: string, suffix: string): string {
    return `session:${sessionId}:${suffix}`;
  },

  /**
   * Generate agent-scoped cache key
   */
  agentKey(agentId: string, suffix: string): string {
    return `agent:${agentId}:${suffix}`;
  },
};

/**
 * Get Redis health status
 */
export async function getRedisHealth(): Promise<{ healthy: boolean; latency?: number }> {
  const start = Date.now();
  
  try {
    await redisClient.ping();
    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return { healthy: false };
  }
}