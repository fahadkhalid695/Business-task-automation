import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';

const router = Router();

// Mock users data
const users = [
  {
    id: '1',
    email: 'admin@example.com',
    role: 'admin',
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      avatar: null,
      timezone: 'UTC',
      language: 'en'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    email: 'user@example.com',
    role: 'user',
    profile: {
      firstName: 'Regular',
      lastName: 'User',
      avatar: null,
      timezone: 'UTC',
      language: 'en'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = users.find(u => u.id === req.user?.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove sensitive data
    const { ...userProfile } = user;
    
    res.json({
      success: true,
      data: userProfile
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message
    });
  }
});

// Update current user profile
router.put('/profile',
  auth,
  [
    body('profile.firstName')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be a string between 1 and 50 characters'),
    body('profile.lastName')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be a string between 1 and 50 characters'),
    body('profile.timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a string'),
    body('profile.language')
      .optional()
      .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'])
      .withMessage('Language must be a supported language code')
  ],
  validate,
  async (req, res) => {
    try {
      const userIndex = users.findIndex(u => u.id === req.user?.id);
      
      if (userIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const updatedUser = {
        ...users[userIndex],
        profile: {
          ...users[userIndex].profile,
          ...req.body.profile
        },
        updatedAt: new Date().toISOString()
      };
      
      users[userIndex] = updatedUser;
      
      res.json({
        success: true,
        data: updatedUser
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update user profile',
        error: error.message
      });
    }
  }
);

// Get all users (admin only)
router.get('/', auth, requireRole(['admin']), async (req, res) => {
  try {
    const allUsers = users.map(user => {
      const { ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json({
      success: true,
      data: allUsers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get user by ID (admin only)
router.get('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const user = users.find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const { ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// Update user role (admin only)
router.put('/:id/role',
  auth,
  requireRole(['admin']),
  [
    body('role')
      .isIn(['admin', 'user'])
      .withMessage('Role must be either admin or user')
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      const userIndex = users.findIndex(u => u.id === id);
      
      if (userIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      users[userIndex] = {
        ...users[userIndex],
        role,
        updatedAt: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: users[userIndex]
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update user role',
        error: error.message
      });
    }
  }
);

// Delete user (admin only)
router.delete('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    users.splice(userIndex, 1);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

export default router;