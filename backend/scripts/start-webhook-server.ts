import { config } from 'dotenv';
import { webhookHandler } from '../src/services/webhook-handler';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3001;

logger.info(`
╭────────────────────────────────────────────────╮
│                                                │
│    STARTING DEDICATED WEBHOOK SERVER           │
│                                                │
│    Port: ${WEBHOOK_PORT.toString().padEnd(37)}│
│    URL: http://localhost:${WEBHOOK_PORT}${' '.repeat(26)}│
│                                                │
╰────────────────────────────────────────────────╯
`);

// Start webhook server
const server = webhookHandler.setupWebhookServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down webhook server...');
  webhookHandler.stopWebhookServer();
  process.exit();
});

process.on('SIGTERM', () => {
  logger.info('Shutting down webhook server...');
  webhookHandler.stopWebhookServer();
  process.exit();
}); 