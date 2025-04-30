import axios from 'axios';
import { Flow } from '@/types/flow';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer demo-token-no-auth-needed'
  },
});

// Auth API endpoints
export const authApi = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => 
    api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
};

// Flow API endpoints
export const flowApi = {
  getFlows: () => api.get<Flow[]>('/flows'),
  getFlow: (id: string) => api.get<Flow>(`/flows/${id}`),
  createFlow: (data: Partial<Flow>) => api.post<Flow>('/flows', data),
  updateFlow: (id: string, data: Partial<Flow>) => api.put<Flow>(`/flows/${id}`, data),
  deleteFlow: (id: string) => api.delete(`/flows/${id}`),
  publishFlow: (id: string) => api.post(`/flows/${id}/publish`),
};

// WhatsApp API endpoints
export const whatsappApi = {
  getInstances: () => api.get('/instances'),
  createInstance: (name: string) => api.post('/instances', { name }),
  connectInstance: (id: string) => api.post(`/instances/${id}/connect`),
  getQRCode: (id: string) => api.get(`/instances/${id}/qrcode`),
  sendMessage: (instanceId: string, to: string, message: string) => 
    api.post(`/instances/${instanceId}/messages`, { to, message }),
  sendMediaMessage: (instanceId: string, to: string, mediaUrl: string, caption?: string, type?: string) => 
    api.post(`/instances/${instanceId}/media`, { to, mediaUrl, caption, type }),
};

// Media API endpoints
export const mediaApi = {
  getMedia: () => api.get('/media'),
  uploadMedia: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteMedia: (id: string) => api.delete(`/media/${id}`),
};

// Contacts API endpoints
export const contactsApi = {
  getContacts: () => api.get('/contacts'),
  getContact: (id: string) => api.get(`/contacts/${id}`),
  createContact: (data: any) => api.post('/contacts', data),
  updateContact: (id: string, data: any) => api.put(`/contacts/${id}`, data),
  deleteContact: (id: string) => api.delete(`/contacts/${id}`),
};

export default api; 