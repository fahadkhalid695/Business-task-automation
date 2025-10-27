import { Request, Response } from "express";
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

// Mock user data (replace with database in production)
const users = [
  {
    id: '1',
    email: 'admin@example.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'admin'
  },
  {
    id: '2',
    email: 'user@example.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'user'
  }
];

// Login
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Find user
      const user = users.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
);

// Register
router.post('/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Check if user exists
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists'
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const newUser = {
        id: (users.length + 1).toString(),
        email,
        password: hashedPassword,
        role: 'user'
      };
      
      users.push(newUser);
      
      // Generate JWT
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }
);

export default router;
