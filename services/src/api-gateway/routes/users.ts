import { Router } from 'express';
import { authenticate, authorize } from '../../shared/utils/auth';
import { Permission } from '../../shared/types';
import { handleAsyncError } from '../../shared/utils/errors';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// User routes
router.get('/', authorize(Permission.MANAGE_USERS), handleAsyncError(async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Users endpoint - implementation pending'
  });
}));

export { router as userRoutes };