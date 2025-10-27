import { Request, Response } from "express";
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';

const router = Router();

// Mock notifications data
let notifications = [
  {
    id: '1',
    title: 'Workflow Completed',
    message: 'Your data processing workflow has completed successfully',
    type: 'success',
    read: false,
    userId: '1',
    createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  },
  {
    id: '2',
    title: 'Task Overdue',
    message: 'Task "Review quarterly reports" is overdue',
    type: 'warning',
    read: false,
    userId: '1',
    createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
  },
  {
    id: '3',
    title: 'New Integration Available',
    message: 'Microsoft Teams integration is now available',
    type: 'info',
    read: true,
    userId: '1',
    createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  }
];

// Get all notifications for current user
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const userNotifications = notifications
      .filter(notification => notification.userId === req.user?.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({
      success: true,
      data: userNotifications
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Get unread notifications count
router.get('/unread-count', auth, async (req: Request, res: Response) => {
  try {
    const unreadCount = notifications.filter(
      notification => notification.userId === req.user?.id && !notification.read
    ).length;
    
    res.json({
      success: true,
      data: { count: unreadCount }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notificationIndex = notifications.findIndex(
      n => n.id === id && n.userId === req.user?.id
    );
    
    if (notificationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    notifications[notificationIndex].read = true;
    
    res.json({
      success: true,
      data: notifications[notificationIndex]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', auth, async (req: Request, res: Response) => {
  try {
    notifications = notifications.map(notification => 
      notification.userId === req.user?.id 
        ? { ...notification, read: true }
        : notification
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// Create notification (internal use)
router.post('/',
  auth,
  [
    body('title')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be a string between 1 and 100 characters'),
    body('message')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Message must be a string between 1 and 500 characters'),
    body('type')
      .isIn(['info', 'success', 'warning', 'error'])
      .withMessage('Type must be one of: info, success, warning, error'),
    body('userId')
      .optional()
      .isString()
      .withMessage('User ID must be a string')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { title, message, type, userId } = req.body;
      
      const newNotification = {
        id: (notifications.length + 1).toString(),
        title,
        message,
        type,
        read: false,
        userId: userId || req.user?.id || '1',
        createdAt: new Date().toISOString()
      };
      
      notifications.push(newNotification);
      
      res.status(201).json({
        success: true,
        data: newNotification
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: error.message
      });
    }
  }
);

// Delete notification
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notificationIndex = notifications.findIndex(
      n => n.id === id && n.userId === req.user?.id
    );
    
    if (notificationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    notifications.splice(notificationIndex, 1);
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

export default router;
