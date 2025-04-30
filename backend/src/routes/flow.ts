import { Router } from 'express';
import { flowController } from '../controllers/flow';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all flows
router.get('/', authenticate, flowController.getAllFlows);

// Create new flow
router.post('/', authenticate, flowController.createFlow);

// Get flow details
router.get('/:id', authenticate, flowController.getFlow);

// Update flow
router.put('/:id', authenticate, flowController.updateFlow);

// Delete flow
router.delete('/:id', authenticate, flowController.deleteFlow);

// Publish flow
router.post('/:id/publish', authenticate, flowController.publishFlow);

export default router; 