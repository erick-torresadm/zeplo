import { User } from '@/types/auth';
import api from './api';

export async function getCurrentUser(): Promise<User> {
  const response = await api.get('/users/me');
  return response.data;
}

export async function login(username: string, password: string) {
  const response = await api.post('/api/login', { username, password });
  return response.data;
}

export async function logout() {
  await api.post('/auth/logout');
} 