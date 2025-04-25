/**
 * Script para iniciar o servidor de webhook dedicado
 * Execute com: node start-webhook-server.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Configurações
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SERVER_PATH = path.join(__dirname, 'webhook-server.cjs');
console.log('Caminho do servidor webhook:', WEBHOOK_SERVER_PATH);

// Configuração de ambiente
process.env.WEBHOOK_PORT = WEBHOOK_PORT;
process.env.FRONTEND_API_URL = process.env.FRONTEND_API_URL || 'http://localhost:3000/api';

console.log(`
╭────────────────────────────────────────────────╮
│                                                │
│    INICIANDO SERVIDOR DE WEBHOOK DEDICADO      │
│                                                │
│    Porta: ${WEBHOOK_PORT.toString().padEnd(37)}│
│    URL: http://localhost:${WEBHOOK_PORT}${' '.repeat(26)}│
│                                                │
╰────────────────────────────────────────────────╯
`);

// Inicia o servidor de webhook em um processo separado
const webhookServer = spawn('node', [WEBHOOK_SERVER_PATH], {
  env: {
    ...process.env,
    WEBHOOK_PORT: WEBHOOK_PORT,
    FRONTEND_API_URL: process.env.FRONTEND_API_URL || 'http://localhost:3000/api'
  },
  stdio: 'inherit' // Mostra stdout e stderr no console
});

// Manipula saída do processo
webhookServer.on('close', (code) => {
  console.log(`Servidor de webhook encerrado com código: ${code}`);
});

// Configura tratamento de sinais para encerramento limpo
process.on('SIGINT', () => {
  console.log('Encerrando servidor de webhook...');
  webhookServer.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('Encerrando servidor de webhook...');
  webhookServer.kill('SIGTERM');
  process.exit();
});

console.log(`Servidor de webhook iniciado em http://localhost:${WEBHOOK_PORT}`);
console.log('Pressione Ctrl+C para encerrar');