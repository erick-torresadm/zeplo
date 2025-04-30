export interface WhatsAppInstance {
  id: string;
  instanceName: string;
  token: string;
  status: string;
}

export interface CreateInstanceDto {
  instanceName: string;
  token: string;
}

export interface UpdateInstanceDto {
  instanceName?: string;
  token?: string;
  status?: string;
}

export interface InstanceDto {
  id: number;
  name: string;
  userId: number;
  instanceKey: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  createdAt: Date;
  updatedAt: Date;
} 