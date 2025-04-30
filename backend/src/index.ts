import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import { setupRoutes } from './api/routes';
import { setupWebhookServer } from './services/webhook-handler';
import { db } from './database/connection';
import { logger } from './utils/logger';

// Carrega variáveis de ambiente
config();

const PORT = process.env.PORT || 8080;

// Criar aplicação Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configura as rotas da API
setupRoutes(app);

// Inicia o servidor de webhook
setupWebhookServer();

// Função para inicializar o servidor
async function startServer() {
  try {
    // Verificar conexão com o banco de dados
    await db.raw('SELECT 1');
    logger.info('Database connection established successfully');
    
    // Iniciar o servidor
    app.listen(PORT, () => {
      logger.info(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Iniciar o servidor
startServer(); 