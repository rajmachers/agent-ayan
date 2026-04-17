import { createClient, RedisClientType } from 'redis';
import { Logger } from '../utils/Logger';

export class RedisConnection {
  private client: RedisClientType;
  private logger = Logger.getInstance();

  constructor() {
    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '12631'),
      },
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      this.logger.info('🔌 Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.info('✅ Redis client ready');
    });

    this.client.on('end', () => {
      this.logger.info('📊 Redis client connection closed');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      
      this.logger.info('✅ P7 Control Plane connected to Redis (port 12631)');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('📊 Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }

  // Basic Redis operations
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error('Redis GET error:', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error('Redis SET error:', { key, error });
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    try {
      await this.client.setEx(key, ttl, value);
    } catch (error) {
      this.logger.error('Redis SETEX error:', { key, ttl, error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error('Redis DEL error:', { key, error });
    }
  }

  // List operations for queues
  async lpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lPush(key, value);
    } catch (error) {
      this.logger.error('Redis LPUSH error:', { key, value, error });
      return 0;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rPop(key);
    } catch (error) {
      this.logger.error('Redis RPOP error:', { key, error });
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.lLen(key);
    } catch (error) {
      this.logger.error('Redis LLEN error:', { key, error });
      return 0;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      this.logger.error('Redis LRANGE error:', { key, start, stop, error });
      return [];
    }
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      this.logger.error('Redis HSET error:', { key, field, error });
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      this.logger.error('Redis HGET error:', { key, field, error });
      return null;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      this.logger.error('Redis HGETALL error:', { key, error });
      return {};
    }
  }

  // Set operations
  async sadd(key: string, value: string): Promise<number> {
    try {
      return await this.client.sAdd(key, value);
    } catch (error) {
      this.logger.error('Redis SADD error:', { key, value, error });
      return 0;
    }
  }

  async srem(key: string, value: string): Promise<number> {
    try {
      return await this.client.sRem(key, value);
    } catch (error) {
      this.logger.error('Redis SREM error:', { key, value, error });
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      this.logger.error('Redis SMEMBERS error:', { key, error });
      return [];
    }
  }

  // Specialized methods for Phase 7 Control Plane

  /**
   * Session queue management
   */
  async queueSession(tenantId: string, sessionId: string, priority: 'high' | 'normal' = 'normal'): Promise<number> {
    const queueKey = `queue:${tenantId}:${priority}`;
    return await this.lpush(queueKey, sessionId);
  }

  async dequeueSession(tenantId: string, priority: 'high' | 'normal' = 'normal'): Promise<string | null> {
    const queueKey = `queue:${tenantId}:${priority}`;
    return await this.rpop(queueKey);
  }

  async getQueueLength(tenantId: string, priority: 'high' | 'normal' = 'normal'): Promise<number> {
    const queueKey = `queue:${tenantId}:${priority}`;
    return await this.llen(queueKey);
  }

  /**
   * Proctor load tracking
   */
  async updateProctorLoad(proctorId: string, currentLoad: number): Promise<void> {
    await this.hset(`proctor:load:${proctorId}`, 'current', currentLoad.toString());
    await this.hset(`proctor:load:${proctorId}`, 'updated_at', Date.now().toString());
  }

  async getProctorLoad(proctorId: string): Promise<number> {
    const load = await this.hget(`proctor:load:${proctorId}`, 'current');
    return load ? parseInt(load) : 0;
  }

  /**
   * Active proctors tracking
   */
  async addActiveProctor(tenantId: string, proctorId: string): Promise<void> {
    await this.sadd(`active:proctors:${tenantId}`, proctorId);
  }

  async removeActiveProctor(tenantId: string, proctorId: string): Promise<void> {
    await this.srem(`active:proctors:${tenantId}`, proctorId);
  }

  async getActiveProctors(tenantId: string): Promise<string[]> {
    return await this.smembers(`active:proctors:${tenantId}`);
  }

  /**
   * Gatekeeper queue management (Advanced Model)
   */
  async queueForGatekeeper(tenantId: string, sessionId: string, priority: number = 5): Promise<number> {
    const queueKey = `gatekeeper:queue:${tenantId}`;
    
    // Use sorted set for priority-based queuing
    try {
      return await this.client.zAdd(queueKey, {
        score: priority,
        value: sessionId
      });
    } catch (error) {
      this.logger.error('Redis Gatekeeper queue error:', { tenantId, sessionId, priority, error });
      return 0;
    }
  }

  async dequeueFromGatekeeper(tenantId: string): Promise<string | null> {
    const queueKey = `gatekeeper:queue:${tenantId}`;
    
    try {
      // Get highest priority session (lowest score)
      const result = await this.client.zPopMin(queueKey);
      return result?.value || null;
    } catch (error) {
      this.logger.error('Redis Gatekeeper dequeue error:', { tenantId, error });
      return null;
    }
  }

  async getGatekeeperQueueLength(tenantId: string): Promise<number> {
    const queueKey = `gatekeeper:queue:${tenantId}`;
    
    try {
      return await this.client.zCard(queueKey);
    } catch (error) {
      this.logger.error('Redis Gatekeeper queue length error:', { tenantId, error });
      return 0;
    }
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; timestamp: Date; latency: number }> {
    const start = Date.now();
    try {
      await this.client.ping();
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