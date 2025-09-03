import { Router } from 'express';
import { authenticate, authorize } from '../../shared/utils/auth';
import { Permission } from '../../shared/types';
import { handleAsyncError } from '../../shared/utils/errors';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Integration routes
router.get('/', authorize(Permission.MANAGE_INTEGRATIONS), handleAsyncError(async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Integrations endpoint - implementation pending'
  });
}));

export { router as integrationRoutes };