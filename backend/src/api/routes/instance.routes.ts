import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/user';
import { whatsAppService } from '../../services/whatsapp';
import { checkPlan } from '../../middleware/auth';

const router = Router();

// Get all instances for the authenticated user
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instances = await whatsAppService.getAllInstances((req as AuthRequest).user?.id || 0);
    res.json(instances);
  } catch (error) {
    next(error);
  }
});

// Create a new instance
router.post('/', checkPlan('basic'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const instance = await whatsAppService.createInstance(name, (req as AuthRequest).user?.id || 0);
    res.status(201).json(instance);
  } catch (error) {
    next(error);
  }
});

// Get instance status and QR code
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await whatsAppService.getInstanceStatus(parseInt(req.params.id));
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Connect instance
router.post('/:id/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await whatsAppService.connectInstance(parseInt(req.params.id));
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// Disconnect instance
router.post('/:id/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await whatsAppService.disconnectInstance(parseInt(req.params.id));
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// Delete instance
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await whatsAppService.deleteInstance(parseInt(req.params.id), (req as AuthRequest).user?.id || 0);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router; 