import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import flowRouter from './routes/flow-routes';

// Inicializar o Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições simples
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rota de saúde para verificação do sistema
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Status para verificação do banco de dados
app.get('/status', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'Zeplo Backend',
    version: '1.0.0',
    timestamp: new Date() 
  });
});

// Registrar rotas
app.use('/flows', flowRouter);

// Middleware de tratamento de erros
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Erro na aplicação:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

export default app; 