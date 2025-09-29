import { Request, Response } from "express";
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';
import { unifiedAiService } from '../services/unifiedAiService';

const router = Router();

// Mock workflows data
let workflows = [
  {
    id: '1',
    name: 'Sample Workflow',
    description: 'A sample workflow for demonstration',
    steps: [
      {
        id: 'step1',
        name: 'Data Collection',
        type: 'trigger',
        description: 'Collect data from various sources',
        order: 0,
        config: {}
      },
      {
        id: 'step2',
        name: 'Data Processing',
        type: 'action',
        description: 'Process and clean the collected data',
        order: 1,
        config: {}
      }
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: '1'
  }
];

// Get all workflows
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const userWorkflows = workflows.filter(workflow => workflow.userId === req.user?.id);
    
    res.json({
      success: true,
      data: userWorkflows
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error.message
    });
  }
});

// Get workflow by ID
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = workflows.find(w => w.id === id && w.userId === req.user?.id);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow',
      error: error.message
    });
  }
});

// Create workflow
router.post('/',
  auth,
  [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be a string between 1 and 100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be a string with max 500 characters'),
    body('steps')
      .isArray({ min: 1 })
      .withMessage('Steps must be an array with at least 1 step')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { name, description, steps } = req.body;
      
      const newWorkflow = {
        id: (workflows.length + 1).toString(),
        name,
        description: description || '',
        steps,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: req.user?.id || '1'
      };
      
      workflows.push(newWorkflow);
      
      res.status(201).json({
        success: true,
        data: newWorkflow
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create workflow',
        error: error.message
      });
    }
  }
);

// Update workflow
router.put('/:id',
  auth,
  [
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be a string between 1 and 100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be a string with max 500 characters'),
    body('status')
      .optional()
      .isIn(['draft', 'active', 'inactive', 'archived'])
      .withMessage('Status must be one of: draft, active, inactive, archived')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const workflowIndex = workflows.findIndex(w => w.id === id && w.userId === req.user?.id);
      
      if (workflowIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
      }
      
      const updatedWorkflow = {
        ...workflows[workflowIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      
      workflows[workflowIndex] = updatedWorkflow;
      
      res.json({
        success: true,
        data: updatedWorkflow
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update workflow',
        error: error.message
      });
    }
  }
);

// Delete workflow
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflowIndex = workflows.findIndex(w => w.id === id && w.userId === req.user?.id);
    
    if (workflowIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }
    
    workflows.splice(workflowIndex, 1);
    
    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete workflow',
      error: error.message
    });
  }
});

// Execute workflow
router.post('/:id/execute', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = workflows.find(w => w.id === id && w.userId === req.user?.id);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }
    
    if (workflow.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Workflow must be active to execute'
      });
    }
    
    // Mock execution
    const executionResult = {
      id: `exec-${Date.now()}`,
      workflowId: workflow.id,
      status: 'completed',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 5000).toISOString(),
      steps: workflow.steps.map(step => ({
        ...step,
        status: 'completed',
        executionTime: Math.floor(Math.random() * 1000) + 100
      }))
    };
    
    res.json({
      success: true,
      data: executionResult
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute workflow',
      error: error.message
    });
  }
});

// Get AI suggestions for workflow optimization
router.post('/:id/optimize', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = workflows.find(w => w.id === id && w.userId === req.user?.id);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }
    
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
      message: 'Failed to optimize workflow',
      error: error.message
    });
  }
});

export default router;
