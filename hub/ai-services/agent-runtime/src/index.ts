import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { io as clientIo } from 'socket.io-client';
import { EnhancedAgentEngine } from './services/EnhancedAgentEngine';
import { ComplexityScorer } from './services/ComplexityScorer';
import { EscalationManager } from './services/EscalationManager';
import { HumanOverrideHandler } from './services/HumanOverrideHandler';
import { CollaborationInterface } from './services/CollaborationInterface';
import { DatabaseConnection } from './database/DatabaseConnection';
import { RedisConnection } from './database/RedisConnection';
import { Logger } from './utils/Logger';
import { ErrorHandler } from './middleware/ErrorHandler';
import { setupRoutes } from './routes';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 13201;
const logger = Logger.getInstance();

class P7AgentRuntime {
  private agentEngine: EnhancedAgentEngine;
  private complexityScorer: ComplexityScorer;
  private escalationManager: EscalationManager;
  private overrideHandler: HumanOverrideHandler;
  private collaborationInterface: CollaborationInterface;
  private dbConnection: DatabaseConnection;
  private redisConnection: RedisConnection;
  private wsClient: any;

  constructor() {
    this.setupMiddleware();
    this.initializeServices();
  }

  private setupMiddleware() {
    app.use(helmet());
    app.use(cors());
    app.use(morgan('combined'));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  }

  private async initializeServices() {
    try {
      // Initialize database connections
      this.dbConnection = new DatabaseConnection();
      await this.dbConnection.connect();

      this.redisConnection = new RedisConnection();
      await this.redisConnection.connect();

      // Connect to P7 WebSocket service for real-time collaboration
      this.wsClient = clientIo('http://localhost:12801', {
        auth: {
          token: process.env.P7_SERVICE_TOKEN || 'p7-agent-runtime-token',
          type: 'agent_runtime'
        }
      });

      // Initialize core P7 agent services
      this.complexityScorer = new ComplexityScorer(this.dbConnection, this.redisConnection);
      this.escalationManager = new EscalationManager(this.wsClient, this.dbConnection);
      this.overrideHandler = new HumanOverrideHandler(this.wsClient, this.redisConnection);
      this.collaborationInterface = new CollaborationInterface(this.wsClient, this.dbConnection);
      
      // Initialize enhanced agent engine with human-AI collaboration
      this.agentEngine = new EnhancedAgentEngine({
        dbConnection: this.dbConnection,
        redisConnection: this.redisConnection,
        complexityScorer: this.complexityScorer,
        escalationManager: this.escalationManager,
        overrideHandler: this.overrideHandler,
        collaborationInterface: this.collaborationInterface
      });

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers();

      // Setup API routes
      setupRoutes(app, {
        agentEngine: this.agentEngine,
        complexityScorer: this.complexityScorer,
        escalationManager: this.escalationManager,
        overrideHandler: this.overrideHandler
      });

      // Error handling
      app.use(ErrorHandler);

      logger.info('P7 Agent Runtime services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize P7 Agent Runtime services:', error);
      process.exit(1);
    }
  }

  private setupWebSocketHandlers() {
    this.wsClient.on('connect', () => {
      logger.info('🔌 Connected to P7 WebSocket service');
    });

    this.wsClient.on('disconnect', () => {
      logger.warn('🔌 Disconnected from P7 WebSocket service');
    });

    // Human override events
    this.wsClient.on('human:override', async (data) => {
      await this.overrideHandler.processOverride(data);
    });

    // Escalation acknowledgments
    this.wsClient.on('escalation:acknowledged', async (data) => {
      await this.escalationManager.handleAcknowledgment(data);
    });

    // Collaboration requests
    this.wsClient.on('collaboration:request', async (data) => {
      await this.collaborationInterface.handleCollaborationRequest(data);
    });
  }

  public async start() {
    try {
      server.listen(PORT, () => {
        logger.info(`🤖 Phase 7 Agent Runtime running on port ${PORT}`);
        logger.info(`📊 Health check: http://localhost:${PORT}/health`);
        logger.info(`🔗 P7 Control Plane: http://localhost:13002`);
        this.logServiceCapabilities();
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start P7 Agent Runtime:', error);
      process.exit(1);
    }
  }

  private logServiceCapabilities() {
    logger.info('🤖 P7 Agent Runtime Capabilities:');
    logger.info('  ✅ Enhanced Agent Reasoning - REQ-001-012 Human-AI Collaboration');
    logger.info('  ✅ Complexity Scoring Engine - REQ-013-016 Case Distribution');
    logger.info('  ✅ Instant Escalation System - REQ-001-004 <2sec Response Time');
    logger.info('  ✅ Human Override Processing - REQ-005-008 Instant Effect');
    logger.info('  ✅ Collaborative Decision Support - REQ-009-012 Side-by-side Interface');
    logger.info('  ✅ AI Recommendation Engine - REQ-045-048 Confidence Scores');
    logger.info('  ✅ Evidence Assembly System - REQ-049-052 Visual Evidence');
    logger.info('  ✅ Real-time Communication - REQ-081-084 WebSocket Integration');
  }

  private async shutdown() {
    logger.info('🛑 Shutting down P7 Agent Runtime...');
    
    try {
      this.wsClient?.disconnect();
      await this.dbConnection.disconnect();
      await this.redisConnection.disconnect();
      server.close();
      logger.info('✅ P7 Agent Runtime shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the service
const agentRuntime = new P7AgentRuntime();
agentRuntime.start();

export { app };