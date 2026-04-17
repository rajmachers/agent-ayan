import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from 'http';
import { AgentManager } from './services/AgentManager';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Routes
import agentsRouter from './routes/agents';
import sessionsRouter from './routes/sessions';
import healthRouter from './routes/health';

const app: Application = express();
const agentManager = new AgentManager();

// Middleware
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: config.app.allowedOrigins?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Add agent manager to request context
app.use((req, res, next) => {
  (req as any).agentManager = agentManager;
  next();
});

// Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/sessions', sessionsRouter);

// Error handling
app.use(errorHandler);

// Server setup
let server: Server;

const startServer = async (): Promise<void> => {
  try {
    server = app.listen(config.app.port, () => {
      logger.info('Agent Runtime server started', {
        port: config.app.port,
        environment: config.app.environment,
        nodeEnv: process.env.NODE_ENV,
      });
    });

    // Set up agent manager event listeners
    agentManager.on('agentStarted', (agentId, sessionId) => {
      logger.info('Agent started via manager', { agentId, sessionId });
    });

    agentManager.on('agentStopped', (agentId, sessionId) => {
      logger.info('Agent stopped via manager', { agentId, sessionId });
    });

    agentManager.on('agentError', (agentId, error) => {
      logger.error('Agent error via manager', {
        agentId,
        error: error.message,
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, starting graceful shutdown...');
      await shutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, starting graceful shutdown...');
      await shutdown();
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise),
      });
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
};

const shutdown = async (): Promise<void> => {
  logger.info('Starting graceful shutdown...');

  try {
    // Stop accepting new requests
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Stop all agents
    await agentManager.shutdown();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start application', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});

// Export for testing
export { app, agentManager };