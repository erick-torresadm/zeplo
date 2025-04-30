import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import instanceRoutes from './instance.routes';
import flowRoutes from './flow.routes';
import mediaRoutes from './media.routes';
import webhookRoutes from './webhook.routes';
import contactRoutes from './contact.routes';
import authRoutes from './auth.routes';

const router = Router();

// Auth routes (public)
router.use('/auth', authRoutes);

// Protected routes
router.use('/instances', authenticate, instanceRoutes);
router.use('/flows', authenticate, flowRoutes);
router.use('/media', authenticate, mediaRoutes);
router.use('/webhooks', webhookRoutes); // Webhook routes don't need authentication
router.use('/contacts', authenticate, contactRoutes);

export default router; 