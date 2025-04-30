import axios from 'axios';
import db from '../config/db';
import redis from '../config/redis';
import { logger } from '../utils/logger';
import { logError, logInfo } from '../utils/logger';
import { Instance } from '../types/instance';
import { InstanceDto } from '../dtos/instance.dto';

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  token: string;
  status: string;
}

export class WhatsAppService {
  private evolutionApiUrl: string;
  private evolutionApiKey: string;

  constructor() {
    if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
      throw new Error('Evolution API configuration is missing');
    }
    this.evolutionApiUrl = process.env.EVOLUTION_API_URL;
    this.evolutionApiKey = process.env.EVOLUTION_API_KEY;
  }

  private async evolutionApiRequest(method: string, endpoint: string, data?: any) {
    try {
      const response = await axios({
        method,
        url: `${this.evolutionApiUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.evolutionApiKey
        },
        data
      });
      return response.data;
    } catch (error) {
      logger.error('Evolution API request failed:', error);
      throw new Error('Failed to communicate with Evolution API');
    }
  }

  async getAllInstances(userId: number): Promise<Instance[]> {
    return await db('instances')
      .where({ userId })
      .select('*');
  }

  async createInstance(name: string, userId: number): Promise<Instance> {
    const instanceKey = `instance_${Date.now()}`;

    // Create instance in Evolution API
    await this.evolutionApiRequest('POST', '/instance/create', {
      instanceName: instanceKey,
      token: instanceKey,
      webhook: `${process.env.API_URL}/webhooks/${instanceKey}`
    });

    // Create instance in database
    const [instance] = await db('instances')
      .insert({
        name,
        userId,
        instanceKey,
        status: 'disconnected'
      })
      .returning('*');

    return instance;
  }

  async getInstanceStatus(id: number): Promise<any> {
    const instance = await db('instances')
      .where({ id })
      .first();

    if (!instance) {
      throw new Error('Instance not found');
    }

    // Get status from Evolution API
    const status = await this.evolutionApiRequest('GET', `/instance/connectionState/${instance.instanceKey}`);

    // Cache status in Redis
    await redis.set(`instance:${id}:status`, JSON.stringify(status), 'EX', 60);

    return status;
  }

  async connectInstance(id: number): Promise<boolean> {
    const instance = await db('instances')
      .where({ id })
      .first();

    if (!instance) {
      throw new Error('Instance not found');
    }

    // Connect instance in Evolution API
    await this.evolutionApiRequest('POST', `/instance/connect/${instance.instanceKey}`);

    // Update status in database
    await db('instances')
      .where({ id })
      .update({
        status: 'connecting',
        updatedAt: new Date()
      });

    return true;
  }

  async disconnectInstance(id: number): Promise<boolean> {
    const instance = await db('instances')
      .where({ id })
      .first();

    if (!instance) {
      throw new Error('Instance not found');
    }

    // Disconnect instance in Evolution API
    await this.evolutionApiRequest('DELETE', `/instance/logout/${instance.instanceKey}`);

    // Update status in database
    await db('instances')
      .where({ id })
      .update({
        status: 'disconnected',
        updatedAt: new Date()
      });

    return true;
  }

  async deleteInstance(id: number, userId: number): Promise<void> {
    const instance = await db('instances')
      .where({ id, userId })
      .first();

    if (!instance) {
      throw new Error('Instance not found');
    }

    // Delete instance from Evolution API
    await this.evolutionApiRequest('DELETE', `/instance/delete/${instance.instanceKey}`);

    // Delete instance from database
    await db('instances')
      .where({ id })
      .delete();

    // Clear Redis cache
    await redis.del(`instance:${id}:status`);
  }

  async getQRCode(instanceId: number) {
    try {
      const instance = await db('instances')
        .where({ id: instanceId })
        .first();
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      const response = await this.evolutionApiRequest('GET', `/instance/qrcode/${instance.instanceKey}`);

      return response.qrcode;
    } catch (error) {
      logError('Erro ao obter QR Code', error);
      throw error;
    }
  }

  async sendMessage(instanceId: number, to: string, message: string): Promise<boolean> {
    try {
      const instance = await db('instances')
        .where({ id: instanceId })
        .first();
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      // Verificar se o número está no WhatsApp
      const verifyResponse = await this.evolutionApiRequest('GET', `/misc/onWhatsapp/${instance.instanceKey}`, {
        params: { number: to }
      });

      if (!verifyResponse.numberExists) {
        throw new Error('Número não encontrado no WhatsApp');
      }

      const response = await this.evolutionApiRequest('POST', `/message/sendText/${instance.instanceKey}`, {
        number: to,
        textMessage: message
      });

      if (response.status) {
        // Registrar mensagem no histórico
        await db('message_history')
          .insert({
            userId: instance.userId,
            instanceId,
            direction: 'outgoing',
            status: 'sent',
            phone: to,
            content: message
          });

        return true;
      }

      return false;
    } catch (error) {
      logError('Erro ao enviar mensagem', error);
      throw error;
    }
  }

  async sendMediaMessage(
    instanceId: number,
    to: string,
    mediaUrl: string,
    caption: string = '',
    type: 'image' | 'video' | 'audio' | 'document' = 'image'
  ): Promise<boolean> {
    try {
      const instance = await db('instances')
        .where({ id: instanceId })
        .first();
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      const endpoint = `/message/send${type.charAt(0).toUpperCase() + type.slice(1)}/${instance.instanceKey}`;
      const response = await this.evolutionApiRequest('POST', endpoint, {
        number: to,
        url: mediaUrl,
        caption
      });

      if (response.status) {
        // Registrar mensagem no histórico
        await db('message_history')
          .insert({
            userId: instance.userId,
            instanceId,
            direction: 'outgoing',
            status: 'sent',
            phone: to,
            content: caption,
            mediaUrl
          });

        return true;
      }

      return false;
    } catch (error) {
      logError('Erro ao enviar mensagem com mídia', error);
      throw error;
    }
  }

  async handleWebhook(event: string, data: any) {
    try {
      logInfo(`Webhook recebido: ${event}`, { data });

      switch (event) {
        case 'QRCODE_UPDATED':
          // Atualizar QR Code no banco de dados ou emitir evento
          break;

        case 'CONNECTION_UPDATE':
          // Atualizar status da conexão
          if (data.instance && data.status) {
            const instance = await db('instances')
              .where({ instance: data.instance })
              .first();
            if (instance) {
              await db('instances')
                .where({ id: instance.id })
                .update({
                  status: data.status
                });
            }
          }
          break;

        case 'MESSAGES_UPSERT':
          // Processar mensagem recebida
          if (data.instance && data.message) {
            const instance = await db('instances')
              .where({ instance: data.instance })
              .first();
            if (instance) {
              await db('message_history')
                .insert({
                  userId: instance.userId,
                  instanceId: instance.id,
                  direction: 'incoming',
                  status: 'received',
                  phone: data.message.from,
                  content: data.message.body,
                  mediaUrl: data.message.mediaUrl
                });
            }
          }
          break;
      }
    } catch (error) {
      logError('Erro ao processar webhook', error);
    }
  }

  async processWebhook(data: any): Promise<void> {
    try {
      const { instanceName, status } = data;
      const instance = await db('instances')
        .where({ name: instanceName })
        .first();
      
      if (instance) {
        await db('instances')
          .where({ id: instance.id })
          .update({
            status
          });
      }
    } catch (error) {
      throw new Error('Erro ao processar webhook');
    }
  }
}

export const whatsAppService = new WhatsAppService();
export default whatsAppService; 