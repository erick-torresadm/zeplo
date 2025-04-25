import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { setupRoutes } from './api/routes';
import { setupWebhookServer } from './services/webhook-handler';

// Carrega variáveis de ambiente
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Setup das rotas
setupRoutes(app);

// Inicia o servidor de webhook
setupWebhookServer();

// Inicia o servidor principal
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 