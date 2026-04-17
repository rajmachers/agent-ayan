import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3003),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  
  // Database
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_NAME: Joi.string().default('agent_proctor_dev'),
  DATABASE_USER: Joi.string().default('postgres'),
  DATABASE_PASSWORD: Joi.string().allow('').default(''),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_POOL_SIZE: Joi.number().default(10),
  
  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  
  // LiveKit
  LIVEKIT_URL: Joi.string().default('ws://localhost:7880'),
  LIVEKIT_API_KEY: Joi.string().default('your_api_key'),
  LIVEKIT_API_SECRET: Joi.string().default('your_secret'),
  
  // AI Services
  AI_VISION_SERVICE_URL: Joi.string().default('http://localhost:8001'),
  AI_AUDIO_SERVICE_URL: Joi.string().default('http://localhost:8002'),
  AI_BEHAVIOR_SERVICE_URL: Joi.string().default('http://localhost:8003'),
  AI_SERVICE_TIMEOUT: Joi.number().default(30000),
  
  // API Gateway
  API_GATEWAY_URL: Joi.string().default('http://localhost:3001'),
  
  // Agent Configuration
  AGENT_FRAME_RATE: Joi.number().default(2),
  AGENT_AUDIO_CHUNK_SIZE: Joi.number().default(16000),
  AGENT_QUEUE_MAX_SIZE: Joi.number().default(100),
  AGENT_MAX_RESTARTS: Joi.number().default(3),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  app: {
    environment: envVars.NODE_ENV,
    port: envVars.PORT,
    logLevel: envVars.LOG_LEVEL,
    allowedOrigins: envVars.ALLOWED_ORIGINS,
  },
  
  database: {
    host: envVars.DATABASE_HOST,
    port: envVars.DATABASE_PORT,
    database: envVars.DATABASE_NAME,
    username: envVars.DATABASE_USER,
    password: envVars.DATABASE_PASSWORD,
    ssl: envVars.DATABASE_SSL,
    poolSize: envVars.DATABASE_POOL_SIZE,
  },
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },
  
  livekit: {
    url: envVars.LIVEKIT_URL,
    apiKey: envVars.LIVEKIT_API_KEY,
    apiSecret: envVars.LIVEKIT_API_SECRET,
  },
  
  aiServices: {
    vision: {
      url: envVars.AI_VISION_SERVICE_URL,
      timeout: envVars.AI_SERVICE_TIMEOUT,
    },
    audio: {
      url: envVars.AI_AUDIO_SERVICE_URL,
      timeout: envVars.AI_SERVICE_TIMEOUT,
    },
    behavior: {
      url: envVars.AI_BEHAVIOR_SERVICE_URL,
      timeout: envVars.AI_SERVICE_TIMEOUT,
    },
  },
  
  apiGateway: {
    url: envVars.API_GATEWAY_URL,
  },
  
  agent: {
    frameRate: envVars.AGENT_FRAME_RATE,
    audioChunkSize: envVars.AGENT_AUDIO_CHUNK_SIZE,
    queueMaxSize: envVars.AGENT_QUEUE_MAX_SIZE,
    maxRestarts: envVars.AGENT_MAX_RESTARTS,
    frameProcessingIntervalMs: Math.floor(1000 / envVars.AGENT_FRAME_RATE),
    heartbeatIntervalMs: 30000,
    maxReconnectAttempts: 5,
    aiServiceTimeout: envVars.AI_SERVICE_TIMEOUT,
  },
};