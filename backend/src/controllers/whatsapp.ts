import { Request, Response } from 'express';
import { whatsAppService } from '../services/whatsapp';
import { AuthRequest } from '../middleware/auth';
import { logError } from '../utils/logger';

export const whatsappController = {
  // Criar uma nova instância
  async createInstance(req: AuthRequest, res: Response) {
    try {
      const { name } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Usuário não autenticado' });
      }

      const instance = await whatsAppService.createInstance(name, userId);
      res.json(instance);
    } catch (error: any) {
      logError('Erro ao criar instância', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Conectar uma instância
  async connectInstance(req: AuthRequest, res: Response) {
    try {
      const { instanceId } = req.params;
      const result = await whatsAppService.connectInstance(parseInt(instanceId));
      res.json(result);
    } catch (error: any) {
      logError('Erro ao conectar instância', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Obter QR Code
  async getQRCode(req: AuthRequest, res: Response) {
    try {
      const { instanceId } = req.params;
      const qrcode = await whatsAppService.getQRCode(parseInt(instanceId));
      res.json({ qrcode });
    } catch (error: any) {
      logError('Erro ao obter QR Code', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Enviar mensagem
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { instanceId } = req.params;
      const { to, message } = req.body;

      const result = await whatsAppService.sendMessage(
        parseInt(instanceId),
        to,
        message
      );
      res.json(result);
    } catch (error: any) {
      logError('Erro ao enviar mensagem', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Enviar mensagem com mídia
  async sendMediaMessage(req: AuthRequest, res: Response) {
    try {
      const { instanceId } = req.params;
      const { to, mediaUrl, caption, type } = req.body;

      const result = await whatsAppService.sendMediaMessage(
        parseInt(instanceId),
        to,
        mediaUrl,
        caption,
        type
      );
      res.json(result);
    } catch (error: any) {
      logError('Erro ao enviar mensagem com mídia', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Webhook handler
  async handleWebhook(req: Request, res: Response) {
    try {
      const { event } = req.params;
      await whatsAppService.handleWebhook(event, req.body);
      res.sendStatus(200);
    } catch (error: any) {
      logError('Erro ao processar webhook', error);
      res.status(500).json({ message: error.message });
    }
  }
}; 