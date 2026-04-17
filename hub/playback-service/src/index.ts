/**
 * Playbook & Audit Service
 * 
 * Main entry point for the session recording playbook and audit service.
 * Provides comprehensive violation analysis, audit reports, and smart playback.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { extendedConfig as config } from './config';
import { DatabaseService } from './services/database';
import { StorageService } from './services/storage';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { authMiddleware } from './middleware/auth';

// Routes
import recordingRoutes from './routes/recordings';
import analysisRoutes from './routes/analysis';
import auditRoutes from './routes/audit';
import playbackRoutes from './routes/playback';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

class PlaybackService {
  private app: express.Application;
  private databaseService: DatabaseService;
  private storageService: StorageService;

  constructor() {
    this.app = express();
    this.databaseService = new DatabaseService();
    this.storageService = new StorageService();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      optionsSuccessStatus: 200
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Logging
    this.app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));

    // Rate limiting
    this.app.use(rateLimitMiddleware);

    // Authentication (if enabled)
    if (config.authEnabled) {
      this.app.use('/api', authMiddleware);
    }
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.use('/health', healthRoutes);
    
    // API routes
    this.app.use('/api/recordings', recordingRoutes);
    this.app.use('/api/analysis', analysisRoutes);
    this.app.use('/api/audit', auditRoutes);
    this.app.use('/api/playback', playbackRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Playbook & Audit Service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          recordings: '/api/recordings',
          analysis: '/api/analysis',
          audit: '/api/audit',
          playback: '/api/playback',
          health: '/health'
        },
        docs: config.isDevelopment ? '/api/docs' : 'disabled'
      });
    });

    // Error handlers (must be last)
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private async initializeServices(): Promise<void> {
    try {
      logger.info('Initializing services...');
      
      // Initialize database connection
      await this.databaseService.initialize();
      logger.info('Database connected successfully');

      // Initialize storage service
      await this.storageService.initialize();
      logger.info('Storage service initialized');

      // Run database migrations if needed
      await this.databaseService.runMigrations();
      logger.info('Database migrations completed');

      // Make services available to routes via app.locals
      this.app.locals.db = this.databaseService;
      this.app.locals.storage = this.storageService;

    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  private async setupGracefulShutdown(): Promise<void> {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Close database connections
        await this.databaseService.close();
        
        // Close storage connections
        await this.storageService.close();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  public async start(): Promise<void> {
    try {
      // Initialize services
      await this.initializeServices();
      
      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();
      
      // Setup graceful shutdown
      await this.setupGracefulShutdown();
      
      // Start server
      const server = this.app.listen(config.port, config.host, () => {
        logger.info(`Playbook & Audit Service running on ${config.host}:${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`Database: ${config.databaseUrl.split('@')[1] || 'configured'}`);
        logger.info(`Storage: ${config.storageType}`);
      });
      
      // Handle server errors
      server.on('error', (error: Error) => {
        logger.error('Server error:', error);
        process.exit(1);
      });
      
    } catch (error) {
      logger.error('Failed to start Playbook & Audit Service:', error);
      process.exit(1);
    }
  }
}

// Start the service
const service = new PlaybackService();
service.start().catch((error) => {
  logger.error('Unhandled error during startup:', error);
  process.exit(1);
});