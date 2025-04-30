import { Router } from 'express';
import { Request, Response } from 'express';
import { webhookHandler } from '../../services/webhook-handler';

const router = Router();

// Handle webhook events
router.post('/:instanceId', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    await webhookHandler.handleWebhook(instanceId, req.body);
    res.status(200).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router; 