import Redis, { RedisOptions } from 'ioredis';
import { Logger } from '../utils/Logger';

export interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export class RedisConnection {
  private client: Redis;
  private logger = Logger.getInstance();
  private isConnected = false;
  private keyPrefix: string;

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix || 'p7_agent_runtime:';
    
    this.client = new Redis({
      host: config.host,
      port: config.port,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: true,
      ...config
    });

    // Handle Redis events
    this.client.on('connect', () => {
      this.logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client connected and ready');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Connect to Redis server
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      
      // Test connection
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        this.logger.info('Redis connection established successfully');
      }
      
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    const timer = this.logger.startTimer();
    
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.get(fullKey);
      
      const duration = timer();
      this.logger.cache(result ? 'hit' : 'miss', key, { duration });
      
      return result;
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Redis GET failed:', error, { key, duration });
      throw error;
    }
  }

  /**
   * Set key-value pair
   */
  async set(key: string, value: string): Promise<void> {
    const timer = this.logger.startTimer();
    
    try {
      const fullKey = this.getFullKey(key);
      await this.client.set(fullKey, value);
      
      const duration = timer();
      this.logger.cache('set', key, { duration });
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Redis SET failed:', error, { key, duration });
      throw error;
    }
  }

  /**
   * Set key-value pair with expiration
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    const timer = this.logger.startTimer();
    
    try {
      const fullKey = this.getFullKey(key);
      await this.client.setex(fullKey, seconds, value);
      
      const duration = timer();
      this.logger.cache('set', key, { duration, ttl: seconds });
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Redis SETEX failed:', error, { key, duration });
      throw error;
    }
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<number> {
    const timer = this.logger.startTimer();
    
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.del(fullKey);
      
      const duration = timer();
      this.logger.cache('delete', key, { duration });
      
      return result;
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Redis DEL failed:', error, { key, duration });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
      
    } catch (error) {
      this.logger.error('Redis EXISTS failed:', error, { key });
      throw error;
    }
  }

  /**
   * Set expiration time for key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.expire(fullKey, seconds);
      return result === 1;
      
    } catch (error) {
      this.logger.error('Redis EXPIRE failed:', error, { key });
      throw error;
    }
  }

  /**
   * Get time to live for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.ttl(fullKey);
      
    } catch (error) {
      this.logger.error('Redis TTL failed:', error, { key });
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.incr(fullKey);
      
    } catch (error) {
      this.logger.error('Redis INCR failed:', error, { key });
      throw error;
    }
  }

  /**
   * Increment counter by amount
   */
  async incrby(key: string, amount: number): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.incrby(fullKey, amount);
      
    } catch (error) {
      this.logger.error('Redis INCRBY failed:', error, { key, amount });
      throw error;
    }
  }

  /**
   * Decrement counter
   */
  async decr(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.decr(fullKey);
      
    } catch (error) {
      this.logger.error('Redis DECR failed:', error, { key });
      throw error;
    }
  }

  // Hash operations

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.hset(fullKey, field, value);
      
    } catch (error) {
      this.logger.error('Redis HSET failed:', error, { key, field });
      throw error;
    }
  }

  /**
   * Get hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.hget(fullKey, field);
      
    } catch (error) {
      this.logger.error('Redis HGET failed:', error, { key, field });
      throw error;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.hgetall(fullKey);
      
    } catch (error) {
      this.logger.error('Redis HGETALL failed:', error, { key });
      throw error;
    }
  }

  /**
   * Delete hash field
   */
  async hdel(key: string, field: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.hdel(fullKey, field);
      
    } catch (error) {
      this.logger.error('Redis HDEL failed:', error, { key, field });
      throw error;
    }
  }

  // List operations

  /**
   * Push to left of list
   */
  async lpush(key: string, value: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.lpush(fullKey, value);
      
    } catch (error) {
      this.logger.error('Redis LPUSH failed:', error, { key });
      throw error;
    }
  }

  /**
   * Push to right of list
   */
  async rpush(key: string, value: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.rpush(fullKey, value);
      
    } catch (error) {
      this.logger.error('Redis RPUSH failed:', error, { key });
      throw error;
    }
  }

  /**
   * Pop from left of list
   */
  async lpop(key: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.lpop(fullKey);
      
    } catch (error) {
      this.logger.error('Redis LPOP failed:', error, { key });
      throw error;
    }
  }

  /**
   * Pop from right of list
   */
  async rpop(key: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.rpop(fullKey);
      
    } catch (error) {
      this.logger.error('Redis RPOP failed:', error, { key });
      throw error;
    }
  }

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.llen(fullKey);
      
    } catch (error) {
      this.logger.error('Redis LLEN failed:', error, { key });
      throw error;
    }
  }

  /**
   * Get range of list elements
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.lrange(fullKey, start, stop);
      
    } catch (error) {
      this.logger.error('Redis LRANGE failed:', error, { key, start, stop });
      throw error;
    }
  }

  // Set operations

  /**
   * Add to set
   */
  async sadd(key: string, member: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.sadd(fullKey, member);
      
    } catch (error) {
      this.logger.error('Redis SADD failed:', error, { key });
      throw error;
    }
  }

  /**
   * Remove from set
   */
  async srem(key: string, member: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.srem(fullKey, member);
      
    } catch (error) {
      this.logger.error('Redis SREM failed:', error, { key });
      throw error;
    }
  }

  /**
   * Check if member is in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.sismember(fullKey, member);
      return result === 1;
      
    } catch (error) {
      this.logger.error('Redis SISMEMBER failed:', error, { key });
      throw error;
    }
  }

  /**
   * Get all set members
   */
  async smembers(key: string): Promise<string[]> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.smembers(fullKey);
      
    } catch (error) {
      this.logger.error('Redis SMEMBERS failed:', error, { key });
      throw error;
    }
  }

  // Sorted set operations

  /**
   * Add to sorted set
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.zadd(fullKey, score, member);
      
    } catch (error) {
      this.logger.error('Redis ZADD failed:', error, { key });
      throw error;
    }
  }

  /**
   * Get sorted set range by rank
   */
  async zrange(key: string, start: number, stop: number, withScores = false): Promise<string[]> {
    try {
      const fullKey = this.getFullKey(key);
      if (withScores) {
        return await this.client.zrange(fullKey, start, stop, 'WITHSCORES');
      } else {
        return await this.client.zrange(fullKey, start, stop);
      }
      
    } catch (error) {
      this.logger.error('Redis ZRANGE failed:', error, { key, start, stop });
      throw error;
    }
  }

  /**
   * Get member score from sorted set
   */
  async zscore(key: string, member: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.client.zscore(fullKey, member);
      
    } catch (error) {
      this.logger.error('Redis ZSCORE failed:', error, { key });
      throw error;
    }
  }

  // Pub/Sub operations

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      const fullChannel = this.getFullKey(channel);
      return await this.client.publish(fullChannel, message);
      
    } catch (error) {
      this.logger.error('Redis PUBLISH failed:', error, { channel });
      throw error;
    }
  }

  /**
   * Subscribe to channel
   */
  subscribe(channel: string, callback: (message: string) => void): void {
    try {
      const fullChannel = this.getFullKey(channel);
      
      this.client.subscribe(fullChannel);
      this.client.on('message', (receivedChannel, message) => {
        if (receivedChannel === fullChannel) {
          callback(message);
        }
      });
      
    } catch (error) {
      this.logger.error('Redis SUBSCRIBE failed:', error, { channel });
      throw error;
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      const fullChannel = this.getFullKey(channel);
      await this.client.unsubscribe(fullChannel);
      
    } catch (error) {
      this.logger.error('Redis UNSUBSCRIBE failed:', error, { channel });
      throw error;
    }
  }

  // Pipeline operations

  /**
   * Execute multiple commands in pipeline
   */
  async pipeline(commands: Array<{ command: string; args: any[] }>): Promise<any[]> {
    const timer = this.logger.startTimer();
    
    try {
      const pipeline = this.client.pipeline();
      
      for (const { command, args } of commands) {
        const modifiedArgs = args.map((arg, index) => 
          index === 0 && typeof arg === 'string' ? this.getFullKey(arg) : arg
        );
        (pipeline as any)[command](...modifiedArgs);
      }
      
      const results = await pipeline.exec();
      
      const duration = timer();
      this.logger.performance('redis_pipeline', duration, {
        commandCount: commands.length
      });
      
      return results;
      
    } catch (error) {
      const duration = timer();
      this.logger.error('Redis pipeline failed:', error, { 
        duration,
        commandCount: commands.length 
      });
      throw error;
    }
  }

  // Utility methods

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Flush all keys with current prefix
   */
  async flushPrefix(): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.cache('clear', 'prefix', { keys: keys.length });
      }
      
    } catch (error) {
      this.logger.error('Failed to flush Redis prefix:', error);
      throw error;
    }
  }

  /**
   * Get Redis information
   */
  async info(): Promise<string> {
    try {
      return await this.client.info();
      
    } catch (error) {
      this.logger.error('Redis INFO failed:', error);
      throw error;
    }
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping();
      
    } catch (error) {
      this.logger.error('Redis PING failed:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.ping();
      return response === 'PONG';
      
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get Redis statistics
   */
  async getStats(): Promise<{
    connected_clients: number;
    used_memory: string;
    keyspace_hits: number;
    keyspace_misses: number;
    total_commands_processed: number;
  }> {
    try {
      const info = await this.info();
      const lines = info.split('\r\n');
      const stats: any = {};
      
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
      
      return {
        connected_clients: stats.connected_clients || 0,
        used_memory: stats.used_memory_human || '0B',
        keyspace_hits: stats.keyspace_hits || 0,
        keyspace_misses: stats.keyspace_misses || 0,
        total_commands_processed: stats.total_commands_processed || 0
      };
      
    } catch (error) {
      this.logger.error('Failed to get Redis statistics:', error);
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      this.logger.info('Redis connection closed');
      
    } catch (error) {
      this.logger.error('Failed to close Redis connection:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Get Redis client instance (use with caution)
   */
  getClient(): Redis {
    return this.client;
  }
}