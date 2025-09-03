import { Request, Response } from 'express';
import { UserModel } from '../../shared/models/User';
import { generateToken, AuthRequest } from '../../shared/utils/auth';
import { validateSchema, schemas } from '../../shared/utils/validation';
import { AuthenticationError, ValidationError, ConflictError } from '../../shared/utils/errors';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('AuthController');

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = validateSchema(schemas.user, req.body);

    const user = await UserModel.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const token = generateToken(user);

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      }
    });
  }

  async register(req: Request, res: Response): Promise<void> {
    const userData = validateSchema(schemas.user, req.body);

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: userData.email });
    if (existingUser) {
      throw new ConflictError('User already exists with this email');
    }

    const user = await UserModel.create(userData);
    const token = generateToken(user);

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      }
    });
  }

  async refreshToken(req: AuthRequest, res: Response): Promise<void> {
    // This would implement refresh token logic
    // For now, just return the current user
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const token = generateToken(req.user);

    res.json({
      success: true,
      data: {
        user: req.user.toJSON(),
        token
      }
    });
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    // In a real implementation, you might want to blacklist the token
    logger.info('User logged out', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }

  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    res.json({
      success: true,
      data: req.user.toJSON()
    });
  }
}