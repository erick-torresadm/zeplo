/**
 * Manipulador de webhooks da Evolution API
 * 
 * Este serviço recebe e processa as notificações de webhooks
 * enviadas pela Evolution API, permitindo resposta instantânea
 * a novas mensagens sem necessidade de polling constante.
 * 
 * Atualizado para suportar múltiplos formatos da Evolution API v2
 * que podem variar dependendo da versão e configuração.
 */

import express from 'express';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { databaseService } from './database';
import { evolutionAPI } from './evolution-api';
import { FlowManager } from './flow-manager';
import { FlowExecutor } from './flow-executor';
import { WhatsAppService } from './whatsapp';
import { logError, logInfo } from '../utils/logger';
import { Instance } from '../types/instance';
import { EventEmitter } from 'events';
import * as net from 'net';

interface Flow {
  id: string;
  trigger_type?: 'keyword' | 'regex';
  trigger_value?: string;
}

interface WebhookData {
  event: string;
  data: {
    instance: {
      id: string;
    };
    message: {
      from: string;
      body: string;
      id: string;
    };
    status?: string;
  };
}

interface WebhookEvent {
  instanceName: string;
  event: string;
  data: any;
}

interface MessageData {
  instance_id: number;
  message_id: string;
  from: string;
  to: string;
  content: string;
  type: string;
  timestamp: Date;
}

class WebhookHandler extends EventEmitter {
  private server: Server | null = null;
  port: number = 3001;

  constructor() {
    super();
  }

  async handleWebhook(instanceName: string, data: any) {
    try {
      logger.info(`Received webhook for instance ${instanceName}:`, data);

      // Emit event for any listeners
      this.emit('webhook-event', { instanceName, ...data });

      // Handle different event types
      if (data.event === 'qrcode.updated') {
        await this.handleQRCodeUpdate(instanceName, data);
      } else if (data.event === 'connection.update') {
        await this.handleConnectionUpdate(instanceName, data);
      } else if (data.event === 'messages.upsert') {
        await this.handleNewMessage(instanceName, data);
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  private async handleQRCodeUpdate(instanceName: string, data: any) {
    try {
      logger.info(`QR code update received for instance: ${instanceName}`);
      
      // Find the instance in the database
      const instance = await databaseService.getInstanceByName(instanceName);
      
      if (!instance) {
        logger.warn(`Instance ${instanceName} not found in database`);
        return;
      }
      
      // Update the instance with the new QR code
      await databaseService.updateInstance(instance.id, {
        status: 'connecting'
      });
      
      // Armazenar o QR code em outro campo ou em uma tabela específica se necessário
      
    } catch (error) {
      logger.error('Error handling QR code update:', error);
    }
  }

  private async handleConnectionUpdate(instanceName: string, data: any) {
    try {
      const instance = await databaseService.getInstanceByName(instanceName);
      if (!instance) {
        logger.error(`Instance ${instanceName} not found`);
        return;
      }

      const status = data.status === 'open' ? 'connected' : 
                    data.status === 'close' ? 'disconnected' : 
                    data.status === 'connecting' ? 'connecting' : 'error';

      await databaseService.updateInstance(instance.id, { status });
    } catch (error) {
      logger.error('Error handling connection update:', error);
      throw error;
    }
  }

  private async handleNewMessage(instanceName: string, data: any) {
    try {
      logger.info(`New message received for instance: ${instanceName}`);
      
      // Find the instance in the database
      const instance = await databaseService.getInstanceByName(instanceName);
      
      if (!instance) {
        logger.warn(`Instance ${instanceName} not found in database`);
        return;
      }
      
      // Process the message
      if (data.message) {
        // Save message to history if needed
        // This requires implementing the saveMessage method in databaseService
        const messageData = {
          instance_id: instance.id,
          message_id: data.message.id,
          from: data.message.from,
          to: instanceName,
          content: data.message.body,
          type: 'text',
          timestamp: new Date()
        };
        
        // Uncomment when saveMessage is implemented
        // await databaseService.saveMessage(messageData);
      }
      
      // Process message for flows if it's incoming
      // This can be implemented later
      
    } catch (error) {
      logger.error('Error handling new message:', error);
    }
  }

  async setupWebhookServer() {
    try {
      const webhookPort = parseInt(process.env.WEBHOOK_PORT || '3001');
      
      // Verificar se a porta está disponível
      if (!await isPortAvailable(webhookPort)) {
        logger.warn(`Porta ${webhookPort} já está em uso, buscando porta alternativa...`);
        
        // Tentar encontrar uma porta alternativa
        const alternativePort = await findAvailablePort(webhookPort + 1);
        
        if (alternativePort === -1) {
          logger.error('Não foi possível iniciar o servidor de webhook: todas as portas estão ocupadas');
          return null;
        }
        
        logger.info(`Usando porta alternativa ${alternativePort} para o servidor de webhook`);
        this.port = alternativePort;
      } else {
        this.port = webhookPort;
      }
      
      // Criar o servidor Express
      const app = express();
      app.use(express.json());
      
      // Configurar endpoint de webhook
      app.post('/webhook/:event', (req, res) => {
        const { event } = req.params;
        const data = req.body;
        this.handleWebhook(event, data);
        res.status(200).send('OK');
      });
      
      // Configurar endpoint de health check
      app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date() });
      });
      
      // Iniciar o servidor
      const server = app.listen(this.port, () => {
        logger.info(`Webhook server listening on port ${this.port}`);
      });
      
      this.server = server;
      return server;
    } catch (error) {
      logger.error('Error setting up webhook server:', error);
      return null;
    }
  }

  stopWebhookServer() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  // Method added for EventEmitter functionality
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

// Função para verificar se uma porta está disponível
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Porta ${port} já está em uso`);
        resolve(false);
      } else {
        logger.error(`Erro ao verificar disponibilidade da porta ${port}:`, err);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

// Função para encontrar uma porta disponível
async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  let currentPort = startPort;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    if (await isPortAvailable(currentPort)) {
      return currentPort;
    }
    
    currentPort++;
    attempts++;
  }
  
  return -1; // Nenhuma porta disponível encontrada
}

export const webhookHandler = new WebhookHandler();
export const setupWebhookServer = () => webhookHandler.setupWebhookServer();

/**
 * Configura o webhook para uma instância na Evolution API
 */
export async function setupInstanceWebhook(instanceId: string, baseUrl: string): Promise<boolean> {
  try {
    const webhookUrl = `${baseUrl}/webhooks/${instanceId}`;
    logger.info(`Setting up webhook for instance ${instanceId} at ${webhookUrl}`);
    
    // Register webhook with Evolution API
    const result = await evolutionAPI.setWebhook(instanceId, webhookUrl);
    
    if (result.status) {
      logger.info('Webhook setup completed', {
        instanceId,
        webhookUrl
      });
      return true;
    } else {
      logger.error('Webhook setup failed', {
        instanceId,
        webhookUrl,
        error: result.message
      });
      return false;
    }
  } catch (error) {
    logger.error('Error setting up webhook:', error);
    return false;
  }
}