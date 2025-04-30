import { Router } from 'express';
import { SystemController } from '../controllers/system-controller';

const systemRouter = Router();
const systemController = new SystemController();

// Rotas de status do sistema
systemRouter.get('/database-status', systemController.getDatabaseStatus.bind(systemController));
systemRouter.get('/redis-status', systemController.getRedisStatus.bind(systemController));
systemRouter.get('/storage-status', systemController.getStorageStatus.bind(systemController));

export default systemRouter; 