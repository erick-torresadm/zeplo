import React, { createContext, useEffect, useState, useContext } from 'react';
import { api } from '../lib/axios';
import { useLocation } from 'wouter';

interface User {
  id: string;
  name: string;
  email: string;
}

interface RegisterData {
  username: string;
  name: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  register: (data: RegisterData) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const isAuthenticated = !!user;

  useEffect(() => {
    const token = localStorage.getItem('@flowmanager:token');

    if (token) {
      api.defaults.headers.authorization = `Bearer ${token}`;
      loadUser();
    }

    setLoading(false);
  }, []);

  async function loadUser() {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      logout();
    }
  }

  async function register(data: RegisterData) {
    try {
      const response = await api.post('/auth/register', data);
      const { user, token } = response.data;

      api.defaults.headers.authorization = `Bearer ${token}`;
      localStorage.setItem('@flowmanager:token', token);

      setUser(user);
      setLocation('/dashboard');
    } catch (error) {
      console.error('Erro ao registrar:', error);
      throw error;
    }
  }

  async function login(username: string, password: string) {
    try {
      const response = await api.post('/api/login', { username, password });
      const { user, token } = response.data;

      api.defaults.headers.authorization = `Bearer ${token}`;
      localStorage.setItem('@flowmanager:token', token);

      setUser(user);
      setLocation('/dashboard');
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('@flowmanager:token');
    delete api.defaults.headers.authorization;
    setLocation('/');
  }

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
} 