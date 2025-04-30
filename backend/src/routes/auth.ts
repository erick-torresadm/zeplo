import { Router } from 'express';
import { authController } from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

// Register new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Get current user
router.get('/me', authenticate, authController.me);

export default router; 