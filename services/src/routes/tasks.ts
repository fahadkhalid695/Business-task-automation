import { Request, Response } from "express";
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body, query } from 'express-validator';

const router = Router();

// Mock tasks data
let tasks = [
  {
    id: '1',
    title: 'Sample Task 1',
    description: 'This is a sample task',
    status: 'pending',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: '1'
  },
  {
    id: '2',
    title: 'Sample Task 2',
    description: 'Another sample task',
    status: 'completed',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: '1'
  }
];

// Get all tasks
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const userTasks = tasks.filter(task => task.userId === req.user?.id);
    
    res.json({
      success: true,
      data: userTasks
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

// Get task by ID
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = tasks.find(t => t.id === id && t.userId === req.user?.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
      error: error.message
    });
  }
});

// Create task
router.post('/',
  auth,
  [
    body('title')
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be a string between 1 and 200 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be one of: low, medium, high, critical')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { title, description, priority = 'medium' } = req.body;
      
      const newTask = {
        id: (tasks.length + 1).toString(),
        title,
        description: description || '',
        status: 'pending',
        priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: req.user?.id || '1'
      };
      
      tasks.push(newTask);
      
      res.status(201).json({
        success: true,
        data: newTask
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create task',
        error: error.message
      });
    }
  }
);

// Update task
router.put('/:id',
  auth,
  [
    body('title')
      .optional()
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be a string between 1 and 200 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters'),
    body('status')
      .optional()
      .isIn(['pending', 'in-progress', 'completed', 'cancelled'])
      .withMessage('Status must be one of: pending, in-progress, completed, cancelled'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be one of: low, medium, high, critical')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const taskIndex = tasks.findIndex(t => t.id === id && t.userId === req.user?.id);
      
      if (taskIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }
      
      const updatedTask = {
        ...tasks[taskIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      
      tasks[taskIndex] = updatedTask;
      
      res.json({
        success: true,
        data: updatedTask
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update task',
        error: error.message
      });
    }
  }
);

// Delete task
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const taskIndex = tasks.findIndex(t => t.id === id && t.userId === req.user?.id);
    
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    tasks.splice(taskIndex, 1);
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
});

export default router;
