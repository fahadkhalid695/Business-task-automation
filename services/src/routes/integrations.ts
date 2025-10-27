import { Request, Response } from "express";
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';

const router = Router();

// Mock integrations data
let integrations = [
  {
    id: '1',
    name: 'Slack Integration',
    type: 'communication',
    status: 'active',
    description: 'Send notifications to Slack channels',
    config: {
      webhookUrl: 'https://hooks.slack.com/services/...',
      channel: '#general'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Google Sheets',
    type: 'data',
    status: 'inactive',
    description: 'Read and write data to Google Sheets',
    config: {
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      range: 'Sheet1!A1:E'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Get all integrations
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: integrations
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch integrations',
      error: error.message
    });
  }
});

// Get integration by ID
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = integrations.find(i => i.id === id);
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
    }
    
    res.json({
      success: true,
      data: integration
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch integration',
      error: error.message
    });
  }
});

// Create integration
router.post('/',
  auth,
  [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be a string between 1 and 100 characters'),
    body('type')
      .isIn(['communication', 'data', 'automation', 'analytics'])
      .withMessage('Type must be one of: communication, data, automation, analytics'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be a string with max 500 characters'),
    body('config')
      .isObject()
      .withMessage('Config must be an object')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { name, type, description, config } = req.body;
      
      const newIntegration = {
        id: (integrations.length + 1).toString(),
        name,
        type,
        status: 'inactive',
        description: description || '',
        config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      integrations.push(newIntegration);
      
      res.status(201).json({
        success: true,
        data: newIntegration
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create integration',
        error: error.message
      });
    }
  }
);

// Update integration
router.put('/:id',
  auth,
  [
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be a string between 1 and 100 characters'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status must be either active or inactive'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be a string with max 500 characters'),
    body('config')
      .optional()
      .isObject()
      .withMessage('Config must be an object')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const integrationIndex = integrations.findIndex(i => i.id === id);
      
      if (integrationIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }
      
      const updatedIntegration = {
        ...integrations[integrationIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      
      integrations[integrationIndex] = updatedIntegration;
      
      res.json({
        success: true,
        data: updatedIntegration
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update integration',
        error: error.message
      });
    }
  }
);

// Delete integration
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integrationIndex = integrations.findIndex(i => i.id === id);
    
    if (integrationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
    }
    
    integrations.splice(integrationIndex, 1);
    
    res.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete integration',
      error: error.message
    });
  }
});

// Test integration
router.post('/:id/test', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = integrations.find(i => i.id === id);
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
    }
    
    // Mock test result
    const testResult = {
      success: Math.random() > 0.2, // 80% success rate
      message: Math.random() > 0.2 ? 'Integration test successful' : 'Integration test failed',
      responseTime: Math.floor(Math.random() * 1000) + 100,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: testResult
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to test integration',
      error: error.message
    });
  }
});

export default router;
