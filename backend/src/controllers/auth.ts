import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authController = {
  /**
   * Register a new user
   */
  register: async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;

      // Check if user exists
      const existingUser = await db('users').where({ email }).first();
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create trial end date (3 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 3);

      // Create user
      const [userId] = await db('users').insert({
        name,
        email,
        password: hashedPassword,
        plan: 'free',
        trial_end_date: trialEndDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).returning('id');

      // Create token
      const token = jwt.sign(
        { id: userId },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: userId,
          name,
          email,
          plan: 'free',
          trialEndDate: trialEndDate.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  },

  /**
   * Login user
   */
  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await db('users').where({ email }).first();
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Create token
      const token = jwt.sign(
        { id: user.id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          plan: user.plan,
          trialEndDate: user.trial_end_date,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  },

  /**
   * Get current user
   */
  me: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      const user = await db('users').where({ id: userId }).first();
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        trialEndDate: user.trial_end_date,
      });
    } catch (error) {
      logger.error('Get me error:', error);
      res.status(500).json({ message: 'Server error getting user data' });
    }
  },
}; 