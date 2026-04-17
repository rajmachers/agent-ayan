import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Configuration schema validation
const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(8080),
  
  // Database configuration
  DATABASE_URL: Joi.string().required(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().default('ayan_db'),
  DB_USER: Joi.string().default('ayan_user'),
  DB_PASSWORD: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MIN: Joi.number().default(2),
  DB_POOL_MAX: Joi.number().default(20),
  
  // Redis configuration
  REDIS_URL: Joi.string(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),
  
  // JWT configuration
  JWT_SECRET: Joi.string().min(32),
  JWT_ISSUER: Joi.string().default('ayan.nunmai.local'),
  JWT_AUDIENCE: Joi.string().default('ayan-api'),
  JWT_ALGORITHM: Joi.string().default('HS256'),
  
  // JWKS configuration for external issuers
  JWKS_URI: Joi.string().uri().optional(),
  TRUSTED_ISSUERS: Joi.string().optional(), // Comma-separated list
  
  // CORS configuration
  CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:3001,https://ayan.nunmai.local'),
  
  // LiveKit configuration
  LIVEKIT_API_KEY: Joi.string().default('ayan_api_key'),
  LIVEKIT_API_SECRET: Joi.string().default('ayan_api_secret_dev'),
  LIVEKIT_WS_URL: Joi.string().default('ws://localhost:7880'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(1000), // per window
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
});

const { error, value: envVars } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  environment: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    url: envVars.DATABASE_URL || `postgresql://${envVars.DB_USER}:${envVars.DB_PASSWORD}@${envVars.DB_HOST}:${envVars.DB_PORT}/${envVars.DB_NAME}`,
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    ssl: envVars.DB_SSL,
    pool: {
      min: envVars.DB_POOL_MIN,
      max: envVars.DB_POOL_MAX,
    },
  },
  
  redis: {
    url: envVars.REDIS_URL || `redis://${envVars.REDIS_HOST}:${envVars.REDIS_PORT}/${envVars.REDIS_DB}`,
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    issuer: envVars.JWT_ISSUER,
    audience: envVars.JWT_AUDIENCE,
    algorithm: envVars.JWT_ALGORITHM as 'HS256' | 'RS256',
    expiresIn: '24h',
  },
  
  jwks: {
    uri: envVars.JWKS_URI,
    trustedIssuers: envVars.TRUSTED_ISSUERS?.split(',').map((s: string) => s.trim()) || [],
  },
  
  cors: {
    origins: envVars.CORS_ORIGINS.split(',').map((origin: string) => origin.trim()),
  },
  
  livekit: {
    apiKey: envVars.LIVEKIT_API_KEY,
    apiSecret: envVars.LIVEKIT_API_SECRET,
    wsUrl: envVars.LIVEKIT_WS_URL,
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
  },
} as const;