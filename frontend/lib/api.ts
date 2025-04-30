import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance with defaults
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// WhatsApp API
export const whatsappApi = {
  createInstance: (name: string) => api.post('/whatsapp/instances', { name }),
  connectInstance: (instanceId: string) => api.post(`/whatsapp/instances/${instanceId}/connect`),
  getQRCode: (instanceId: string) => api.get(`/whatsapp/instances/${instanceId}/qrcode`),
  sendMessage: (instanceId: string, to: string, message: string) => 
    api.post(`/whatsapp/instances/${instanceId}/messages`, { to, message }),
  sendMediaMessage: (instanceId: string, to: string, mediaUrl: string, caption?: string) => 
    api.post(`/whatsapp/instances/${instanceId}/media`, { to, mediaUrl, caption }),
};

// Flow API
export const flowApi = {
  createFlow: (data: any) => api.post('/flows', data),
  getFlow: (flowId: string) => api.get(`/flows/${flowId}`),
  updateFlow: (flowId: string, data: any) => api.put(`/flows/${flowId}`, data),
  deleteFlow: (flowId: string) => api.delete(`/flows/${flowId}`),
  publishFlow: (flowId: string) => api.post(`/flows/${flowId}/publish`),
};

export default api; 