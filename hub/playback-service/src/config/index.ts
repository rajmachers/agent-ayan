/**
 * Configuration management for Playbook & Audit Service
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Service configuration
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3004),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Database configuration
  databaseUrl: z.string().min(1, 'Database URL is required'),
  redisUrl: z.string().default('redis://localhost:6379'),
  
  // Storage configuration
  storageType: z.enum(['minio', 's3']).default('minio'),
  minioEndpoint: z.string().default('localhost:9000'),
  minioAccessKey: z.string().default('minioadmin'),
  minioSecretKey: z.string().default('minioadmin'),
  minioBucket: z.string().default('recordings'),
  minioUseSsl: z.coerce.boolean().default(false),
  
  // AWS S3 configuration
  awsRegion: z.string().default('us-east-1'),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  s3Bucket: z.string().default('agent-proctor-recordings'),
  
  // LiveKit configuration
  livekitWsUrl: z.string().default('wss://localhost:7880'),
  livekitApiKey: z.string().default('devkey'),
  livekitApiSecret: z.string().default('secret'),
  
  // AI Services configuration
  aiVisionUrl: z.string().default('http://localhost:8001'),
  aiAudioUrl: z.string().default('http://localhost:8002'),
  aiBehaviorUrl: z.string().default('http://localhost:8003'),
  
  // Processing configuration
  maxConcurrentAnalysis: z.coerce.number().default(3),
  chunkDurationSeconds: z.coerce.number().default(30),
  analysisBatchSize: z.coerce.number().default(5),
  maxRecordingSizeGb: z.coerce.number().default(10),
  
  // Indexing configuration
  indexingEnabled: z.coerce.boolean().default(true),
  realTimeAnalysis: z.coerce.boolean().default(true),
  violationThreshold: z.coerce.number().default(0.6),
  timestampPrecisionMs: z.coerce.number().default(1000),
  
  // API configuration
  corsOrigins: z.string().transform(str => str.split(',')).default('http://localhost:3001,http://localhost:3003'),
  rateLimitWindowMs: z.coerce.number().default(60000),
  rateLimitMaxRequests: z.coerce.number().default(100),
  authEnabled: z.coerce.boolean().default(true),
  
  // Audit configuration
  auditRetentionDays: z.coerce.number().default(90),
  reportGenerationTimeout: z.coerce.number().default(300),
  videoProcessingTimeout: z.coerce.number().default(600),
  thumbnailGeneration: z.coerce.boolean().default(true),
  
  // Monitoring
  metricsEnabled: z.coerce.boolean().default(true),
  healthCheckInterval: z.coerce.number().default(30),
  performanceMonitoring: z.coerce.boolean().default(true)
});

// Parse and validate configuration
const rawConfig = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  host: process.env.HOST,
  logLevel: process.env.LOG_LEVEL,
  
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  
  storageType: process.env.STORAGE_TYPE,
  minioEndpoint: process.env.MINIO_ENDPOINT,
  minioAccessKey: process.env.MINIO_ACCESS_KEY,
  minioSecretKey: process.env.MINIO_SECRET_KEY,
  minioBucket: process.env.MINIO_BUCKET,
  minioUseSsl: process.env.MINIO_USE_SSL,
  
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3Bucket: process.env.S3_BUCKET,
  
  livekitWsUrl: process.env.LIVEKIT_WS_URL,
  livekitApiKey: process.env.LIVEKIT_API_KEY,
  livekitApiSecret: process.env.LIVEKIT_API_SECRET,
  
  aiVisionUrl: process.env.AI_VISION_URL,
  aiAudioUrl: process.env.AI_AUDIO_URL,
  aiBehaviorUrl: process.env.AI_BEHAVIOR_URL,
  
  maxConcurrentAnalysis: process.env.MAX_CONCURRENT_ANALYSIS,
  chunkDurationSeconds: process.env.CHUNK_DURATION_SECONDS,
  analysisBatchSize: process.env.ANALYSIS_BATCH_SIZE,
  maxRecordingSizeGb: process.env.MAX_RECORDING_SIZE_GB,
  
  indexingEnabled: process.env.INDEXING_ENABLED,
  realTimeAnalysis: process.env.REAL_TIME_ANALYSIS,
  violationThreshold: process.env.VIOLATION_THRESHOLD,
  timestampPrecisionMs: process.env.TIMESTAMP_PRECISION_MS,
  
  corsOrigins: process.env.CORS_ORIGINS,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  authEnabled: process.env.AUTH_ENABLED,
  
  auditRetentionDays: process.env.AUDIT_RETENTION_DAYS,
  reportGenerationTimeout: process.env.REPORT_GENERATION_TIMEOUT,
  videoProcessingTimeout: process.env.VIDEO_PROCESSING_TIMEOUT,
  thumbnailGeneration: process.env.THUMBNAIL_GENERATION,
  
  metricsEnabled: process.env.METRICS_ENABLED,
  healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL,
  performanceMonitoring: process.env.PERFORMANCE_MONITORING
};

// Validate configuration
export const config = configSchema.parse(rawConfig);

// Add computed properties
export const extendedConfig = {
  ...config,
  isDevelopment: config.nodeEnv === 'development',
  isProduction: config.nodeEnv === 'production',
  isTest: config.nodeEnv === 'test'
};

// Export type
export type Config = typeof extendedConfig;