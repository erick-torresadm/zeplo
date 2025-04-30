import { Router } from 'express';
import { AuthRequest } from '../../types/user';
import { Response, NextFunction } from 'express';
import { flowController } from '../../controllers/flow';

const router = Router();

// Get all flows
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    await flowController.getAllFlows(req, res);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get flow by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await flowController.getFlow(req, res);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create flow
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    await flowController.createFlow(req, res);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update flow
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await flowController.updateFlow(req, res);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete flow
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await flowController.deleteFlow(req, res);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router; 