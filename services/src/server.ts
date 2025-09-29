import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { ConfigService } from './utils/encryption';
import { AuditLogger } from './utils/auditLogger';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import aiProviderRoutes from './routes/aiProvider';
import taskRoutes from './routes/tasks';
import workflowRoutes from './routes/workflows';
import analyticsRoutes from './routes/analytics';
import integrationRoutes from './routes/integrations';
import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';

const app = express();
const port = process.env.PORT || 3001;
const auditLogger = new AuditLogger();

// Initialize configuration service
try {
  ConfigService.getInstance();
} catch (error) {
  console.error('Configuration error:', error);
  process.exit(1);
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// General rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      auditLogger.logDataAccess({
        userId: 'system',
        resource: 'http-request',
        action: 'READ',
        ip: 'system'
      });
    }
  }
}));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-provider', aiProviderRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  auditLogger.logSecurityIncident({
    severity: 'MEDIUM',
    category: 'OTHER',
    description: 'Unhandled application error',
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent'),
    additionalData: {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    }
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal server error occurred' 
        : error.message
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Business Automation API Server running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'grok'}`);
  console.log(`🔒 Security: Enhanced security measures enabled`);
});

export default app;