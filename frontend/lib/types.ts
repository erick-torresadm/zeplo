// Flow Node Types
export type NodeType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'start';

export interface FlowNode {
  id: string;
  type: NodeType;
  position: {
    x: number;
    y: number;
  };
  data: {
    content: string;
    mediaUrl?: string;
    caption?: string;
    delay?: number; // delay in milliseconds
  };
}

export interface FlowConnection {
  id: string;
  source: string;
  target: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  triggerKeyword?: string;
}

// WhatsApp Instance Types
export interface WhatsAppInstance {
  id: string;
  name: string;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode?: string;
}

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'basic' | 'premium' | 'business';
  createdAt: string;
  trialEndDate?: string;
}

// Media Types
export interface Media {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
} 