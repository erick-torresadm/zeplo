import { Request, Response, NextFunction } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { config } from 'dotenv';
import { databaseService } from '../services/database';
import { logError } from '../utils/logger';
import { AuthRequest, User } from '../types/user';
import { logger } from '../utils/logger';

config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const API_KEY = process.env.API_KEY || 'your-api-key';

export const generateToken = (user: { id: number; email: string }) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET as Secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Modo de desenvolvimento: permitir acesso sem verificação
  // Criando um usuário fake para desenvolvimento
  (req as any).user = { 
    id: 1, 
    email: 'admin@example.com',
    name: 'Admin User'
  };
  return next();
  
  /* Autenticação normal (comentada para desenvolvimento)
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET as Secret) as jwt.JwtPayload;
    
    // Add user to request
    (req as any).user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
  */
};

export function checkPlan(requiredPlan: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Here you would check the user's plan from the database
      // For now, we'll just allow 'basic' plan
      if (requiredPlan === 'basic') {
        return next();
      }

      return res.status(403).json({ error: 'Plan upgrade required' });
    } catch (error) {
      logger.error('Plan check error:', error);
      return res.status(500).json({ error: 'Error checking plan' });
    }
  };
}

export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  // Modo de desenvolvimento: permitir acesso sem verificação de API key
  return next();
  
  /* Validação normal de API key (comentada para desenvolvimento)
  const apiKey = req.header('x-api-key');

  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ message: 'Invalid API key' });
  }

  next();
  */
}; 