import { Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { reconnectIfNeeded } from '../database/connection';

/**
 * Controlador para gerenciar contatos
 */
export class ContactController {
  
  /**
   * Lista todos os contatos
   */
  async listContacts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info('Listando contatos', { userId });
      
      let query = db('contacts');
      if (userId) {
        query = query.where({ user_id: userId });
      }
      
      const contacts = await query.select('*');
      
      logger.info(`Encontrados ${contacts.length} contatos`);
      res.json(contacts);
    } catch (error: any) {
      logger.error('Erro ao listar contatos:', error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao listar contatos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Obtém um contato pelo ID
   */
  async getContactById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Buscando contato com ID ${id}`, { userId });
      
      const contact = await db('contacts')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!contact) {
        logger.warn(`Contato com ID ${id} não encontrado`);
        res.status(404).json({ message: 'Contato não encontrado' });
        return;
      }
      
      logger.info(`Contato ${id} encontrado`);
      res.json(contact);
    } catch (error: any) {
      logger.error(`Erro ao obter contato ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao obter contato',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Cria um novo contato
   */
  async createContact(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      const { name, phone, email, notes } = req.body;
      
      logger.info('Criando novo contato', { name, phone, userId });
      
      // Validação básica
      if (!name || !phone) {
        logger.warn('Validação falhou: Nome e telefone são obrigatórios', { name, phone });
        res.status(400).json({ message: 'Nome e telefone são obrigatórios' });
        return;
      }
      
      // Verificar formato do telefone (básico)
      const phoneRegex = /^\+?\d{10,15}$/;
      if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
        logger.warn(`Formato de telefone inválido: ${phone}`);
        res.status(400).json({ message: 'Formato de telefone inválido' });
        return;
      }
      
      const contactData: any = {
        name,
        phone,
        email: email || '',
        notes: notes || '',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Apenas adiciona o user_id se ele existir
      if (userId !== null) {
        contactData.user_id = userId;
      }
      
      // Verificar se o contato já existe
      const existingContact = await db('contacts')
        .where({ phone })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (existingContact) {
        logger.warn(`Contato com telefone ${phone} já existe`, { existingId: existingContact.id });
        res.status(409).json({ 
          message: 'Contato com este telefone já existe',
          existingContact: existingContact
        });
        return;
      }
      
      logger.info('Inserindo contato no banco', contactData);
      const [newContact] = await db('contacts').insert(contactData).returning('*');
      
      logger.info(`Contato criado com ID ${newContact.id}`);
      res.status(201).json(newContact);
    } catch (error: any) {
      logger.error('Erro ao criar contato:', error);
      logger.error('Dados da requisição:', req.body);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao criar contato',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Atualiza um contato existente
   */
  async updateContact(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      const { name, phone, email, notes } = req.body;
      
      logger.info(`Atualizando contato ${id}`, { userId });
      
      const contactToUpdate = await db('contacts')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!contactToUpdate) {
        logger.warn(`Contato com ID ${id} não encontrado para atualização`);
        res.status(404).json({ message: 'Contato não encontrado' });
        return;
      }
      
      // Validar telefone se fornecido
      if (phone) {
        const phoneRegex = /^\+?\d{10,15}$/;
        if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
          logger.warn(`Formato de telefone inválido na atualização: ${phone}`);
          res.status(400).json({ message: 'Formato de telefone inválido' });
          return;
        }
      }
      
      const updateData = {
        name: name || contactToUpdate.name,
        phone: phone || contactToUpdate.phone,
        email: email !== undefined ? email : contactToUpdate.email,
        notes: notes !== undefined ? notes : contactToUpdate.notes,
        updated_at: new Date()
      };
      
      logger.info(`Dados da atualização para contato ${id}:`, updateData);
      const [updatedContact] = await db('contacts')
        .where({ id })
        .update(updateData)
        .returning('*');
      
      logger.info(`Contato ${id} atualizado com sucesso`);
      res.json(updatedContact);
    } catch (error: any) {
      logger.error(`Erro ao atualizar contato ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao atualizar contato',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Exclui um contato
   */
  async deleteContact(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      
      logger.info(`Excluindo contato ${id}`, { userId });
      
      const contactToDelete = await db('contacts')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!contactToDelete) {
        logger.warn(`Contato com ID ${id} não encontrado para exclusão`);
        res.status(404).json({ message: 'Contato não encontrado' });
        return;
      }
      
      await db('contacts').where({ id }).delete();
      
      logger.info(`Contato ${id} excluído com sucesso`);
      res.json({
        message: 'Contato excluído com sucesso',
        deletedContactId: id,
        timestamp: new Date()
      });
    } catch (error: any) {
      logger.error(`Erro ao excluir contato ${req.params.id}:`, error);
      
      // Tenta reconectar ao banco se necessário
      if (error.code === 'ECONNRESET' || error.code === '57P01') {
        logger.warn('Tentando reconectar ao banco de dados...');
        await reconnectIfNeeded();
      }
      
      res.status(500).json({ 
        message: 'Erro ao excluir contato',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
} 