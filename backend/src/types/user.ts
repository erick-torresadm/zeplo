import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  plan: string;
  trial_end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
}

export type RequestWithUser = Request & { user?: Express.User }; 