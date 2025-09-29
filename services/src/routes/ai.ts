import { Request, Response } from "express";
import { Router } from 'express';
import { unifiedAiService } from '../services/unifiedAiService';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';

const router = Router();

// Generate text
router.post('/generate-text',
  auth,
  [
    body('prompt')
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Prompt must be a string between 1 and 2000 characters'),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { prompt, options = {} } = req.body;
      
      const startTime = Date.now();
      const response = await unifiedAiService.generateText(prompt, options);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          prompt,
          response,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
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

// Analyze text
router.post('/analyze-text',
  auth,
  [
    body('text')
      .isString()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Text must be a string between 1 and 5000 characters')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      const startTime = Date.now();
      const analysis = await unifiedAiService.analyzeText(text);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          text,
          analysis,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Text analysis failed',
        error: error.message
      });
    }
  }
);

// Classify text
router.post('/classify-text',
  auth,
  [
    body('text')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Text must be a string between 1 and 1000 characters'),
    body('categories')
      .isArray({ min: 2 })
      .withMessage('Categories must be an array with at least 2 items')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { text, categories } = req.body;
      
      const startTime = Date.now();
      const classification = await unifiedAiService.classifyText(text, categories);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          text,
          categories,
          classification,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Text classification failed',
        error: error.message
      });
    }
  }
);

// Generate summary
router.post('/summarize',
  auth,
  [
    body('text')
      .isString()
      .isLength({ min: 100, max: 10000 })
      .withMessage('Text must be a string between 100 and 10000 characters')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      const startTime = Date.now();
      const summary = await unifiedAiService.generateSummary(text);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          originalText: text,
          summary,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Text summarization failed',
        error: error.message
      });
    }
  }
);

// Translate text
router.post('/translate',
  auth,
  [
    body('text')
      .isString()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Text must be a string between 1 and 5000 characters'),
    body('targetLanguage')
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('Target language must be specified')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage } = req.body;
      
      const startTime = Date.now();
      const translation = await unifiedAiService.translateText(text, targetLanguage);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          originalText: text,
          targetLanguage,
          translation,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Translation failed',
        error: error.message
      });
    }
  }
);

// Generate workflow suggestions
router.post('/workflow-suggestions',
  auth,
  [
    body('description')
      .isString()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be a string between 10 and 1000 characters')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { description } = req.body;
      
      const startTime = Date.now();
      const suggestions = await unifiedAiService.generateWorkflowSuggestions(description);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          description,
          suggestions,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Workflow suggestions failed',
        error: error.message
      });
    }
  }
);

// Optimize workflow
router.post('/optimize-workflow',
  auth,
  [
    body('workflow')
      .isObject()
      .withMessage('Workflow must be an object')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { workflow } = req.body;
      
      const startTime = Date.now();
      const optimizedWorkflow = await unifiedAiService.optimizeWorkflow(workflow);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          originalWorkflow: workflow,
          optimizedWorkflow,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Workflow optimization failed',
        error: error.message
      });
    }
  }
);

// Detect anomalies
router.post('/detect-anomalies',
  auth,
  [
    body('data')
      .isArray()
      .withMessage('Data must be an array')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { data } = req.body;
      
      const startTime = Date.now();
      const anomalies = await unifiedAiService.detectAnomalies(data);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          dataSize: data.length,
          anomalies,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Anomaly detection failed',
        error: error.message
      });
    }
  }
);

// Generate insights
router.post('/generate-insights',
  auth,
  [
    body('data')
      .isObject()
      .withMessage('Data must be an object')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { data } = req.body;
      
      const startTime = Date.now();
      const insights = await unifiedAiService.generateInsights(data);
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          insights,
          provider: unifiedAiService.getCurrentProvider(),
          responseTime: `${responseTime}ms`
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Insights generation failed',
        error: error.message
      });
    }
  }
);

export default router;
