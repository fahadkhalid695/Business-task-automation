import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectDatabase } from '../shared/database/connection';
import { Logger } from '../shared/utils/logger';
import { setupMonitoring, shutdownMonitoring } from '../shared/utils/monitoringIntegration';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { healthCheck } from './middleware/healthCheck';
import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';
import { workflowRoutes } from './routes/workflows';
import { userRoutes } from './routes/users';
import { integrationRoutes } from './routes/integrations';
import { analyticsRoutes } from './routes/analytics';
import { aiRoutes } from './routes/ai';
import { projectManagementRoutes } from './routes/project-management';
import { financeHRRoutes } from './routes/finance-hr';
import monitoringRoutes from './routes/monitoring';
import { setupWebSocket } from './websocket';

const logger = new Logger('APIGateway');

export class APIGateway {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3001",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Setup comprehensive monitoring and error handling first
    setupMonitoring(this.app);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3001",
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Trace-Id', 'X-Span-Id']
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Additional logging (morgan for basic HTTP logs)
    this.app.use(morgan('combined'));
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(rateLimiter);

    // Legacy health check (new monitoring endpoints are set up by setupMonitoring)
    this.app.use('/health-legacy', healthCheck);
  }

  private setupRoutes(): void {
    // API versioning
    const v1Router = express.Router();
    
    // Mount route handlers
    v1Router.use('/auth', authRoutes);
    v1Router.use('/tasks', taskRoutes);
    v1Router.use('/workflows', workflowRoutes);
    v1Router.use('/users', userRoutes);
    v1Router.use('/integrations', integrationRoutes);
    v1Router.use('/analytics', analyticsRoutes);
    v1Router.use('/ai', aiRoutes);
    v1Router.use('/project-management', projectManagementRoutes);
    v1Router.use('/finance-hr', financeHRRoutes);
    v1Router.use('/monitoring', monitoringRoutes);

    // Mount versioned routes
    this.app.use('/api/v1', v1Router);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Business Task Automation API Gateway',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: '/api/v1',
          docs: '/api/v1/docs'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.originalUrl} not found`,
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    });
  }

  private setupWebSocket(): void {
    setupWebSocket(this.io);
  }

  private setupErrorHandling(): void {
    // Error handling is now set up by setupMonitoring()
    // Just add process handlers for graceful shutdown
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.shutdown();
    });
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await connectDatabase();
      
      // Start server
      this.server.listen(this.port, () => {
        logger.info(`API Gateway started on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3001'}`);
      });
    } catch (error) {
      logger.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down API Gateway...');
    
    try {
      // Shutdown monitoring systems first
      await shutdownMonitoring();
      
      // Close WebSocket connections
      this.io.close();
      
      // Close HTTP server
      this.server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const gateway = new APIGateway();
  gateway.start();
}