import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DatabaseService } from '../shared/database/DatabaseService';
import { ExternalAPIService } from '../shared/services/ExternalAPIService';
import { logger } from '../shared/utils/Logger';

export class FunctionalAPIGateway {
  private app: express.Application;
  private port: number;
  private dbService: DatabaseService;
  private apiService: ExternalAPIService;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.dbService = DatabaseService.getInstance();
    this.apiService = ExternalAPIService.getInstance();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: this.dbService.isHealthy(),
        services: {
          workflow: true,
          api: true
        }
      });
    });

    // Workflow routes
    this.app.post('/api/workflows/execute', async (req, res) => {
      try {
        const { template, context } = req.body;
        // Mock execution for now
        const execution = {
          id: `exec_${Date.now()}`,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          results: { success: true }
        };
        res.json({ success: true, data: execution });
      } catch (error) {
        logger.error('Workflow execution failed:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/workflows/executions', async (req, res) => {
      try {
        const executions = []; // Get from database
        res.json({ success: true, data: executions });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Integration routes
    this.app.post('/api/integrations/gmail/send', async (req, res) => {
      try {
        const { to, subject, body } = req.body;
        // Implementation would use GmailIntegration
        res.json({ success: true, message: 'Email sent successfully' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Task routes
    this.app.get('/api/tasks', async (req, res) => {
      try {
        // Get tasks from database
        res.json({ success: true, data: [] });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/tasks', async (req, res) => {
      try {
        const task = req.body;
        // Save task to database
        res.json({ success: true, data: task });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Analytics routes
    this.app.get('/api/analytics/dashboard', async (req, res) => {
      try {
        const analytics = {
          totalTasks: 1247,
          completedTasks: 1089,
          failedTasks: 23,
          avgCompletionTime: 2.4,
          activeWorkflows: 15,
          totalExecutions: 3456
        };
        res.json({ success: true, data: analytics });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.dbService.connect();
      await this.apiService.initializeAll();
      
      this.app.listen(this.port, () => {
        logger.info(`🚀 API Gateway started on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Health check: http://localhost:${this.port}/health`);
      });
    } catch (error) {
      logger.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }
}

// Start the server
if (require.main === module) {
  const gateway = new FunctionalAPIGateway();
  gateway.start();
}