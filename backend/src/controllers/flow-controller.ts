import { Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Controlador para gerenciar fluxos de conversação
 */
export class FlowController {
  
  /**
   * Lista todos os fluxos
   */
  async listFlows(req: Request, res: Response): Promise<void> {
    try {
      // Usando operador de acesso seguro
      const userId = req.user && 'id' in req.user ? req.user.id : undefined;
      
      let query = db('flows');
      if (userId) {
        query = query.where({ user_id: userId });
      }
      
      const flows = await query.select('*');
      
      res.json(flows);
    } catch (error) {
      logger.error('Erro ao listar fluxos:', error);
      res.status(500).json({ message: 'Erro ao listar fluxos' });
    }
  }
  
  /**
   * Obtém um fluxo pelo ID
   */
  async getFlowById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Usando operador de acesso seguro
      const userId = req.user && 'id' in req.user ? req.user.id : undefined;
      
      const flow = await db('flows')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!flow) {
        res.status(404).json({ message: 'Fluxo não encontrado' });
        return;
      }
      
      res.json(flow);
    } catch (error) {
      logger.error('Erro ao obter fluxo:', error);
      res.status(500).json({ message: 'Erro ao obter fluxo' });
    }
  }
  
  /**
   * Cria um novo fluxo
   */
  async createFlow(req: Request, res: Response): Promise<void> {
    try {
      // Em ambiente de teste/desenvolvimento, não exigimos um usuário válido
      const userId = req.user && 'id' in req.user ? req.user.id : null;
      const { name, is_draft, trigger_type = 'message' } = req.body;
      
      // Validação básica
      if (!name) {
        res.status(400).json({ message: 'Nome é obrigatório' });
        return;
      }
      
      // Remover a chave user_id se for null para deixar o valor padrão do banco
      const flowData: any = {
        name,
        is_draft: is_draft !== undefined ? is_draft : true,
        trigger_type: trigger_type,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Apenas adiciona o user_id se ele existir
      if (userId !== null) {
        flowData.user_id = userId;
      }
      
      const [newFlow] = await db('flows').insert(flowData).returning('*');
      
      res.status(201).json(newFlow);
    } catch (error) {
      logger.error('Erro ao criar fluxo:', error);
      res.status(500).json({ message: 'Erro ao criar fluxo' });
    }
  }
  
  /**
   * Atualiza um fluxo existente
   */
  async updateFlow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Usando operador de acesso seguro
      const userId = req.user && 'id' in req.user ? req.user.id : undefined;
      const { name, is_draft } = req.body;
      
      const flowToUpdate = await db('flows')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!flowToUpdate) {
        res.status(404).json({ message: 'Fluxo não encontrado' });
        return;
      }
      
      const updateData = {
        name: name || flowToUpdate.name,
        is_draft: is_draft !== undefined ? is_draft : flowToUpdate.is_draft,
        updated_at: new Date()
      };
      
      const [updatedFlow] = await db('flows')
        .where({ id })
        .update(updateData)
        .returning('*');
      
      res.json(updatedFlow);
    } catch (error) {
      logger.error('Erro ao atualizar fluxo:', error);
      res.status(500).json({ message: 'Erro ao atualizar fluxo' });
    }
  }
  
  /**
   * Publica um fluxo (muda is_draft para false)
   */
  async publishFlow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Usando operador de acesso seguro
      const userId = req.user && 'id' in req.user ? req.user.id : undefined;
      
      const flowToPublish = await db('flows')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!flowToPublish) {
        res.status(404).json({ message: 'Fluxo não encontrado' });
        return;
      }
      
      const [publishedFlow] = await db('flows')
        .where({ id })
        .update({ 
          is_draft: false,
          updated_at: new Date()
        })
        .returning('*');
      
      res.json(publishedFlow);
    } catch (error) {
      logger.error('Erro ao publicar fluxo:', error);
      res.status(500).json({ message: 'Erro ao publicar fluxo' });
    }
  }
  
  /**
   * Exclui um fluxo
   */
  async deleteFlow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Usando operador de acesso seguro
      const userId = req.user && 'id' in req.user ? req.user.id : undefined;
      
      const flowToDelete = await db('flows')
        .where({ id })
        .where(builder => {
          if (userId) {
            builder.where({ user_id: userId });
          }
        })
        .first();
      
      if (!flowToDelete) {
        res.status(404).json({ message: 'Fluxo não encontrado' });
        return;
      }
      
      await db('flows').where({ id }).delete();
      
      res.status(200).json({ message: 'Fluxo excluído com sucesso' });
    } catch (error) {
      logger.error('Erro ao excluir fluxo:', error);
      res.status(500).json({ message: 'Erro ao excluir fluxo' });
    }
  }
} 