import { Router } from 'express';
import { InstanceController } from '../controllers/instance-controller';

const instanceRouter = Router();
const instanceController = new InstanceController();

// Rotas de instâncias
instanceRouter.get('/', instanceController.listInstances.bind(instanceController));
instanceRouter.get('/:id', instanceController.getInstanceById.bind(instanceController));
instanceRouter.post('/', instanceController.createInstance.bind(instanceController));
instanceRouter.put('/:id', instanceController.updateInstance.bind(instanceController));
instanceRouter.delete('/:id', instanceController.deleteInstance.bind(instanceController));

// Rotas específicas para operações de instância
instanceRouter.get('/:id/status', instanceController.getInstanceStatus.bind(instanceController));
instanceRouter.post('/:id/connect', instanceController.connectInstance.bind(instanceController));
instanceRouter.get('/:id/qrcode', instanceController.getQRCode.bind(instanceController));
instanceRouter.post('/:id/messages', instanceController.sendMessage.bind(instanceController));

export default instanceRouter; 