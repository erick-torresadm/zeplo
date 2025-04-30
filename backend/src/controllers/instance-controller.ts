import { Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { reconnectIfNeeded } from '../database/connection';
import evolutionAPI from '../services/evolution-api';
import { v4 as uuidv4 } from 'uuid';

/**
 * Controlador para gerenciar instâncias do WhatsApp
 */
export class InstanceController {
  
  /**
   * Lista todas as instâncias
   */
  async listInstances(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info('Listando instâncias', { userId });
      
      let query = db('instances');
      if (userId) {
        query = query.where({ user_id: userId });
      }
      
      const instances = await query.select('*');
      
      // Buscar status atualizado das instâncias via Evolution API (opcional, dependendo do caso de uso)
      try {
        const evolutionResponse = await evolutionAPI.getAllInstances();
        if (evolutionResponse.status && evolutionResponse.data) {
          const evolutionInstances = evolutionResponse.data;
          
          // Atualizar status das instâncias com os dados da Evolution API
          for (const instance of instances) {
            const evolutionInstance = evolutionInstances.find(
              (ei) => ei.instanceName === instance.name
            );
            
            if (evolutionInstance) {
              instance.status = evolutionInstance.status;
              
              // Atualizar status no banco em background
              db('instances')
                .where({ id: instance.id })
                .update({ 
                  status: evolutionInstance.status,
                  updated_at: new Date()
                })
                .catch(err => logger.error(`Erro ao atualizar status da instância ${instance.id}:`, err));
            }
          }
        }
      } catch (error) {
        logger.warn('Não foi possível atualizar status das instâncias via Evolution API:', error);
        // Não vai atrapalhar o fluxo principal, apenas logar o erro
      }
      
      logger.info(`Encontradas ${instances.length} instâncias`);
      res.json(instances);
    } catch (error: any) {
      logger.error('Erro ao listar instâncias:', error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao listar instâncias',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Obtém uma instância pelo ID
   */
  async getInstanceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Buscando instância com ID ${id}`, { userId });
      
      const instance = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instance) {
        logger.warn(`Instância com ID ${id} não encontrada`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      // Buscar status atualizado da instância via Evolution API
      try {
        const evolutionResponse = await evolutionAPI.getInstance(instance.name);
        if (evolutionResponse.status && evolutionResponse.data) {
          instance.status = evolutionResponse.data.status;
          
          // Atualizar status no banco em background
          db('instances')
            .where({ id: instance.id })
            .update({ 
              status: evolutionResponse.data.status,
              updated_at: new Date()
            })
            .catch(err => logger.error(`Erro ao atualizar status da instância ${instance.id}:`, err));
        }
      } catch (error) {
        logger.warn(`Não foi possível atualizar status da instância ${instance.name} via Evolution API:`, error);
        // Não vai atrapalhar o fluxo principal, apenas logar o erro
      }
      
      logger.info(`Instância ${id} encontrada`);
      res.json(instance);
    } catch (error: any) {
      logger.error(`Erro ao obter instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao obter instância',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Cria uma nova instância
   */
  async createInstance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      const { name, description } = req.body;
      
      logger.info('Criando nova instância', { name, userId });
      
      // Validação básica
      if (!name) {
        logger.warn('Validação falhou: Nome é obrigatório');
        res.status(400).json({ message: 'Nome é obrigatório' });
        return;
      }
      
      // Verificar se já existe instância com este nome
      const existingInstance = await db('instances')
        .where({ name })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (existingInstance) {
        logger.warn(`Instância com nome ${name} já existe`, { existingId: existingInstance.id });
        res.status(409).json({ 
          message: 'Instância com este nome já existe',
          existingInstance
        });
        return;
      }
      
      // Criar instância no Evolution API
      const instanceName = `${name}-${uuidv4().substring(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      logger.info(`Criando instância no Evolution API: ${instanceName}`);
      const evolutionResponse = await evolutionAPI.createInstance(instanceName);
      
      if (!evolutionResponse.status) {
        logger.error('Erro ao criar instância na Evolution API', evolutionResponse);
        res.status(500).json({ 
          message: 'Erro ao criar instância na Evolution API',
          details: evolutionResponse.message
        });
        return;
      }
      
      logger.info('Instância criada na Evolution API:', evolutionResponse.data);
      
      // Criar no banco de dados local
      const instanceData: any = {
        name: instanceName,
        display_name: name,
        description: description || '',
        status: 'disconnected',
        evolution_instance_id: evolutionResponse.data?.instance?.instanceId || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Apenas adiciona o user_id se ele existir
      if (userId !== null) {
        instanceData.user_id = userId;
      }
      
      logger.info('Inserindo instância no banco de dados local', instanceData);
      const [newInstance] = await db('instances').insert(instanceData).returning('*');
      
      logger.info(`Instância criada com ID ${newInstance.id}`);
      res.status(201).json({
        ...newInstance,
        qrcode_url: `/instances/${newInstance.id}/qrcode`
      });
    } catch (error: any) {
      logger.error('Erro ao criar instância:', error);
      logger.error('Dados da requisição:', req.body);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao criar instância',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Atualiza uma instância existente
   */
  async updateInstance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      const { display_name, description } = req.body;
      
      logger.info(`Atualizando instância ${id}`, { userId });
      
      const instanceToUpdate = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instanceToUpdate) {
        logger.warn(`Instância com ID ${id} não encontrada para atualização`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      const updateData = {
        display_name: display_name || instanceToUpdate.display_name,
        description: description !== undefined ? description : instanceToUpdate.description,
        updated_at: new Date()
      };
      
      logger.info(`Dados da atualização para instância ${id}:`, updateData);
      const [updatedInstance] = await db('instances')
        .where({ id })
        .update(updateData)
        .returning('*');
      
      logger.info(`Instância ${id} atualizada com sucesso`);
      res.json(updatedInstance);
    } catch (error: any) {
      logger.error(`Erro ao atualizar instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao atualizar instância',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Obtém o status de uma instância
   */
  async getInstanceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Obtendo status da instância ${id}`, { userId });
      
      const instance = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instance) {
        logger.warn(`Instância com ID ${id} não encontrada`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      let status = instance.status || 'unknown';
      
      // Buscar status atualizado via Evolution API
      try {
        const evolutionResponse = await evolutionAPI.getInstance(instance.name);
        if (evolutionResponse.status && evolutionResponse.data) {
          status = evolutionResponse.data.status;
          
          // Atualizar status no banco
          await db('instances')
            .where({ id: instance.id })
            .update({ 
              status,
              updated_at: new Date()
            });
        }
      } catch (error) {
        logger.warn(`Não foi possível obter status atualizado da instância ${instance.name}:`, error);
        // Continuar com o status armazenado no banco
      }
      
      logger.info(`Status da instância ${id}: ${status}`);
      res.json({
        id: instance.id,
        name: instance.name,
        status,
        timestamp: new Date()
      });
    } catch (error: any) {
      logger.error(`Erro ao obter status da instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao obter status da instância',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Conecta uma instância ao WhatsApp
   */
  async connectInstance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Conectando instância ${id} ao WhatsApp`, { userId });
      
      const instance = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instance) {
        logger.warn(`Instância com ID ${id} não encontrada`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      // Conectar via Evolution API
      logger.info(`Enviando requisição de conexão para a instância ${instance.name}`);
      const evolutionResponse = await evolutionAPI.connectInstance(instance.name);
      
      if (!evolutionResponse.status) {
        logger.error(`Erro ao conectar instância ${instance.name}:`, evolutionResponse.message);
        res.status(500).json({ 
          message: 'Erro ao conectar instância ao WhatsApp',
          details: evolutionResponse.message
        });
        return;
      }
      
      // Atualizar status no banco
      const updateData = {
        status: 'connecting',
        updated_at: new Date()
      };
      
      const [updatedInstance] = await db('instances')
        .where({ id })
        .update(updateData)
        .returning('*');
      
      logger.info(`Instância ${id} está se conectando ao WhatsApp`);
      res.json({
        id: updatedInstance.id,
        name: updatedInstance.name,
        status: updatedInstance.status,
        message: 'Instância está se conectando ao WhatsApp',
        timestamp: new Date()
      });
    } catch (error: any) {
      logger.error(`Erro ao conectar instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao conectar instância',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Obtém o QR code para conexão da instância
   */
  async getQRCode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Obtendo QR code para instância ${id}`, { userId });
      
      const instance = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instance) {
        logger.warn(`Instância com ID ${id} não encontrada`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      // Obter QR code via Evolution API
      logger.info(`Solicitando QR code para instância ${instance.name}`);
      const evolutionResponse = await evolutionAPI.getQrCode(instance.name);
      
      if (!evolutionResponse.status) {
        logger.error(`Erro ao obter QR code para instância ${instance.name}:`, evolutionResponse.message);
        res.status(500).json({ 
          message: 'Erro ao obter QR code',
          details: evolutionResponse.message
        });
        return;
      }
      
      // A Evolution API pode retornar o QR code em diferentes formatos
      const qrcode = evolutionResponse.data?.qrcode || 
                     evolutionResponse.data?.qr || 
                     evolutionResponse.data?.base64 ||
                     'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAABlBMVEX///8AAABVwtN+AAAB7UlEQVR42uyYMY7sIBBEa0FyCGQfzXCJOcUcAomUF6vZxWs/jT3Sap9EYlqu6q4q4L9Hjx49ut3RMzn788u/dVfZnxo9L9mzotPTR5+SzmTsrOisHX1IOp6FmjJ6lhVmS0eeJc/peMlNSLr2dCTDHR0ZfCbRJTEV7ehDdvTDVSaBLj1d7XvpJ0V3WdGZUFKKvspEbuhL4nRD91GzRB/a0Qsn0cdEuqQHUXpWdCfQ+/fDcfp2KFHgKbvRMPbpMPXouEsO051F9+lk0HsCPaUzp6O36Ni/oUv9pejw9ShdOr2RDmV6+cQhfRPoZdD7Ct0k33QY+sbdPp3Qrwe9z9P3Cr0l0Iegf+7H9PMJW/QcbdF/Fxyl73uXTmDNpEt6TKLrc8nPNT87P7u/zs8unNJF6XxuLXrQKoGu1kNKrQVdPKD7e12jCwSfuS+Z9HJNb2v0F8DZ9NmjLwTmkv47QOkARul1SV8M9EQmna42GJxwQl8NrHn0ddDlC6a26X+ZXdElgS7L58YcXbwmr5LDGv11QJ+5R++vUVv0hOwuGehj8/TtM/ca/augt8T96RQduW3TbU+/X0+v8+gvmTQDc/FzwwEzgT4X75UJZOlYvZd3SZzBu9wqpbx7w+bRo0ePvp4/D6U9rknkZi0AAAAASUVORK5CYII=';
      
      // Atualizar QR code no banco de dados
      await db('instances')
        .where({ id: instance.id })
        .update({ 
          qrcode: qrcode,
          updated_at: new Date()
        });
      
      logger.info(`QR code obtido para instância ${id}`);
      res.json({
        id: instance.id,
        name: instance.name,
        qrcode,
        timestamp: new Date()
      });
    } catch (error: any) {
      logger.error(`Erro ao obter QR code para instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao obter QR code',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Envia uma mensagem através da instância
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      const { phoneNumber, message, options } = req.body;
      
      logger.info(`Enviando mensagem através da instância ${id}`, { userId, phoneNumber });
      
      // Validação básica
      if (!phoneNumber || !message) {
        logger.warn('Validação falhou: Número de telefone e mensagem são obrigatórios');
        res.status(400).json({ message: 'Número de telefone e mensagem são obrigatórios' });
        return;
      }
      
      // Obter a instância do banco de dados
      const instance = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instance) {
        logger.warn(`Instância com ID ${id} não encontrada`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      // Verificar se a instância está conectada
      if (instance.status !== 'connected') {
        logger.warn(`Instância ${instance.name} não está conectada (status: ${instance.status})`);
        res.status(400).json({ 
          message: 'Instância não está conectada ao WhatsApp',
          status: instance.status
        });
        return;
      }
      
      // Formatar número de telefone (remover caracteres não numéricos)
      const formattedPhone = phoneNumber.replace(/\D/g, '');
      
      // Enviar mensagem via Evolution API
      logger.info(`Enviando mensagem para ${formattedPhone} via instância ${instance.name}`);
      const evolutionResponse = await evolutionAPI.sendMessage(
        instance.name, 
        formattedPhone, 
        message,
        options || {}
      );
      
      if (!evolutionResponse.status) {
        logger.error(`Erro ao enviar mensagem via instância ${instance.name}:`, evolutionResponse.message);
        res.status(500).json({ 
          message: 'Erro ao enviar mensagem',
          details: evolutionResponse.message
        });
        return;
      }
      
      // Registrar mensagem no histórico (opcional)
      try {
        await db('message_history').insert({
          instance_id: instance.id,
          user_id: userId,
          phone_number: formattedPhone,
          message_type: 'text',
          content: message,
          direction: 'outbound',
          status: 'sent',
          created_at: new Date(),
          updated_at: new Date()
        });
      } catch (error) {
        logger.warn('Erro ao registrar mensagem no histórico:', error);
        // Não interromper o fluxo principal
      }
      
      logger.info(`Mensagem enviada com sucesso para ${formattedPhone}`);
      res.json({
        success: true,
        instance: instance.name,
        to: formattedPhone,
        message: 'Mensagem enviada com sucesso',
        messageId: evolutionResponse.data?.key?.id || null,
        timestamp: new Date()
      });
    } catch (error: any) {
      logger.error(`Erro ao enviar mensagem via instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao enviar mensagem',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Exclui uma instância
   */
  async deleteInstance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Excluindo instância ${id}`, { userId });
      
      const instanceToDelete = await db('instances')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!instanceToDelete) {
        logger.warn(`Instância com ID ${id} não encontrada para exclusão`);
        res.status(404).json({ message: 'Instância não encontrada' });
        return;
      }
      
      // Excluir instância na Evolution API
      try {
        logger.info(`Excluindo instância ${instanceToDelete.name} na Evolution API`);
        await evolutionAPI.deleteInstance(instanceToDelete.name);
      } catch (error) {
        logger.warn(`Erro ao excluir instância ${instanceToDelete.name} na Evolution API:`, error);
        // Continuar mesmo que falhe na API externa
      }
      
      // Excluir instância no banco de dados
      await db('instances').where({ id }).delete();
      
      logger.info(`Instância ${id} excluída com sucesso`);
      res.json({
        message: 'Instância excluída com sucesso',
        deletedInstanceId: id,
        timestamp: new Date()
      });
    } catch (error: any) {
      logger.error(`Erro ao excluir instância ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao excluir instância',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
} 