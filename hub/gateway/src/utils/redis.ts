import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from './logger';

// Create Redis client
export const redisClient: RedisClientType = createClient({
  url: config.redis.url,
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
  },
});

// Redis event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connecting');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (error) => {
  logger.error('Redis client error', { error: error.message });
});

redisClient.on('end', () => {
  logger.info('Redis client connection ended');
});

// Connect to Redis
redisClient.connect().catch((error) => {
  logger.error('Failed to connect to Redis', { error });
});

/**
 * Cache utilities with tenant awareness
 */
export const cache = {
  /**
   * Get data from cache with org scoping
   */
  async get(key: string, orgId?: string): Promise<string | null> {
    try {
      const cacheKey = orgId ? `org:${orgId}:${key}` : key;
      return await redisClient.get(cacheKey);
    } catch (error) {
      logger.error('Cache get error', { key, orgId, error });
      return null;
    }
  },

  /**
   * Set data in cache with org scoping
   */
  async set(key: string, value: string, ttl?: number, orgId?: string): Promise<boolean> {
    try {
      const cacheKey = orgId ? `org:${orgId}:${key}` : key;
      if (ttl) {
        await redisClient.setEx(cacheKey, ttl, value);
      } else {
        await redisClient.set(cacheKey, value);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, orgId, error });
      return false;
    }
  },

  /**
   * Delete from cache with org scoping
   */
  async del(key: string, orgId?: string): Promise<boolean> {
    try {
      const cacheKey = orgId ? `org:${orgId}:${key}` : key;
      await redisClient.del(cacheKey);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, orgId, error });
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string, orgId?: string): Promise<boolean> {
    try {
      const cacheKey = orgId ? `org:${orgId}:${key}` : key;
      const result = await redisClient.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, orgId, error });
      return false;
    }
  },

  /**
   * Set with JSON value
   */
  async setJSON(key: string, value: any, ttl?: number, orgId?: string): Promise<boolean> {
    return this.set(key, JSON.stringify(value), ttl, orgId);
  },

  /**
   * Get with JSON parsing
   */
  async getJSON(key: string, orgId?: string): Promise<any | null> {
    const value = await this.get(key, orgId);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache JSON parse error', { key, orgId, error });
      return null;
    }
  },

  /**
   * Increment counter with org scoping
   */
  async incr(key: string, orgId?: string): Promise<number> {
    try {
      const cacheKey = orgId ? `org:${orgId}:${key}` : key;
      return await redisClient.incr(cacheKey);
    } catch (error) {
      logger.error('Cache incr error', { key, orgId, error });
      return 0;
    }
  },

  /**
   * Set expiration for existing key
   */
  async expire(key: string, ttl: number, orgId?: string): Promise<boolean> {
    try {
      const cacheKey = orgId ? `org:${orgId}:${key}` : key;
      const result = await redisClient.expire(cacheKey, ttl);
      return result;
    } catch (error) {
      logger.error('Cache expire error', { key, orgId, error });
      return false;
    }
  },
};

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return false;
  }
}