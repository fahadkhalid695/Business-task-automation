import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authRateLimiter } from '../middleware/rateLimiter';
import { handleAsyncError } from '../../shared/utils/errors';

const router = Router();
const authController = new AuthController();

// Apply rate limiting to auth routes
router.use(authRateLimiter);

// Auth routes
router.post('/login', handleAsyncError(authController.login.bind(authController)));
router.post('/register', handleAsyncError(authController.register.bind(authController)));
router.post('/refresh', handleAsyncError(authController.refreshToken.bind(authController)));
router.post('/logout', handleAsyncError(authController.logout.bind(authController)));
router.get('/me', handleAsyncError(authController.getCurrentUser.bind(authController)));

export { router as authRoutes };