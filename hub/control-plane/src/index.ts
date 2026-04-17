import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { SessionManager } from './services/SessionManager';
import { ProctorManager } from './services/ProctorManager';
import { ModelOrchestrator } from './services/ModelOrchestrator';
import { WebSocketHandler } from './services/WebSocketHandler';
import { DatabaseConnection } from './database/DatabaseConnection';
import { RedisConnection } from './database/RedisConnection';
import { Logger } from './utils/Logger';
import { ErrorHandler } from './middleware/ErrorHandler';
import { setupRoutes } from './routes';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ["http://localhost:3007", "http://localhost:3008", "http://localhost:3009", "http://localhost:3010"],
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 13002;
const logger = Logger.getInstance();

class P7ControlPlane {
  private sessionManager: SessionManager;
  private proctorManager: ProctorManager;
  private modelOrchestrator: ModelOrchestrator;
  private wsHandler: WebSocketHandler;
  private dbConnection: DatabaseConnection;
  private redisConnection: RedisConnection;

  constructor() {
    this.setupMiddleware();
    this.initializeServices();
  }

  private setupMiddleware() {
    app.use(helmet());
    app.use(cors());
    app.use(morgan('combined'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private async initializeServices() {
    try {
      // Initialize database connections
      this.dbConnection = new DatabaseConnection();
      await this.dbConnection.connect();

      this.redisConnection = new RedisConnection();
      await this.redisConnection.connect();

      // Initialize core services
      this.sessionManager = new SessionManager(this.dbConnection, this.redisConnection);
      this.proctorManager = new ProctorManager(this.dbConnection, this.redisConnection);
      this.modelOrchestrator = new ModelOrchestrator(this.sessionManager, this.proctorManager);
      
      // Initialize WebSocket handler
      this.wsHandler = new WebSocketHandler(io, this.sessionManager, this.proctorManager);

      // Setup API routes
      setupRoutes(app, {
        sessionManager: this.sessionManager,
        proctorManager: this.proctorManager,
        modelOrchestrator: this.modelOrchestrator
      });

      // Error handling
      app.use(ErrorHandler);

      logger.info('P7 Control Plane services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize P7 Control Plane services:', error);
      process.exit(1);
    }
  }

  public async start() {
    try {
      server.listen(PORT, () => {
        logger.info(`🎯 Phase 7 Control Plane running on port ${PORT}`);
        logger.info(`📊 Health check: http://localhost:${PORT}/health`);
        logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
        this.logServiceStatus();
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start P7 Control Plane:', error);
      process.exit(1);
    }
  }

  private logServiceStatus() {
    logger.info('🏗️ P7 Control Plane Service Status:');
    logger.info('  ✅ Session Management - REQ-025 Multi-Stage Entry Protocol');
    logger.info('  ✅ Proctor Assignment - REQ-036 Random Assignment Engine');
    logger.info('  ✅ Model Orchestration - REQ-017-020 Basic/Advanced Models');
    logger.info('  ✅ Real-time Communication - REQ-081 WebSocket Layer');
    logger.info('  ✅ Load Balancing - REQ-035 Active Proctor Queries');
  }

  private async shutdown() {
    logger.info('🛑 Shutting down P7 Control Plane...');
    
    try {
      await this.dbConnection.disconnect();
      await this.redisConnection.disconnect();
      server.close();
      logger.info('✅ P7 Control Plane shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the service
const controlPlane = new P7ControlPlane();
controlPlane.start();

export { app, io };