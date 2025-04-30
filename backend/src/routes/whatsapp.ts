import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp';
import { authenticate, validateApiKey } from '../middleware/auth';

const router = Router();

// Rotas protegidas por autenticação
router.post('/instances', authenticate, whatsappController.createInstance);
router.post('/instances/:instanceId/connect', authenticate, whatsappController.connectInstance);
router.get('/instances/:instanceId/qrcode', authenticate, whatsappController.getQRCode);
router.post('/instances/:instanceId/messages', authenticate, whatsappController.sendMessage);
router.post('/instances/:instanceId/media', authenticate, whatsappController.sendMediaMessage);

// Rota de webhook (protegida por API key)
router.post('/webhook/:event', validateApiKey, whatsappController.handleWebhook);

export default router; 