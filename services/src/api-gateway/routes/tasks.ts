import { Router } from 'express';
import { authenticate, authorize } from '../../shared/utils/auth';
import { Permission } from '../../shared/types';
import { handleAsyncError } from '../../shared/utils/errors';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Task routes
router.get('/', authorize(Permission.READ_TASKS), handleAsyncError(async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Tasks endpoint - implementation pending'
  });
}));

router.post('/', authorize(Permission.WRITE_TASKS), handleAsyncError(async (req, res) => {
  res.json({
    success: true,
    data: { id: 'task_123' },
    message: 'Task created - implementation pending'
  });
}));

export { router as taskRoutes };