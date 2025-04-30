import { Express, Request, Response } from 'express';
import whatsappRoutes from '../routes/whatsapp';
import flowRouter from '../routes/flow-routes';
import systemRouter from '../routes/system-routes';
import instanceRouter from '../routes/instance-routes';
import contactRouter from '../routes/contact-routes';

export async function setupRoutes(app: Express): Promise<void> {
  // Rotas de verificação de sistema
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });
  
  app.get('/status', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      service: 'Zeplo Backend',
      version: '1.0.0',
      timestamp: new Date() 
    });
  });
  
  // Rotas de sistema para verificação de status dos serviços
  app.use('/system', systemRouter);
  
  // WhatsApp routes
  app.use('/api/whatsapp', whatsappRoutes);
  
  // Registra as rotas de fluxos
  app.use('/flows', flowRouter);
  
  // Registra as rotas de instâncias
  app.use('/instances', instanceRouter);
  
  // Registra as rotas de contatos
  app.use('/contacts', contactRouter);
}

export default setupRoutes;
