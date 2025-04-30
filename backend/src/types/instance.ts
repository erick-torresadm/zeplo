export interface Instance {
  id: number;
  name: string;
  userId: number;
  instanceKey: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppInstance {
  id: string;
  instanceName: string;
  token: string;
  status: string;
}

export interface InstanceCreateInput {
  user_id: number;
  name: string;
  evolution_instance_name: string;
} 