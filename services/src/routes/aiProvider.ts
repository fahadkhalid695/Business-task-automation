import { Request, Response } from "express";
import { Router } from 'express';
import { unifiedAiService, AIProvider } from '../services/unifiedAiService';
import { auth, requirePermission, Permission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body, query } from 'express-validator';
import { ValidationService } from '../utils/validation';
import { AuditLogger } from '../utils/auditLogger';

const router = Router();
const auditLogger = new AuditLogger();

// Get current AI provider status
router.get('/status', auth, async (req, res) => {
  try {
    const status = await unifiedAiService.getProviderStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get AI provider status',
      error: error.message
    });
  }
});

// Switch AI provider
router.post('/switch', 
  auth,
  requirePermission(Permission.AI_PROVIDER_SWITCH),
  [
    body('provider')
      .isIn(['openai', 'grok'])
      .withMessage('Provider must be either "openai" or "grok"')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { provider } = req.body as { provider: AIProvider };
      
      await unifiedAiService.switchProvider(provider);
      
      res.json({
        success: true,
        message: `AI provider switched to ${provider}`,
        data: {
          currentProvider: provider
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to switch AI provider',
        error: error.message
      });
    }
  }
);

// Test AI provider with a simple request
router.post('/test',
  auth,
  [
    body('prompt')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Prompt must be a string between 1 and 500 characters')
      .custom((value) => {
        ValidationService.validatePrompt(value);
        return true;
      }),
    body('provider')
      .optional()
      .isIn(['openai', 'grok'])
      .withMessage('Provider must be either "openai" or "grok"')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { prompt, provider } = req.body;
      
      // Sanitize prompt
      const sanitizedPrompt = ValidationService.sanitizeString(prompt, 500);
      
      // Temporarily switch provider if specified
      const originalProvider = unifiedAiService.getCurrentProvider();
      if (provider && provider !== originalProvider) {
        await unifiedAiService.switchProvider(provider);
      }
      
      const startTime = Date.now();
      const response = await unifiedAiService.generateText(sanitizedPrompt, {
        maxTokens: 100,
        temperature: 0.7
      });
      const responseTime = Date.now() - startTime;
      
      // Log AI usage
      auditLogger.logDataAccess({
        userId: req.user!.id,
        resource: 'ai-provider-test',
        action: 'CREATE',
        ip: req.ip || 'unknown'
      });
      
      // Switch back to original provider if we changed it
      if (provider && provider !== originalProvider) {
        await unifiedAiService.switchProvider(originalProvider);
      }
      
      res.json({
        success: true,
        data: {
          prompt,
          response,
          provider: provider || originalProvider,
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'AI provider test failed',
        error: error.message
      });
    }
  }
);

// Health check for all providers
router.get('/health', auth, async (req, res) => {
  try {
    const health = await unifiedAiService.healthCheck();
    
    const allHealthy = Object.values(health).some(status => status);
    
    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: {
        providers: health,
        currentProvider: unifiedAiService.getCurrentProvider(),
        hasHealthyProvider: allHealthy
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Generate text with specific provider
router.post('/generate',
  auth,
  [
    body('prompt')
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Prompt must be a string between 1 and 2000 characters'),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object'),
    body('provider')
      .optional()
      .isIn(['openai', 'grok'])
      .withMessage('Provider must be either "openai" or "grok"')
  ],
  validate,
  async (req, res) => {
    try {
      const { prompt, options = {}, provider } = req.body;
      
      // Temporarily switch provider if specified
      const originalProvider = unifiedAiService.getCurrentProvider();
      if (provider && provider !== originalProvider) {
        await unifiedAiService.switchProvider(provider);
      }
      
      const startTime = Date.now();
      const response = await unifiedAiService.generateText(prompt, options);
      const responseTime = Date.now() - startTime;
      
      // Switch back to original provider if we changed it
      if (provider && provider !== originalProvider) {
        await unifiedAiService.switchProvider(originalProvider);
      }
      
      res.json({
        success: true,
        data: {
          prompt,
          response,
          provider: provider || originalProvider,
          responseTime: `${responseTime}ms`,
          options
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Text generation failed',
        error: error.message
      });
    }
  }
);

// Grok-specific code generation endpoint
router.post('/generate-code',
  auth,
  [
    body('description')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Description must be a string between 1 and 1000 characters'),
    body('language')
      .optional()
      .isString()
      .withMessage('Language must be a string')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { description, language = 'javascript' } = req.body;
      
      const startTime = Date.now();
      const code = await unifiedAiService.generateCode(description, language);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          description,
          language,
          code,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Code generation failed',
        error: error.message
      });
    }
  }
);

export default router;
