import { Router } from 'express';
import { FlowController } from '../controllers/flow-controller';

const flowRouter = Router();
const flowController = new FlowController();

// Rotas de fluxos
flowRouter.get('/', flowController.listFlows.bind(flowController));
flowRouter.get('/:id', flowController.getFlowById.bind(flowController));
flowRouter.post('/', flowController.createFlow.bind(flowController));
flowRouter.put('/:id', flowController.updateFlow.bind(flowController));
flowRouter.post('/:id/publish', flowController.publishFlow.bind(flowController));
flowRouter.delete('/:id', flowController.deleteFlow.bind(flowController));

export default flowRouter; 