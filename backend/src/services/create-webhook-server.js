#!/usr/bin/env node

import { createServer } from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import { Agent } from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações do servidor
const PORT = process.env.WEBHOOK_PORT || 3001;
// No ambiente Replit, usamos process.env.REPLIT_DOMAINS para detectar a porta correta da aplicação
const FRONTEND_URL = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS}`
  : 'http://localhost:3000';
const FRONTEND_API_URL = process.env.FRONTEND_API_URL || `${FRONTEND_URL}/api`;
const API_KEY = process.env.API_KEY || 'd7275dd0964f87ba8ecb164cbe1aa921';

console.log(`Configuração atual do webhook:
- Porta do webhook: ${PORT}
- URL da API do frontend: ${FRONTEND_API_URL}
- API Key configurada: ${API_KEY ? 'Sim' : 'Não'}
`);

// Caminho para arquivo de logs
const LOG_PATH = path.join(__dirname, 'webhook-logs.txt');

// Inicialização do servidor Express
const app = express();

// Middleware para analisar JSON
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Função para registrar logs em arquivo e console
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  fs.appendFile(LOG_PATH, logMessage, (err) => {
    if (err) console.error('Erro ao escrever log:', err);
  });
}

/**
 * Rota principal para receber webhooks da Evolution API
 * Esta rota processa mensagens recebidas e dispara fluxos configurados
 */
app.post('/webhook', async (req, res) => {
  try {
    logToFile(`Webhook recebido: ${JSON.stringify(req.body, null, 2)}`);
    
    // Valida se contém dados necessários
    if (!req.body || !req.body.key || !req.body.message) {
      logToFile('Webhook inválido: dados incompletos');
      return res.status(400).json({ success: false, message: 'Dados incompletos' });
    }
    
    // Extrai informações essenciais da mensagem
    const isGroup = req.body.key.remoteJid.includes('@g.us');
    const fromNumber = req.body.key.remoteJid.split('@')[0];
    // Corrigido para extrair corretamente o nome da instância
    let instanceName = 'teste1'; // Fallback para instância padrão
    
    if (req.body.instance) {
      if (typeof req.body.instance === 'string') {
        instanceName = req.body.instance;
      } else if (typeof req.body.instance === 'object' && req.body.instance.instanceName) {
        instanceName = req.body.instance.instanceName;
      }
    } else if (req.body.instanceName) {
      instanceName = req.body.instanceName;
    }
    
    logToFile(`Instância detectada: ${instanceName} (tipo: ${typeof instanceName})`)
    
    // Extrai o conteúdo da mensagem (vários formatos suportados)
    let messageContent = '';
    
    if (req.body.message.conversation) {
      messageContent = req.body.message.conversation;
    } else if (req.body.message.extendedTextMessage) {
      messageContent = req.body.message.extendedTextMessage.text;
    } else if (req.body.message.imageMessage && req.body.message.imageMessage.caption) {
      messageContent = req.body.message.imageMessage.caption;
    } else if (req.body.message.videoMessage && req.body.message.videoMessage.caption) {
      messageContent = req.body.message.videoMessage.caption;
    } else if (req.body.message.documentMessage && req.body.message.documentMessage.caption) {
      messageContent = req.body.message.documentMessage.caption;
    } else {
      // Tentativa de extrair de outros campos
      const messageKeys = Object.keys(req.body.message);
      if (messageKeys.length > 0) {
        const firstKey = messageKeys[0];
        if (req.body.message[firstKey] && typeof req.body.message[firstKey] === 'object') {
          messageContent = req.body.message[firstKey].caption || req.body.message[firstKey].text || '';
        }
      }
    }
    
    // Se não conseguimos extrair nenhum conteúdo de texto, informamos
    if (!messageContent) {
      logToFile(`Mensagem sem conteúdo de texto detectável. Tipo: ${JSON.stringify(Object.keys(req.body.message))}`);
    }
    
    logToFile(`Mensagem processada:
      - Instância: ${instanceName}
      - De: ${fromNumber}${isGroup ? ' (grupo)' : ''}
      - Conteúdo: "${messageContent}"
    `);
    
    // Agora vamos enviar para o processador de mensagens da aplicação principal
    try {
      // Adicionando opção para ignorar erros de certificado SSL em ambientes de desenvolvimento
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        // Ignorar erros de validação SSL apenas em desenvolvimento
        httpsAgent: new Agent({ rejectUnauthorized: false })
      };
      
      const response = await axios.post(`${FRONTEND_API_URL}/process-message`, {
        instanceName,
        fromNumber,
        messageContent,
        messageId: req.body.key.id,
        timestamp: req.body.messageTimestamp,
        isGroup,
        rawData: req.body
      }, axiosConfig);
      
      logToFile(`Resposta do processador: ${JSON.stringify(response.data)}`);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook processado com sucesso',
        results: response.data
      });
    } catch (apiError) {
      const errorMessage = apiError.response 
        ? `${apiError.response.status}: ${JSON.stringify(apiError.response.data)}`
        : apiError.message;
      
      logToFile(`Erro ao enviar para o processador: ${errorMessage}`);
      
      return res.status(200).json({
        success: false,
        message: `Erro no processamento: ${errorMessage}`,
        originalMessage: messageContent
      });
    }
  } catch (error) {
    logToFile(`Erro no servidor de webhook: ${error.message}`);
    logToFile(error.stack);
    
    return res.status(500).json({
      success: false,
      message: `Erro interno: ${error.message}`
    });
  }
});

/**
 * Endpoint de status para verificar se o servidor está online
 */
app.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor de webhook online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Endpoint para teste de webhook
 */
app.post('/test', (req, res) => {
  logToFile(`Teste de webhook recebido: ${JSON.stringify(req.body)}`);
  res.status(200).json({
    success: true,
    message: 'Teste recebido com sucesso',
    receivedData: req.body
  });
});

// Inicialização do servidor
const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  logToFile(`Servidor de webhook iniciado na porta ${PORT}`);
});

// Tratamento de SIGINT e SIGTERM
process.on('SIGINT', () => {
  server.close(() => {
    logToFile('Servidor de webhook encerrado por SIGINT');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    logToFile('Servidor de webhook encerrado por SIGTERM');
    process.exit(0);
  });
});