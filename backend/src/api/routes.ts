import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated as requireAuth } from "./auth";
import { evolutionApi, convertEvolutionInstanceToAppInstance } from "./evolution-api";
import { log } from "./vite";
import { processIncomingMessage, processFlowsForInstance, triggerMessageFlow } from "./message-processor";
import { triggerFlowWithMessage } from "./flow-message-trigger";
import { processMessageDirectly, testKeywordDirectly } from "./direct-webhook-handler";
import { analyticsService } from "./analytics-service";
import { processWebhook, setupInstanceWebhook } from "./webhook-handler";
import { diagnosticService } from "./diagnostic-service";
import { formatDateBrazilian, isBrazilianDateFormat, parseBrazilianDate } from "./formatters";
import { flowQueueService } from "./flow-queue-service";
import { messageQueueManager } from "./message-queue-manager";
import { processMessageHandler } from "./api-routes/process-message";
import {
  insertInstanceSchema,
  insertMessageFlowSchema,
  messageFlowSchema,
  insertActivitySchema,
  instances,
  messageFlows,
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Função para extrair mensagens de vários formatos da Evolution API
 * Suporta tanto a v1 quanto a v2 e captura mensagens de diferentes estruturas de payload
 */
/**
 * Função para extrair mensagens de vários formatos da Evolution API
 * Suporta tanto a v1 quanto a v2 e captura mensagens de diferentes estruturas de payload
 * @param webhookData Dados do webhook recebido
 * @returns Objeto com os dados extraídos da mensagem ou null se não for possível extrair
 */
function extrairMensagemDaEvolutionAPI(webhookData: any): { 
  instanceName: string,
  fromNumber: string, 
  messageContent: string, 
  messageId?: string,
  timestamp?: number,
  // Campos adicionais para compatibilidade
  numero?: string,
  texto?: string,
  id?: string
} | null {
  try {
    console.log('\n====== EXTRAÇÃO DE MENSAGEM DO WEBHOOK ======');
    console.log('Tipo de dados recebido:', typeof webhookData);
    
    if (!webhookData) {
      console.log('❌ ERRO: Payload nulo ou indefinido');
      return null;
    }
    
    // Exemplo de como analisar o payload passo a passo
    console.log('\n[Campos do nível superior no payload]:');
    for (const key in webhookData) {
      console.log(`- ${key}: ${typeof webhookData[key]} (${Array.isArray(webhookData[key]) ? 'array' : typeof webhookData[key] === 'object' ? 'objeto' : 'valor simples'})`);
    }
    
    // Inicializa variáveis
    let numero: string | null = null;
    let texto: string | null = null;
    let id: string | undefined = undefined;
    let timestamp: number | undefined = undefined;
    
    // Extrai mensagens do webhook em diferentes formatos da API
    let mensagem: any = null;
    let formatoDetectado = 'desconhecido';
    
    // Formato 1: Evolution API v2 (messages.upsert)
    if (webhookData.event === 'messages.upsert' && 
        webhookData.data?.messages && 
        webhookData.data.messages.length > 0) {
      mensagem = webhookData.data.messages[0];
      formatoDetectado = 'Evolution API v2 (messages.upsert)';
      console.log(`\n✅ Formato detectado: ${formatoDetectado}`);
    }
    
    // Formato 2: Evolution API v1 (recieve.messages)
    else if ((webhookData.receive?.messages && webhookData.receive.messages.length > 0) ||
             (webhookData.recieve?.messages && webhookData.recieve.messages.length > 0)) {
      mensagem = webhookData.receive?.messages?.[0] || webhookData.recieve?.messages?.[0];
      formatoDetectado = 'Evolution API v1 (receive.messages)';
      console.log(`\n✅ Formato detectado: ${formatoDetectado}`);
    }
    
    // Formato 3: (data.message)
    else if (webhookData.data?.message) {
      mensagem = webhookData.data;
      formatoDetectado = 'data.message';
      console.log(`\n✅ Formato detectado: ${formatoDetectado}`);
    }
    
    // Formato 4: (messages array direto)
    else if (webhookData.messages && webhookData.messages.length > 0) {
      mensagem = webhookData.messages[0];
      formatoDetectado = 'array de mensagens direto';
      console.log(`\n✅ Formato detectado: ${formatoDetectado}`);
    }
    
    // Formato 5: Mensagem direta com formato brasileiro de timestamp
    else if (webhookData.messageContent && webhookData.sender && webhookData.timestamp) {
      mensagem = {
        messageContent: webhookData.messageContent,
        sender: webhookData.sender,
        timestamp: webhookData.timestamp,
        // Campos adicionais que precisamos simular para manter compatibilidade
        key: { remoteJid: webhookData.sender },
        message: { conversation: webhookData.messageContent }
      };
      formatoDetectado = 'mensagem direta com timestamp BR';
      console.log(`\n✅ Formato detectado: ${formatoDetectado}`);
    }
    
    // Formato 5: Objeto de dados simples em formato personalizado
    else if (webhookData.text && (webhookData.from || webhookData.number || webhookData.phone)) {
      // Às vezes o webhook pode vir em um formato mais simples de sistemas personalizados
      mensagem = webhookData;
      formatoDetectado = 'formato personalizado simples';
      console.log(`\n✅ Formato detectado: ${formatoDetectado}`);
    }
    
    // Verifica se conseguiu extrair alguma mensagem
    if (!mensagem) {
      console.log('\n❌ NENHUM FORMATO RECONHECIDO NO PAYLOAD');
      
      // Vamos tentar uma abordagem mais genérica
      console.log('\nTentando abordar o payload como um todo...');
      
      // Vamos procurar por campos de texto e número em qualquer lugar do objeto
      for (const key in webhookData) {
        // Procura texto
        if (!texto && typeof webhookData[key] === 'string' && webhookData[key].length > 1) {
          if (key.toLowerCase().includes('text') || key.toLowerCase().includes('message') || 
              key.toLowerCase().includes('body') || key.toLowerCase().includes('content')) {
            texto = webhookData[key];
            console.log(`Encontrado possível texto em webhookData.${key}: "${texto.substring(0, 30)}..."`);
          }
        }
        
        // Procura número
        if (!numero && (
            key.toLowerCase().includes('phone') || 
            key.toLowerCase().includes('number') || 
            key.toLowerCase().includes('from') || 
            key.toLowerCase().includes('sender') ||
            key.toLowerCase().includes('jid'))) {
          const potencialNumero = webhookData[key];
          if (typeof potencialNumero === 'string' || typeof potencialNumero === 'number') {
            numero = String(potencialNumero).replace(/[^0-9]/g, '');
            console.log(`Encontrado possível número em webhookData.${key}: "${numero}"`);
          }
        }
      }
      
      if (texto && numero) {
        console.log('Dados extraídos do payload com abordagem genérica');
        const instanceName = webhookData.instance?.instanceName || 
                          webhookData.instance?.name || 
                          webhookData.instanceName || 
                          'instancia-desconhecida';
        const genericId = `generic-${Date.now()}`;
        const currentTimestamp = Date.now();
        
        return {
          instanceName,
          fromNumber: numero,
          messageContent: texto,
          messageId: genericId,
          timestamp: currentTimestamp,
          // Campos adicionais mantidos para compatibilidade com código existente
          numero,
          texto,
          id: genericId
        };
      }
      
      console.log('Falha também na abordagem genérica. Desistindo.');
      return null;
    }
    
    console.log('\n[Estrutura da mensagem extraída]:');
    for (const key in mensagem) {
      if (typeof mensagem[key] === 'object' && mensagem[key] !== null) {
        console.log(`- ${key}: objeto com subpropriedades`);
      } else {
        console.log(`- ${key}: ${typeof mensagem[key]} = ${
          typeof mensagem[key] === 'string' ? 
            `"${mensagem[key].length > 30 ? mensagem[key].substring(0, 30) + '...' : mensagem[key]}"` : 
            mensagem[key]
        }`);
      }
    }
    
    // Extrai o número do telefone (remoteJid, from, sender, etc)
    let origemDoNumero = 'desconhecida';
    
    if (mensagem.key?.remoteJid) {
      numero = mensagem.key.remoteJid.split('@')[0];
      origemDoNumero = 'key.remoteJid';
    } else if (mensagem.sender?.id) {
      numero = mensagem.sender.id.split('@')[0];
      origemDoNumero = 'sender.id';
    } else if (mensagem.from) {
      numero = typeof mensagem.from === 'string' ? mensagem.from.split('@')[0] : String(mensagem.from);
      origemDoNumero = 'from';
    } else if (mensagem.sender?.formattedNumber) {
      numero = mensagem.sender.formattedNumber;
      origemDoNumero = 'sender.formattedNumber';
    } else if (mensagem.number || mensagem.phone) {
      numero = String(mensagem.number || mensagem.phone);
      origemDoNumero = mensagem.number ? 'number' : 'phone';
    } else if (mensagem.sender) {
      // Tenta extrair o número de qualquer propriedade do objeto sender
      for (const key in mensagem.sender) {
        if (typeof mensagem.sender[key] === 'string' && /\d/.test(mensagem.sender[key])) {
          numero = mensagem.sender[key].replace(/[^0-9]/g, '');
          origemDoNumero = `sender.${key}`;
          break;
        }
      }
    } else if (mensagem.senderNumber) {
      numero = String(mensagem.senderNumber);
      origemDoNumero = 'senderNumber';
    }
    
    // Normaliza o número (remove caracteres não numéricos)
    if (numero) {
      const numeroOriginal = numero;
      numero = numero.replace(/[^0-9]/g, '');
      console.log(`\n[Número extraído]: "${numero}" (origem: ${origemDoNumero})`);
      if (numeroOriginal !== numero) {
        console.log(`Número normalizado de "${numeroOriginal}" para "${numero}"`);
      }
    } else {
      console.log('\n❌ FALHA: Não foi possível extrair um número de telefone válido');
    }
    
    // Extrai o texto da mensagem de diferentes lugares
    let origemDoTexto = 'desconhecida';
    
    if (mensagem.message?.conversation) {
      texto = mensagem.message.conversation;
      origemDoTexto = 'message.conversation';
    } else if (mensagem.message?.extendedTextMessage?.text) {
      texto = mensagem.message.extendedTextMessage.text;
      origemDoTexto = 'message.extendedTextMessage.text';
    } else if (mensagem.body) {
      texto = mensagem.body;
      origemDoTexto = 'body';
    } else if (mensagem.text) {
      texto = mensagem.text;
      origemDoTexto = 'text';
    } else if (mensagem.caption) {
      texto = mensagem.caption;
      origemDoTexto = 'caption';
    } else if (typeof mensagem.message === 'string') {
      texto = mensagem.message;
      origemDoTexto = 'message (string)';
    } else if (mensagem.content) {
      texto = typeof mensagem.content === 'string' ? mensagem.content : JSON.stringify(mensagem.content);
      origemDoTexto = 'content';
    } else {
      // Procura em propriedades aninhadas que podem conter texto
      if (mensagem.message && typeof mensagem.message === 'object') {
        // Procura em todas as propriedades de message
        for (const prop in mensagem.message) {
          if (typeof mensagem.message[prop] === 'string' && mensagem.message[prop].length > 0) {
            texto = mensagem.message[prop];
            origemDoTexto = `message.${prop}`;
            break;
          } else if (typeof mensagem.message[prop] === 'object' && mensagem.message[prop] !== null) {
            // Procura em subpropriedades de message[prop]
            for (const subProp in mensagem.message[prop]) {
              if (typeof mensagem.message[prop][subProp] === 'string' && mensagem.message[prop][subProp].length > 0) {
                texto = mensagem.message[prop][subProp];
                origemDoTexto = `message.${prop}.${subProp}`;
                break;
              }
            }
            if (texto) break;
          }
        }
      }
    }
    
    if (texto) {
      console.log(`\n[Texto extraído]: "${texto.length > 50 ? texto.substring(0, 50) + '...' : texto}" (origem: ${origemDoTexto})`);
    } else {
      console.log('\n❌ FALHA: Não foi possível extrair texto da mensagem');
    }
    
    // Extrai o ID da mensagem
    id = mensagem.key?.id || mensagem.id || mensagem.messageId || `msg-${Date.now()}`;
    console.log(`\n[ID da mensagem]: ${id}`);
    
    // Extrai o timestamp
    let origemDoTimestamp = 'desconhecida';
    
    if (mensagem.messageTimestamp) {
      timestamp = typeof mensagem.messageTimestamp === 'number' 
        ? mensagem.messageTimestamp * 1000 
        : parseInt(mensagem.messageTimestamp) * 1000;
      origemDoTimestamp = 'messageTimestamp';
    } else if (mensagem.timestamp) {
      // Verifica se timestamp está no formato brasileiro (DD/MM/AAAA HH:MM:SS)
      if (typeof mensagem.timestamp === 'string' && isBrazilianDateFormat(mensagem.timestamp)) {
        const parsedDate = parseBrazilianDate(mensagem.timestamp);
        
        if (parsedDate) {
          timestamp = parsedDate.getTime();
          origemDoTimestamp = 'timestamp formato brasileiro';
          console.log(`\n✅ Timestamp brasileiro convertido: ${mensagem.timestamp} => ${new Date(timestamp).toISOString()}`);
        } else {
          console.error('Erro ao converter timestamp brasileiro (formato inválido)');
          timestamp = Date.now();
          origemDoTimestamp = 'fallback após erro em formato BR';
        }
      } else {
        timestamp = typeof mensagem.timestamp === 'number'
          ? mensagem.timestamp 
          : parseInt(mensagem.timestamp);
        origemDoTimestamp = 'timestamp';
      }
    } else if (mensagem.time) {
      timestamp = typeof mensagem.time === 'number'
        ? mensagem.time 
        : parseInt(mensagem.time);
      origemDoTimestamp = 'time';
    } else {
      timestamp = Date.now();
      origemDoTimestamp = 'gerado agora (fallback)';
    }
    
    console.log(`\n[Timestamp]: ${new Date(timestamp || Date.now()).toISOString()} (origem: ${origemDoTimestamp})`);
    
    // Verifica se conseguiu extrair número e texto
    if (!numero || !texto) {
      console.log('\n❌ FALHA FATAL: Após todas as tentativas, número ou texto não foram encontrados:', {
        numeroEncontrado: !!numero,
        textoEncontrado: !!texto
      });
      return null;
    }
    
    // Ignora mensagens enviadas pelo próprio sistema
    const isFromMe = mensagem.key?.fromMe === true || mensagem.fromMe === true;
    if (isFromMe) {
      console.log('\n⚠️ Mensagem enviada pelo próprio sistema, ignorando');
      return null;
    }
    
    // Obtém o nome da instância do webhook
    const instanceName = webhookData.instance?.instanceName || 
                        webhookData.instance?.name || 
                        webhookData.instanceName || 
                        'instancia-desconhecida';
    
    console.log('\n✅ MENSAGEM EXTRAÍDA COM SUCESSO:');
    console.log({
      instanceName,
      fromNumber: numero,
      messageContent: texto.length > 50 ? texto.substring(0, 50) + '...' : texto,
      messageId: id,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
    });
    
    return {
      instanceName,
      fromNumber: numero,
      messageContent: texto,
      messageId: id,
      timestamp,
      // Campos adicionais mantidos para compatibilidade com código existente
      numero: numero,
      texto: texto,
      id: id
    };
  } catch (error) {
    console.error('\n❌❌❌ ERRO CRÍTICO AO EXTRAIR MENSAGEM DO WEBHOOK:', error);
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Authentication routes
  setupAuth(app);
  
  // Rota para receber webhooks diretamente do Evolution API (como alternativa ao servidor de webhook externo)
  app.post('/webhook', async (req, res) => {
    try {
      console.log(`[EvolutionWebhook] Webhook direto recebido: ${JSON.stringify(req.body, null, 2)}`);
      
      // Valida se contém dados necessários
      if (!req.body || !req.body.key || !req.body.message) {
        console.log('[EvolutionWebhook] Webhook inválido: dados incompletos');
        return res.status(400).json({ success: false, message: 'Dados incompletos' });
      }
      
      // Extrai informações essenciais da mensagem
      const isGroup = req.body.key.remoteJid.includes('@g.us');
      const fromNumber = req.body.key.remoteJid.split('@')[0];
      
      // Extrai o nome da instância
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
      
      console.log(`[EvolutionWebhook] Instância detectada: ${instanceName}`);
      
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
      
      // Busca a instância no banco de dados
      const instances = await storage.getInstancesByName(instanceName);
      const instance = instances && instances.length > 0 ? instances[0] : null;
      if (!instance) {
        console.log(`[EvolutionWebhook] Instância não encontrada: ${instanceName}`);
        return res.status(404).json({ 
          success: false, 
          message: `Instância não encontrada: ${instanceName}`
        });
      }
      
      // Importa o manipulador de webhook diretamente
      const { processMessageDirectly } = await import('./direct-webhook-handler');
      
      // Processa a mensagem
      const result = await processMessageDirectly({
        instanceId: instance.id,
        instanceName: instance.name,
        fromNumber,
        messageContent,
        messageId: req.body.key.id,
        timestamp: req.body.messageTimestamp
      });
      
      console.log(`[EvolutionWebhook] Processamento direto: ${result ? 'Sucesso' : 'Nenhuma correspondência'}`);
      
      return res.status(200).json({
        success: true,
        message: result ? 'Palavra-chave detectada e processada' : 'Nenhuma palavra-chave correspondente',
        processed: result
      });
    } catch (error: any) {
      console.error(`[EvolutionWebhook] Erro no servidor de webhook: ${error.message}`);
      console.error(error.stack);
      
      return res.status(500).json({
        success: false,
        message: `Erro interno: ${error.message}`
      });
    }
  });
  
  // Endpoint para receber mensagens do servidor de webhook dedicado
  app.post("/api/process-message", processMessageHandler);

  // Rota para simular mensagens e testar o processamento de palavras-chave
  // Esta rota não requer autenticação para fins de teste direto
  app.post("/api/simulate-message", async (req, res) => {
    try {
      const { instanceId, phoneNumber, message, timestamp } = req.body;
      
      if (!instanceId || !phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Campos obrigatórios: instanceId, phoneNumber e message" 
        });
      }
      
      // Obtém a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: `Instância com ID ${instanceId} não encontrada` 
        });
      }
      
      // Processa a mensagem diretamente
      console.log(`[TEST] Processando mensagem de teste: ${message} de ${phoneNumber} para instância ${instance.name}`);
      
      // Use o processamento direto ignorando a verificação de status da instância
      const result = await processFlowsForInstance(
        instance,
        phoneNumber,
        message,
        timestamp || Date.now(),
        undefined,  // messageId opcional
        true // Enviar para webhook externo
      );
      
      // Log de resultado para popup
      if (result) {
        console.log(`[FLUXO SUCCESS] ✓ Fluxo acionado com sucesso pela mensagem "${message}" de ${phoneNumber}!`);
      } else {
        console.log(`[FLUXO INFO] ℹ️ Mensagem "${message}" processada, mas nenhum fluxo foi acionado.`);
      }
      
      return res.json({ 
        success: true, 
        message: result ? 
          "Mensagem processada com sucesso e fluxo acionado!" : 
          "Mensagem processada, mas nenhum fluxo foi acionado.",
        triggered: result,
        instanceName: instance.name,
        phoneNumber,
        messageContent: message
      });
      
    } catch (error: any) {
      console.error("Erro ao simular mensagem:", error);
      return res.status(500).json({ 
        success: false, 
        message: `Erro ao simular mensagem: ${error.message}` 
      });
    }
  });

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Not authenticated" });
  };

  // Instance routes
  app.get("/api/instances", isAuthenticated, async (req, res) => {
    try {
      // Primeiro, buscamos as instâncias armazenadas para este usuário
      const localInstances = await storage.getInstancesByUserId(req.user!.id);
      
      // Buscamos as instâncias na Evolution API para verificar estados atuais
      const evolutionResponse = await evolutionApi.getAllInstances();
      
      // Se ocorrer erro na API, continuamos com as instâncias locais
      if (!evolutionResponse.status) {
        console.error("Error fetching instances from Evolution API:", evolutionResponse.message);
        return res.json(localInstances);
      }
      
      // Lista de instâncias da Evolution API
      const evolutionInstances = evolutionResponse.instances || [];
      
      // Atualiza o estado das instâncias locais baseado nas informações da API
      const updatedInstances = await Promise.all(
        localInstances.map(async (instance) => {
          // Encontra a instância correspondente na Evolution API
          const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
          const evolutionData = await evolutionApi.getInstance(instanceName);
          
          if (evolutionData.status) {
            // Mapeia o estado da Evolution API para nossa aplicação
            // Corrigido para interpretar corretamente os estados da Evolution API v2
            let status = 'disconnected';
            
            // Extrair o estado da resposta corretamente conforme estrutura da Evolution API v2
            const evolutionState = 
                                  evolutionData.instance?.state || // Formato principal na API v2
                                  evolutionData.state || 
                                  evolutionData.status ||
                                  'disconnected';
                                  
            // Log detalhado para debug com o estado extraído corretamente
            console.log(`[Evolution API] Estado real de ${instanceName}: ${evolutionState}`);
            
            // O estado "open" na API Evolution v2 significa que a instância está conectada
            // Também considerar 'true' como estado conectado (formato boleano)
            if (evolutionState === 'open' || evolutionState === 'connected' || evolutionState === true || evolutionState === 'true') {
              status = 'connected';
              // Atualiza o último tempo de conexão se estiver conectado
              await storage.updateInstanceLastConnection(instance.id);
            } else if (evolutionState === 'connecting') {
              status = 'connecting';
            }
            
            // Atualiza o status no banco de dados
            const validStatus = status as "connected" | "disconnected" | "connecting";
            return await storage.updateInstanceStatus(instance.id, validStatus);
          }
          
          return instance;
        })
      );
      
      // Log para debug
      console.log(`Updated ${updatedInstances.length} instances with Evolution API data`);
      
      // Responde com as instâncias atualizadas
      res.json(updatedInstances);
    } catch (error) {
      console.error("Error fetching instances:", error);
      res.status(500).json({ message: "Error fetching instances" });
    }
  });

  app.post("/api/instances", isAuthenticated, async (req, res) => {
    try {
      const result = insertInstanceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid instance data", errors: result.error.errors });
      }

      // Formata o nome da instância para o formato da Evolution API
      // Sempre em minúsculas para garantir compatibilidade
      const instanceName = req.body.name.replace(/\s+/g, '_').toLowerCase();
      
      // Cria instância na Evolution API
      const evolutionResponse = await evolutionApi.createInstance(instanceName);

      if (!evolutionResponse.status) {
        return res.status(400).json({ message: `Failed to create instance in Evolution API: ${evolutionResponse.message}` });
      }

      // Registra atividade
      await storage.createActivity(req.user!.id, {
        type: "instance_created",
        description: `Instância "${req.body.name}" criada`,
        entityType: "instance",
        entityId: instanceName
      });

      // Cria instância no nosso armazenamento
      const instance = await storage.createInstance(req.user!.id, result.data);
      
      // Configura o webhook para a instância (será necessário para receber mensagens)
      const appUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
      const webhookUrl = `${appUrl}/api/webhook`;
      try {
        log(`[API] Configurando webhook para instância ${instanceName}: ${webhookUrl}`, 'express');
        await evolutionApi.setWebhook(instanceName, webhookUrl);
      } catch (webhookError) {
        // Apenas logamos o erro, não interrompemos o fluxo
        console.error("Erro ao configurar webhook:", webhookError);
      }
      
      res.status(201).json(instance);
    } catch (error: any) {
      console.error("Error creating instance:", error);
      res.status(500).json({ message: `Error creating instance: ${error.message}` });
    }
  });

  app.get("/api/instances/:id/qrcode", isAuthenticated, async (req, res) => {
    try {
      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this instance" });
      }

      // Formata o nome da instância para o formato da Evolution API
      const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
      
      try {
        // Na nova API, o método connectInstance já retorna o QR code diretamente
        log(`[API] Tentando conectar instância ${instanceName} para gerar QR code`, 'express');
        const connectResponse = await evolutionApi.connectInstance(instanceName);
        
        if (!connectResponse.status) {
          // Se falhar na conexão, pode ser porque a instância não existe na Evolution API ainda
          // Podemos tentar recriar a instância
          log(`[API] Falha ao conectar instância na API. Tentando criar novamente...`, 'express');
          const createResponse = await evolutionApi.createInstance(instanceName);
          
          if (!createResponse.status) {
            return res.status(400).json({ 
              message: `Failed to create instance in Evolution API: ${createResponse.message}` 
            });
          }
          
          // Agora tenta conectar novamente para obter o QR code
          const retryConnectResponse = await evolutionApi.connectInstance(instanceName);
          if (!retryConnectResponse.status) {
            return res.status(400).json({ 
              message: `Failed to connect instance in Evolution API after recreation: ${retryConnectResponse.message}` 
            });
          }
          
          // Se temos o QR code na resposta, retornamos diretamente
          if (retryConnectResponse.qrcode) {
            // Registra atividade
            await storage.createActivity(req.user!.id, {
              type: "instance_qrcode_requested",
              description: `QR Code solicitado para instância "${instance.name}"`,
              entityType: "instance",
              entityId: instance.id
            });
            
            return res.json({ qrcode: retryConnectResponse.qrcode });
          }
        }
        
        // Se temos o QR code na resposta inicial, retornamos diretamente
        if (connectResponse.qrcode) {
          // Registra atividade
          await storage.createActivity(req.user!.id, {
            type: "instance_qrcode_requested",
            description: `QR Code solicitado para instância "${instance.name}"`,
            entityType: "instance",
            entityId: instance.id
          });
          
          return res.json({ qrcode: connectResponse.qrcode });
        }
        
        // Se não tiver QR code nas respostas anteriores, fazemos uma solicitação específica
        log(`[API] QR code não obtido na conexão. Solicitando QR code especificamente`, 'express');
        const qrResponse = await evolutionApi.getQrCode(instanceName);
        
        if (!qrResponse.status || !qrResponse.qrcode) {
          return res.status(400).json({ 
            message: `Failed to get QR code from Evolution API: ${qrResponse.message}` 
          });
        }
  
        // Registra atividade
        await storage.createActivity(req.user!.id, {
          type: "instance_qrcode_requested",
          description: `QR Code solicitado para instância "${instance.name}"`,
          entityType: "instance",
          entityId: instance.id
        });
  
        // Retorna o QR code
        return res.json({ qrcode: qrResponse.qrcode });
      } catch (innerError: any) {
        return res.status(500).json({ 
          message: `Error processing QR code request: ${innerError.message}` 
        });
      }
    } catch (error: any) {
      console.error("Error getting QR code:", error);
      res.status(500).json({ message: `Error getting QR code: ${error.message}` });
    }
  });

  app.get("/api/instances/:id/connection-state", isAuthenticated, async (req, res) => {
    try {
      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this instance" });
      }

      // Formata o nome da instância para o formato da Evolution API
      // Sempre em minúsculas para garantir compatibilidade
      const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
      
      // Verifica o estado atual na Evolution API
      const stateResponse = await evolutionApi.checkConnectionState(instanceName);
      
      // Adiciona log detalhado da resposta para debug
      console.log(`[DEBUG] Estado da conexão para ${instanceName}:`, JSON.stringify(stateResponse, null, 2));
      
      if (!stateResponse.status) {
        return res.status(400).json({ 
          message: `Failed to check instance state in Evolution API: ${stateResponse.message}` 
        });
      }

      // Converte o estado da Evolution API para o formato da nossa aplicação
      let status = 'disconnected';
      
      // Log detalhado para debug dos valores possíveis de estado da Evolution API
      console.log(`[DEBUG] Estado original da API para ${instanceName}: "${stateResponse.state}"`);
      console.log(`[DEBUG] Resposta completa da API:`, JSON.stringify(stateResponse, null, 2));
      
      // Estados da Evolution API podem variar
      // CORREÇÃO: instância com "state": "open" deve ser tratada como CONECTADA (não desconectada)
      // Também aceitar valores booleanos true como "conectado"
      if (stateResponse.state === 'connected' || 
          stateResponse.state === 'open' || 
          stateResponse.state === true || 
          stateResponse.state === 'true') {
        status = 'connected';
        
        // Atualiza o status da instância no banco de dados para garantir
        await storage.updateInstanceStatus(req.params.id, "connected");
        await storage.updateInstanceLastConnection(req.params.id);
        
        console.log(`[DEBUG] Instância ${instanceName} marcada como CONECTADA. Estado original: "${stateResponse.state}"`);
      } else if (stateResponse.state === 'connecting' || stateResponse.state === 'qrcode') {
        status = 'connecting';
      }
      
      // Log adicional para confirmar que o status foi convertido corretamente
      console.log(`[DEBUG] Estado convertido para ${instanceName}: "${status}"`)

      // Se o estado mudou, atualiza o status na nossa aplicação
      if (instance.status !== status) {
        const validStatus = status as "connected" | "disconnected" | "connecting";
        await storage.updateInstanceStatus(req.params.id, validStatus);
        if (validStatus === "connected") {
          await storage.updateInstanceLastConnection(req.params.id);
        }

        // Registra atividade
        await storage.createActivity(req.user!.id, {
          type: "instance_state_updated",
          description: `Estado da instância "${instance.name}" atualizado para ${status}`,
          entityType: "instance",
          entityId: instance.id
        });
      }

      res.json({ 
        id: instance.id,
        name: instance.name,
        status: status,
        state: stateResponse.state,
        lastConnection: status === 'connected' ? new Date().toISOString() : instance.lastConnection
      });
    } catch (error: any) {
      console.error("Error checking instance state:", error);
      res.status(500).json({ message: `Error checking instance state: ${error.message}` });
    }
  });

  app.put("/api/instances/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["connected", "disconnected", "connecting"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Usamos uma conversão de tipo para garantir que o status é válido
      const validStatus = status as "connected" | "disconnected" | "connecting";

      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this instance" });
      }

      // Formata o nome da instância para o formato da Evolution API
      const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
      
      // Execute a ação na Evolution API com base no status desejado
      let evolutionResponse;
      if (status === "connected") {
        evolutionResponse = await evolutionApi.connectInstance(instanceName);
      } else {
        evolutionResponse = await evolutionApi.disconnectInstance(instanceName);
      }
      
      if (!evolutionResponse.status) {
        return res.status(400).json({ 
          message: `Failed to update instance status in Evolution API: ${evolutionResponse.message}` 
        });
      }

      // Atualiza o status na nossa aplicação
      const updatedInstance = await storage.updateInstanceStatus(req.params.id, validStatus);
      if (validStatus === "connected") {
        await storage.updateInstanceLastConnection(req.params.id);
        
        // Configura o webhook para a instância quando ela estiver conectada
        // Isso garante que sempre receberemos as mensagens desta instância
        const appUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
        const webhookUrl = `${appUrl}/api/webhook`;
        try {
          log(`[API] Configurando webhook para instância ${instanceName}: ${webhookUrl}`, 'express');
          await evolutionApi.setWebhook(instanceName, webhookUrl);
        } catch (webhookError) {
          // Apenas logamos o erro, não interrompemos o fluxo
          console.error("Erro ao configurar webhook:", webhookError);
        }
      }

      // Registra atividade
      let activityType = "instance_disconnected";
      let statusDesc = "desconectada";
      
      if (validStatus === "connected") {
        activityType = "instance_connected";
        statusDesc = "conectada";
      } else if (validStatus === "connecting") {
        activityType = "instance_connecting";
        statusDesc = "conectando";
      }
      
      await storage.createActivity(req.user!.id, {
        type: activityType,
        description: `Instância "${instance.name}" ${statusDesc}`,
        entityType: "instance",
        entityId: instance.id
      });

      res.json(updatedInstance);
    } catch (error: any) {
      console.error("Error updating instance status:", error);
      res.status(500).json({ message: `Error updating instance status: ${error.message}` });
    }
  });

  app.delete("/api/instances/:id", isAuthenticated, async (req, res) => {
    try {
      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this instance" });
      }

      // Formata o nome da instância para o formato da Evolution API
      const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
      
      // Tenta deletar na Evolution API primeiro
      const evolutionResponse = await evolutionApi.deleteInstance(instanceName);
      
      // Mesmo se falhar na API, continuamos com a exclusão local
      if (!evolutionResponse.status) {
        console.warn(`Failed to delete instance in Evolution API: ${evolutionResponse.message}`);
      }

      // Deleta localmente
      const result = await storage.deleteInstance(req.params.id);
      
      if (result) {
        // Registra atividade
        await storage.createActivity(req.user!.id, {
          type: "instance_deleted",
          description: `Instância "${instance.name}" deletada`,
          entityType: "instance",
          entityId: instance.id
        });
        
        res.sendStatus(204);
      } else {
        res.status(404).json({ message: "Instance not found" });
      }
    } catch (error: any) {
      console.error("Error deleting instance:", error);
      res.status(500).json({ message: `Error deleting instance: ${error.message}` });
    }
  });

  /**
   * Endpoint para obter as configurações de uma instância específica
   * GET /api/instances/:id/settings
   */
  app.get("/api/instances/:id/settings", isAuthenticated, async (req, res) => {
    try {
      const instanceId = req.params.id;
      
      // Busca a instância pelo ID
      const instance = await storage.getInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Instância não encontrada' 
        });
      }
      
      // Verifica se o usuário é proprietário da instância
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você não tem permissão para acessar esta instância' 
        });
      }
      
      // Chama a API para obter as configurações
      const settingsResponse = await evolutionApi.getSettings(instance.name);
      
      if (!settingsResponse.status) {
        return res.status(400).json({
          success: false,
          message: settingsResponse.message || 'Erro ao obter as configurações da instância',
          error: settingsResponse.error
        });
      }
      
      return res.json({
        success: true,
        settings: settingsResponse.result
      });
    } catch (error: any) {
      console.error('Erro ao obter configurações da instância:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao obter configurações da instância: ${error.message}`
      });
    }
  });
  
  /**
   * Endpoint para atualizar as configurações de uma instância específica
   * POST /api/instances/:id/settings
   */
  app.post("/api/instances/:id/settings", isAuthenticated, async (req, res) => {
    try {
      const instanceId = req.params.id;
      const settings = req.body;
      
      // Busca a instância pelo ID
      const instance = await storage.getInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Instância não encontrada' 
        });
      }
      
      // Verifica se o usuário é proprietário da instância
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você não tem permissão para modificar esta instância' 
        });
      }
      
      // Valida as configurações mínimas
      const validSettings = {
        ...(typeof settings.reject_call !== 'undefined' ? { reject_call: !!settings.reject_call } : {}),
        ...(typeof settings.read_messages !== 'undefined' ? { read_messages: !!settings.read_messages } : {}),
        ...(typeof settings.read_status !== 'undefined' ? { read_status: !!settings.read_status } : {})
      };
      
      // Chama a API para atualizar as configurações
      const settingsResponse = await evolutionApi.setSettings(instance.name, validSettings);
      
      if (!settingsResponse.status) {
        return res.status(400).json({
          success: false,
          message: settingsResponse.message || 'Erro ao atualizar as configurações da instância',
          error: settingsResponse.error
        });
      }
      
      // Registra a atividade
      await storage.createActivity(req.user!.id, {
        type: "update_settings",
        description: `Configurações atualizadas para instância ${instance.name}`,
        entityType: "instance",
        entityId: instance.id
      });
      
      return res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso',
        settings: settingsResponse.result
      });
    } catch (error: any) {
      console.error('Erro ao atualizar configurações da instância:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao atualizar configurações da instância: ${error.message}`
      });
    }
  });
  
  /**
   * Endpoint para aplicar configurações recomendadas para uma instância
   * POST /api/instances/:id/apply-recommended-settings
   */
  app.post("/api/instances/:id/apply-recommended-settings", isAuthenticated, async (req, res) => {
    try {
      const instanceId = req.params.id;
      
      // Busca a instância pelo ID
      const instance = await storage.getInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Instância não encontrada' 
        });
      }
      
      // Verifica se o usuário é proprietário da instância
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você não tem permissão para modificar esta instância' 
        });
      }
      
      // Configurações recomendadas para o melhor funcionamento do sistema
      const recommendedSettings = {
        reject_call: true,        // Rejeita chamadas automaticamente
        read_messages: true,      // Marca mensagens como lidas
        read_status: true,        // Marca status como visualizados
        msg_delete: true,         // Permite exclusão de mensagens
        groups_ignore: false      // Não ignora mensagens de grupos
      };
      
      // Primeiro configuramos o webhook
      const baseUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const webhookUrl = `${baseUrl}/api/webhook`;
      
      log(`[API] Configurando webhook para instância ${instance.name}: ${webhookUrl}`, 'express');
      
      const webhookResponse = await evolutionApi.setWebhook(instance.name, webhookUrl);
      
      if (!webhookResponse.status) {
        return res.status(400).json({
          success: false,
          message: webhookResponse.message || 'Erro ao configurar webhook',
          error: webhookResponse.error
        });
      }
      
      // Depois aplicamos as configurações recomendadas
      const settingsResponse = await evolutionApi.setSettings(instance.name, recommendedSettings);
      
      if (!settingsResponse.status) {
        return res.status(400).json({
          success: false,
          message: settingsResponse.message || 'Erro ao aplicar configurações recomendadas',
          error: settingsResponse.error
        });
      }
      
      // Registra a atividade
      await storage.createActivity(req.user!.id, {
        type: "apply_recommended_settings",
        description: `Configurações recomendadas aplicadas para instância ${instance.name}`,
        entityType: "instance",
        entityId: instance.id
      });
      
      return res.json({
        success: true,
        message: 'Configurações recomendadas aplicadas com sucesso',
        webhook: webhookResponse.result,
        settings: settingsResponse.result
      });
    } catch (error: any) {
      console.error('Erro ao aplicar configurações recomendadas:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao aplicar configurações recomendadas: ${error.message}`
      });
    }
  });

  // Message Flow routes
  app.get("/api/message-flows", isAuthenticated, async (req, res) => {
    try {
      const flows = await storage.getMessageFlowsByUserId(req.user!.id);
      res.json(flows);
    } catch (error) {
      console.error("Error fetching message flows:", error);
      res.status(500).json({ message: "Error fetching message flows" });
    }
  });

  app.post("/api/message-flows", isAuthenticated, async (req, res) => {
    try {
      const result = insertMessageFlowSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid message flow data", errors: result.error.errors });
      }

      // Check if instance exists and belongs to user
      const instance = await storage.getInstance(result.data.instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to use this instance" });
      }

      // Create message flow
      const flow = await storage.createMessageFlow(req.user!.id, result.data);
      res.status(201).json(flow);
    } catch (error) {
      console.error("Error creating message flow:", error);
      res.status(500).json({ message: "Error creating message flow" });
    }
  });

  app.put("/api/message-flows/:id", isAuthenticated, async (req, res) => {
    try {
      const result = messageFlowSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid message flow data", errors: result.error.errors });
      }

      // Verificar se o fluxo existe
      const flow = await storage.getMessageFlow(req.params.id);
      if (!flow) {
        return res.status(404).json({ message: "Fluxo de mensagens não encontrado" });
      }

      // Verificar se o usuário tem permissão para editar esse fluxo
      if (flow.userId !== req.user!.id) {
        return res.status(403).json({ message: "Não autorizado a atualizar este fluxo de mensagens" });
      }

      // Verificar se a instância pertence ao usuário
      if (result.data.instanceId !== flow.instanceId) {
        const instance = await storage.getInstance(result.data.instanceId);
        if (!instance) {
          return res.status(404).json({ message: "Instância não encontrada" });
        }

        if (instance.userId !== req.user!.id) {
          return res.status(403).json({ message: "Não autorizado a usar esta instância" });
        }
      }

      // Atualizar o fluxo de mensagens
      const updatedFlow = await storage.updateMessageFlow(req.params.id, result.data);
      res.json(updatedFlow);
    } catch (error) {
      console.error("Erro ao atualizar fluxo de mensagens:", error);
      res.status(500).json({ message: "Erro ao atualizar fluxo de mensagens" });
    }
  });

  app.put("/api/message-flows/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["active", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const flow = await storage.getMessageFlow(req.params.id);
      if (!flow) {
        return res.status(404).json({ message: "Message flow not found" });
      }

      if (flow.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this message flow" });
      }

      // Update message flow status
      const updatedFlow = await storage.updateMessageFlowStatus(req.params.id, status);
      res.json(updatedFlow);
    } catch (error) {
      console.error("Error updating message flow status:", error);
      res.status(500).json({ message: "Error updating message flow status" });
    }
  });

  app.delete("/api/message-flows/:id", isAuthenticated, async (req, res) => {
    try {
      const flow = await storage.getMessageFlow(req.params.id);
      if (!flow) {
        return res.status(404).json({ message: "Message flow not found" });
      }

      if (flow.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this message flow" });
      }

      // Delete message flow
      const result = await storage.deleteMessageFlow(req.params.id);
      if (result) {
        res.sendStatus(204);
      } else {
        res.status(404).json({ message: "Message flow not found" });
      }
    } catch (error) {
      console.error("Error deleting message flow:", error);
      res.status(500).json({ message: "Error deleting message flow" });
    }
  });
  
  // Rota para testar um fluxo de mensagem específico
  app.post("/api/message-flows/:id/test", isAuthenticated, async (req, res) => {
    try {
      const flowId = req.params.id;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "Número de telefone é obrigatório" 
        });
      }
      
      // Busca o fluxo de mensagem
      const flow = await storage.getMessageFlow(flowId);
      if (!flow) {
        return res.status(404).json({ 
          success: false, 
          message: `Fluxo de mensagem não encontrado` 
        });
      }
      
      // Verifica se o fluxo pertence ao usuário autenticado
      if (flow.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Você não tem permissão para testar este fluxo" 
        });
      }
      
      // Busca a instância associada ao fluxo
      const instance = await storage.getInstance(flow.instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: `Instância associada ao fluxo não encontrada` 
        });
      }
      
      // Registra atividade
      await storage.createActivity(req.user!.id, {
        type: 'test_flow',
        description: `Teste manual do fluxo "${flow.name}" para o número ${phoneNumber}`,
        entityId: flow.id,
        entityType: "message_flow",
        instanceId: instance.id
      });
      
      // Executa o fluxo de mensagens diretamente
      log(`[TEST] Testando fluxo de mensagens "${flow.name}" para ${phoneNumber} na instância ${instance.name}`, 'message-processor');
      
      // Dispara o fluxo de mensagens
      const result = await triggerMessageFlow(instance.name, flow, phoneNumber);
      
      res.json({
        success: true,
        message: `Fluxo de mensagens "${flow.name}" enviado com sucesso`,
        phoneNumber,
        flow: {
          id: flow.id,
          name: flow.name
        },
        instance: {
          id: instance.id,
          name: instance.name
        }
      });
    } catch (error: any) {
      console.error("[API ERROR] Erro ao testar fluxo de mensagens:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao testar fluxo de mensagens",
        error: error.message
      });
    }
  });

  // Activities routes
  app.get("/api/activities", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getActivitiesByUserId(req.user!.id, limit);
      res.json(activities);
    } catch (error: any) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Error fetching activities" });
    }
  });
  
  // Endpoint para processamento manual de mensagens
  app.post('/api/instance/:instanceId/process-messages', isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      // Captura o parâmetro sendToWebhook do corpo da requisição
      // Por padrão, sempre enviamos para webhook quando solicitado da interface
      const { sendToWebhook = true } = req.body || {};
      
      console.log(`[Process Messages] Processando mensagens para instância ${instanceId} com sendToWebhook=${sendToWebhook}`);
      
      // Verifica se a instância pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance || instance.userId !== req.user!.id) {
        return res.status(404).json({ message: "Instância não encontrada" });
      }
      
      // Chama a função de monitoramento do auto-responder
      const { monitorAndProcessNewMessages } = await import('./auto-responder');
      // Passa o parâmetro sendToWebhook para a função de monitoramento
      // Forçamos o valor para true para garantir que o webhook seja enviado
      const results = await monitorAndProcessNewMessages(instanceId, true);
      
      const processedCount = results.filter(result => result.success && result.processed).length;
      const errorCount = results.filter(result => !result.success).length;
      
      // Registra atividade
      await storage.createActivity(req.user!.id, {
        type: "messages_processed",
        description: `Processamento manual de mensagens na instância ${instance.name}: ${processedCount} processadas, ${errorCount} erros`,
        entityType: "instance",
        entityId: instanceId
      });
      
      return res.status(200).json({
        success: true,
        processedCount,
        errorCount,
        totalMessages: results.length,
        results: results.map(r => ({
          success: r.success,
          processed: r.processed,
          phoneNumber: r.phoneNumber,
          error: r.error ? r.error.message || String(r.error) : undefined
        }))
      });
    } catch (error: any) {
      console.error("Error processing messages:", error);
      return res.status(500).json({ 
        message: "Erro ao processar mensagens", 
        error: error.message 
      });
    }
  });

  // Endpoint direto para testar uma palavra-chave específica e enviar para webhook
  app.post("/api/test/keyword-direct", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, keyword, phoneNumber } = req.body;
      
      if (!instanceId || !keyword) {
        return res.status(400).json({ 
          success: false, 
          message: "Parâmetros inválidos. Forneça instanceId e keyword."
        });
      }
      
      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Acesso negado a esta instância" 
        });
      }
      
      // Testa a palavra-chave diretamente usando a função importada no início do arquivo
      const result = await testKeywordDirectly(instanceId, keyword, phoneNumber);
      
      // Registra a atividade
      await storage.createActivity(req.user!.id, {
        type: "keyword_test",
        description: `Teste direto de palavra-chave "${keyword}" na instância ${instance.name}`,
        entityType: "instance",
        entityId: instanceId
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("Erro ao testar palavra-chave diretamente:", error);
      return res.status(500).json({ 
        success: false, 
        message: `Erro ao testar palavra-chave: ${error.message}` 
      });
    }
  });
  
  /**
   * Endpoint para pegar o status atual do webhook
   * GET /api/webhook/status/:instanceId
   */
  app.get("/api/webhook/status/:instanceId", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;

      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada"
        });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado a esta instância"
        });
      }

      // Verifica o estado atual do webhook na Evolution API
      const baseUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
      const settings = await evolutionApi.getSettings(instance.name);

      const webhookInfo = {
        instanceName: instance.name,
        configuredWebhook: `${baseUrl}/api/webhook/${instance.name}`,
        webhookFromEvolutionApi: settings.status ? (settings.settings?.webhook?.url || 'Não configurado') : 'Erro ao obter configurações',
        webhookStatus: settings.status ? (settings.settings?.webhook?.enabled ? 'Ativo' : 'Inativo') : 'Desconhecido',
        isOnSameUrl: false
      };

      // Verifica se o webhook está configurado corretamente
      if (settings.status && settings.settings?.webhook?.url) {
        const evolutionWebhook = settings.settings.webhook.url;
        const ourWebhook = `${baseUrl}/api/webhook/${instance.name}`;
        webhookInfo.isOnSameUrl = evolutionWebhook === ourWebhook;
      }

      return res.json({
        success: true,
        webhook: webhookInfo
      });
    } catch (error: any) {
      console.error("Erro ao verificar status do webhook:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao verificar status do webhook: ${error.message}`
      });
    }
  });

  /**
   * Endpoint para testar webhook direto
   * POST /api/webhook/test-direct/:instanceId
   */
  app.post("/api/test/message-brazilian-timestamp", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, phoneNumber, messageContent } = req.body;
      
      if (!instanceId || !phoneNumber || !messageContent) {
        return res.status(400).json({ 
          success: false, 
          message: "ID da instância, número de telefone e conteúdo da mensagem são obrigatórios" 
        });
      }
      
      // Busca a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      // Verifica permissão
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Você não tem permissão para acessar esta instância" 
        });
      }
      
      // Cria um payload no formato brasileiro
      const currentDate = new Date();
      const formattedDate = formatDateBrazilian(currentDate);
      
      const payload = {
        messageContent: messageContent,
        sender: phoneNumber,
        timestamp: formattedDate
      };
      
      // Extrai os dados da mensagem usando nossa função
      const mensagemExtraida = extrairMensagemDaEvolutionAPI(payload);
      
      if (!mensagemExtraida) {
        return res.status(500).json({ 
          success: false, 
          message: "Não foi possível extrair a mensagem do payload" 
        });
      }
      
      log(`[TestTimestampBR] Simulando mensagem "${messageContent}" do número ${phoneNumber} para instância ${instance.name} com timestamp brasileiro`, 'test');
      
      // Processa a mensagem
      const processed = await processIncomingMessage(
        instance,
        phoneNumber,
        messageContent,
        mensagemExtraida.id,
        mensagemExtraida.timestamp,
        true // Envia para webhook
      );
      
      await storage.createActivity(req.user!.id, {
        type: "brazilian_timestamp_test",
        description: `Teste de mensagem com timestamp brasileiro realizado para o número ${phoneNumber}`,
        entityType: "instance",
        entityId: instance.id
      });
      
      return res.json({
        success: true,
        message: "Mensagem com timestamp brasileiro processada com sucesso",
        instance: {
          id: instance.id,
          name: instance.name
        },
        phoneNumber,
        messageContent,
        timestamp: formattedDate,
        timestampMs: mensagemExtraida.timestamp,
        timestampIso: mensagemExtraida.timestamp ? new Date(mensagemExtraida.timestamp).toISOString() : new Date().toISOString(),
        processed
      });
      
    } catch (error: any) {
      console.error("Erro ao testar mensagem com timestamp brasileiro:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao testar mensagem com timestamp brasileiro: ${error.message}` 
      });
    }
  });

  /**
   * Endpoint para testar webhook direto
   * POST /api/webhook/test-direct/:instanceId
   */
  app.post("/api/webhook/test-direct/:instanceId", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { message = "Mensagem de teste" } = req.body;
      
      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada"
        });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado a esta instância"
        });
      }
      
      // Cria um payload simulado da Evolution API que certamente será processado
      const testNumber = "5511999999999";
      const testPayload = {
        event: "messages.upsert",
        data: {
          messages: [
            {
              key: {
                remoteJid: `${testNumber}@s.whatsapp.net`,
                fromMe: false,
                id: `test-${Date.now()}`
              },
              message: {
                conversation: message
              },
              messageTimestamp: Math.floor(Date.now() / 1000)
            }
          ]
        }
      };
      
      console.log(`\n=== TESTE DIRETO DO WEBHOOK ===`);
      console.log(`Instância: ${instance.name} (${instance.id})`);
      console.log(`Mensagem de teste: "${message}"`);
      
      // Extrai a mensagem do payload simulado
      const mensagemExtraida = extrairMensagemDaEvolutionAPI(testPayload);
      
      if (!mensagemExtraida) {
        return res.status(500).json({
          success: false,
          message: "Falha na extração da mensagem do payload de teste"
        });
      }
      
      // Processa a mensagem como se fosse um webhook real
      const resultadoDireto = await processMessageDirectly({
        instanceId: instance.id,
        instanceName: instance.name,
        fromNumber: mensagemExtraida.numero,
        messageContent: mensagemExtraida.texto,
        messageId: mensagemExtraida.id,
        timestamp: mensagemExtraida.timestamp
      });
      
      // Verifica quais fluxos foram acionados
      const fluxos = await storage.getMessageFlowsByInstanceId(instance.id);
      const fluxosAtivos = fluxos.filter(flow => flow.status === "active");
      
      return res.json({
        success: true,
        message: `Teste de webhook executado com ${resultadoDireto ? 'sucesso' : 'resposta negativa'}`,
        palavra_chave_encontrada: resultadoDireto,
        detalhes: {
          instancia: {
            id: instance.id,
            nome: instance.name,
            status: instance.status
          },
          mensagem_extraida: mensagemExtraida,
          fluxos_ativos: fluxosAtivos.length,
          fluxos: fluxosAtivos.map(f => ({
            id: f.id,
            nome: f.name,
            palavra_chave: f.keyword,
            tipo_gatilho: f.triggerType
          }))
        }
      });
    } catch (error: any) {
      console.error("Erro ao testar webhook diretamente:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar webhook: ${error.message}`
      });
    }
  });

  /**
   * Endpoint aprimorado para testar o webhook diretamente com um payload personalizado ou da Evolution API
   * POST /api/test-webhook-payload
   */
  app.post("/api/test-webhook-payload", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, payload } = req.body;
      
      if (!instanceId || !payload) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios: instanceId e payload"
        });
      }
      
      // Obtém a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: `Instância com ID ${instanceId} não encontrada`
        });
      }
      
      // Verifica se pertence ao usuário
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para acessar esta instância"
        });
      }
      
      log(`[API] Testando processamento de webhook para instância ${instance.name}`, 'express');
      
      // Adiciona o ID da instância
      const webhookData = {
        ...payload,
        instance: {
          ...payload.instance,
          instanceId: instance.id
        }
      };
      
      // Extrai mensagem do payload
      const mensagem = extrairMensagemDaEvolutionAPI(webhookData);
      
      if (!mensagem) {
        return res.status(400).json({
          success: false,
          message: "Nenhuma mensagem válida encontrada no payload"
        });
      }
      
      // Processa a mensagem através do direct-webhook-handler
      const resultado = await processMessageDirectly({
        instanceId: instance.id,
        instanceName: instance.name || mensagem.instanceName,
        fromNumber: mensagem.fromNumber,
        messageContent: mensagem.messageContent,
        messageId: mensagem.messageId || `msg-${Date.now()}`,
        timestamp: mensagem.timestamp || Date.now()
      });
      
      // Também processa pelo webhook normal para garantir compatibilidade
      await processWebhook(webhookData);
      
      return res.json({
        success: true,
        message: `Mensagem processada ${resultado ? 'com' : 'sem'} acionamento de palavras-chave`,
        extracted: mensagem,
        webhookTriggered: resultado
      });
    } catch (error: any) {
      console.error("Erro ao testar webhook:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar webhook: ${error.message}`
      });
    }
  });

  /**
   * Endpoint para testar resposta automática à palavra-chave "chat"
   * Esta rota simula o recebimento da palavra-chave "chat" e testa o processamento automático
   * POST /api/test-auto-response
   */
  app.post("/api/test-auto-response", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, phoneNumber } = req.body;
      
      if (!instanceId) {
        return res.status(400).json({ 
          success: false, 
          message: "Parâmetro instanceId é obrigatório" 
        });
      }
      
      // Número de telefone padrão para teste se não for fornecido
      const testNumber = phoneNumber || "5511999999999";
      
      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Acesso negado a esta instância" 
        });
      }
      
      // Processa a mensagem com a palavra-chave "chat" diretamente
      const result = await processMessageDirectly({
        instanceId: instance.id,
        instanceName: instance.name,
        fromNumber: testNumber,
        messageContent: "chat",
        timestamp: Date.now()
      });
      
      // Registra a atividade
      await storage.createActivity(req.user!.id, {
        type: "auto_response_test",
        description: `Teste de resposta automática para palavra-chave "chat" na instância ${instance.name}`,
        entityType: "instance",
        entityId: instanceId
      });
      
      return res.json({
        success: result,
        message: result 
          ? "Processamento automático para palavra-chave 'chat' executado com sucesso" 
          : "Nenhuma resposta automática configurada para a palavra-chave 'chat'",
        instanceName: instance.name,
        phoneNumber: testNumber
      });
    } catch (error: any) {
      console.error("Erro ao testar resposta automática:", error);
      return res.status(500).json({ 
        success: false, 
        message: `Erro ao testar resposta automática: ${error.message}` 
      });
    }
  });
  
  // Webhook para processar mensagens recebidas (simulado)
  // Em produção, isso seria um endpoint público que a Evolution API chamaria
  app.post("/api/webhook/messages", async (req, res) => {
    try {
      // Simulação de uma mensagem recebida
      // Em produção, esta informação viria no corpo da requisição da Evolution API
      const {
        instanceName, // nome da instância que recebeu a mensagem
        fromNumber,   // número de quem enviou a mensagem
        message,      // texto da mensagem
        userId        // ID do usuário dono da instância
      } = req.body;
      
      if (!instanceName || !fromNumber || !message || !userId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Encontra a instância pelo nome
      const instance = await storage.getInstance(instanceName);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }
      
      // Busca fluxos de mensagens ativos para esta instância
      const flows = await storage.getMessageFlowsByInstanceId(instance.id);
      const activeFlows = flows.filter(flow => flow.status === "active");
      
      // Verifica se algum fluxo tem a palavra-chave que corresponde com a mensagem
      let matchedFlow = null;
      for (const flow of activeFlows) {
        const keyword = flow.keyword.toLowerCase();
        if (message.toLowerCase().includes(keyword)) {
          matchedFlow = flow;
          break;
        }
      }
      
      // Se encontrou um fluxo correspondente, processa as mensagens programadas
      if (matchedFlow) {
        // Registra atividade
        await storage.createActivity(userId, {
          type: "flow_triggered",
          description: `Fluxo "${matchedFlow.name}" acionado por mensagem de ${fromNumber}`,
          entityType: "message_flow",
          entityId: matchedFlow.id
        });
        
        // Em produção, aqui enviaríamos as mensagens programadas em sequência
        const messages = matchedFlow.messages;
        
        // Simula o envio de mensagens (apenas registra que seriam enviadas)
        for (const msg of messages) {
          // Agora tratamos os diferentes tipos de mensagem
          if (msg.type === 'text') {
            console.log(`[Simulação] Enviando texto para ${fromNumber}: "${msg.text}" (delay: ${msg.delay}ms)`);
          } else if (msg.type === 'image') {
            console.log(`[Simulação] Enviando imagem para ${fromNumber}: "${msg.mediaUrl}" ${msg.caption ? `com legenda: "${msg.caption}"` : ''} (delay: ${msg.delay}ms)`);
          } else if (msg.type === 'audio') {
            console.log(`[Simulação] Enviando áudio para ${fromNumber}: "${msg.mediaUrl}" ${msg.ptt ? '(nota de voz)' : ''} (delay: ${msg.delay}ms)`);
          } else if (msg.type === 'video') {
            console.log(`[Simulação] Enviando vídeo para ${fromNumber}: "${msg.mediaUrl}" ${msg.caption ? `com legenda: "${msg.caption}"` : ''} (delay: ${msg.delay}ms)`);
          } else if (msg.type === 'document') {
            console.log(`[Simulação] Enviando documento para ${fromNumber}: "${msg.mediaUrl}" (${msg.fileName}) (delay: ${msg.delay}ms)`);
          } else {
            console.log(`[Simulação] Enviando mensagem de tipo desconhecido para ${fromNumber} (delay: ${msg.delay}ms)`);
          }
        }
        
        return res.status(200).json({
          success: true,
          message: "Flow messages triggered",
          flowName: matchedFlow.name,
          messageCount: messages.length
        });
      }
      
      // Se não encontrou fluxo correspondente
      res.status(200).json({
        success: true,
        message: "No matching flow found for the message"
      });
    } catch (error: any) {
      console.error("Error processing incoming message:", error);
      res.status(500).json({ message: `Error processing message: ${error.message}` });
    }
  });
  
  // Rota para debug de envio de mensagem (ambiente de testes)
  app.post("/api/debug-message-send/:instanceId", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Número de telefone e mensagem são obrigatórios' });
      }
      
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Você não tem permissão para acessar esta instância' });
      }
      
      console.log(`[DEBUG] Enviando mensagem para ${phoneNumber} via instância ${instance.name} (ID: ${instanceId})`);
      console.log(`[DEBUG] Status da instância: ${instance.status}`);
      
      // Formata o número de telefone apropriadamente
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Garante que números brasileiros têm o código do país
      if (!formattedPhone.startsWith('55') && formattedPhone.length <= 11) {
        formattedPhone = `55${formattedPhone}`;
        console.log(`[DEBUG] Número formatado com código do país: ${formattedPhone}`);
      }
      
      // Cria o payload diretamente em vez de usar a função evolutionApi.sendMessage
      const payload = {
        number: formattedPhone,
        text: message,
        options: {
          delay: 1200,
          presence: "composing"
        }
      };
      
      console.log(`[DEBUG] Enviando com payload: ${JSON.stringify(payload, null, 2)}`);
      
      try {
        // Acessar a API diretamente
        const api = axios.create({
          baseURL: process.env.API_URL || 'https://api.membropro.com.br',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.API_KEY || 'd7275dd0964f87ba8ecb164cbe1aa921'
          }
        });
        
        // Chamada direta à API
        const response = await api.post(`/message/sendText/${instance.name}`, payload);
        
        console.log(`[DEBUG] Resposta da API:`, response.status, response.data);
        
        // Registra a atividade
        await storage.createActivity(req.user!.id, {
          type: "debug_message",
          description: `Mensagem de debug enviada para ${phoneNumber}`,
          entityType: "instance",
          entityId: instance.id
        });
        
        return res.json({ 
          success: true, 
          statusCode: response.status,
          data: response.data,
          instanceName: instance.name,
          phoneNumber: formattedPhone 
        });
      } catch (apiError: any) {
        console.error(`[DEBUG] Erro na chamada API:`, apiError?.response?.data || apiError.message);
        
        return res.status(400).json({ 
          error: 'Erro na API Evolution', 
          details: apiError?.response?.data || apiError.message,
          payload,
          instanceName: instance.name 
        });
      }
    } catch (error: any) {
      console.error('[DEBUG] Erro ao executar debug de mensagem:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  });
  
  // API para simular recebimento de mensagem (para testes)
  app.post("/api/instances/:id/simulate-received-message", isAuthenticated, async (req, res) => {
    try {
      const { fromNumber, message } = req.body;
      
      if (!fromNumber || !message) {
        return res.status(400).json({ message: "Phone number and message are required" });
      }
      
      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to use this instance" });
      }
      
      // Formata o nome da instância para o formato da Evolution API
      const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
      
      // Faz uma chamada interna ao webhook
      const webhookPayload = {
        instanceName: instance.id, // usamos o ID como identifier
        fromNumber,
        message,
        userId: req.user!.id
      };
      
      // Registra atividade de simulação
      await storage.createActivity(req.user!.id, {
        type: "message_simulation",
        description: `Mensagem simulada de ${fromNumber}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        entityType: "instance",
        entityId: instance.id
      });
      
      // Em vez de nossa própria lógica, usamos diretamente o processador de mensagens
      // Isso garantirá que o sistema use o mesmo comportamento que usaria para mensagens reais
      // incluindo o formato de resposta JSON com o campo "conversation" 
      const messageTimestamp = Date.now();
      const messageId = `simulated-${Date.now()}`;
      
      console.log(`[SIMULAÇÃO] Processando mensagem simulada:
        - De: ${fromNumber}
        - Mensagem: "${message}"
        - Instância: ${instance.name} (${instance.id})
        - ID: ${messageId}
        - Timestamp: ${new Date(messageTimestamp).toISOString()}
      `);
      
      // O processador de mensagens já está importado no topo do arquivo
      
      // Processa a mensagem usando o mesmo mecanismo de mensagens reais
      const processed = await processIncomingMessage(
        instance,
        fromNumber,
        message,
        messageId,
        messageTimestamp
      );
      
      if (processed) {
        return res.json({
          success: true,
          message: "Simulação processada com sucesso. Fluxo de mensagens acionado.",
          instance: {
            id: instance.id,
            name: instance.name
          },
          fromNumber,
          messageContent: message,
          flowTriggered: true
        });
      }
      
      // Se não encontrou fluxo correspondente
      res.status(200).json({
        success: true,
        message: "Nenhum fluxo correspondente encontrado para a mensagem",
        instance: {
          id: instance.id,
          name: instance.name
        },
        fromNumber,
        messageContent: message,
        flowTriggered: false
      });
    } catch (error: any) {
      console.error("Error simulating received message:", error);
      res.status(500).json({ message: `Error simulating message: ${error.message}` });
    }
  });

  // Rota para enviar mensagem através de uma instância
  app.post("/api/instances/:id/send-message", isAuthenticated, async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ message: "Phone number and message are required" });
      }
      
      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to use this instance" });
      }
      
      // Verifica se a instância está conectada
      if (instance.status !== "connected") {
        return res.status(400).json({ message: "Instance is not connected" });
      }

      // Formata o nome da instância para o formato da Evolution API
      const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
      
      // Envia a mensagem através da Evolution API
      const response = await evolutionApi.sendMessage(instanceName, phoneNumber, message);
      
      if (!response.status) {
        return res.status(400).json({ 
          message: `Failed to send message: ${response.message}` 
        });
      }
      
      // Registra atividade
      await storage.createActivity(req.user!.id, {
        type: "message_sent",
        description: `Mensagem enviada para ${phoneNumber} via instância "${instance.name}"`,
        entityType: "instance",
        entityId: instance.id
      });
      
      res.status(200).json({ 
        success: true, 
        message: "Message sent successfully",
        response: response.result
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: `Error sending message: ${error.message}` });
    }
  });

  // Webhook para receber notificações da Evolution API
  // Rota para testes de simulação de mensagens
  app.post("/api/test/simulate-message", isAuthenticated, async (req, res) => {
    try {
      const { instanceName, fromNumber, message } = req.body;
      
      if (!instanceName || !fromNumber || !message) {
        return res.status(400).json({ 
          message: "Dados inválidos. Forneça instanceName, fromNumber e message." 
        });
      }
      
      log(`[Test] Simulando mensagem. Instância: ${instanceName}, De: ${fromNumber}, Mensagem: "${message}"`, "test");
      
      // Usa o mesmo ID para mensagens simuladas
      const messageId = `simulated-test-${Date.now()}`;
      const messageTimestamp = Date.now();
      
      // Processa a mensagem diretamente sem passar pela API
      const processed = await processIncomingMessage(
        instanceName,
        fromNumber,
        message,
        messageId,
        messageTimestamp
      );
      
      if (processed) {
        log(`[Test] Mensagem simulada processada com sucesso`, "test");
        res.json({ 
          success: true, 
          message: "Mensagem processada com sucesso.",
          // Aqui retornamos o objeto completo com o campo conversation
          processed
        });
      } else {
        log(`[Test] Nenhum fluxo acionado para a mensagem simulada`, "test");
        res.json({ 
          success: true, 
          message: "Mensagem recebida, mas nenhum fluxo foi acionado."
        });
      }
    } catch (error: any) {
      log(`[Test] Erro ao simular mensagem: ${error.message}`, "test");
      console.error("[Test] Erro ao simular mensagem:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao simular mensagem: ${error.message}` 
      });
    }
  });

  // Endpoint para simular o webhook da Evolution API (via Evolution API)
  app.post("/api/test/webhook", isAuthenticated, async (req, res) => {
    try {
      const { instanceName, fromNumber, message } = req.body;
      
      if (!instanceName || !fromNumber || !message) {
        return res.status(400).json({ 
          message: "Dados inválidos. Forneça instanceName, fromNumber e message." 
        });
      }
      
      log(`[Test] Simulando webhook. Instância: ${instanceName}, De: ${fromNumber}, Mensagem: "${message}"`, "test");
      
      // Obtém a simulação da Evolution API
      const simulationResponse = await evolutionApi.simulateIncomingMessage(
        instanceName,
        fromNumber,
        message
      );
      
      if (!simulationResponse.status) {
        return res.status(400).json({ 
          success: false, 
          message: `Erro ao simular mensagem: ${simulationResponse.message}` 
        });
      }
      
      const mockWebhook = simulationResponse.mockMessage;
      
      // Fazer uma requisição para a nossa própria rota de webhook
      try {
        // Obtém a URL atual da aplicação
        const appUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
        const webhookUrl = `${appUrl}/api/webhook`;
        
        log(`[Test] Enviando webhook simulado para: ${webhookUrl}`, "test");
        
        // Envia a requisição para o webhook
        const axiosResponse = await axios.post(webhookUrl, mockWebhook, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        log(`[Test] Resposta do webhook: ${JSON.stringify(axiosResponse.data)}`, "test");
        
        res.json({ 
          success: true, 
          message: "Webhook simulado processado com sucesso.",
          webhookResponse: axiosResponse.data
        });
      } catch (webhookError: any) {
        log(`[Test] Erro ao enviar webhook simulado: ${webhookError.message}`, "test");
        return res.status(500).json({ 
          success: false, 
          message: `Erro ao enviar webhook simulado: ${webhookError.message}` 
        });
      }
    } catch (error: any) {
      log(`[Test] Erro ao simular webhook: ${error.message}`, "test");
      console.error("[Test] Erro ao simular webhook:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao simular webhook: ${error.message}` 
      });
    }
  });

  // Esta rota está duplicada mais abaixo. Comentada para evitar conflitos.
  /* 
  app.post("/api/webhook", async (req, res) => {
    try {
      log("[Webhook] Recebido webhook da Evolution API", "webhook");
      const webhookData = req.body;
      
      // Importamos o handler dedicado para processar o webhook
      // Adiciona logs para debug do formato do payload
      console.log(`[Webhook Debug] Payload recebido:`, JSON.stringify(webhookData, null, 2));
      
      // Verifica se o formato do payload precisa ser corrigido
      if (webhookData && webhookData.recieve && !webhookData.receive) {
        console.log(`[Webhook Debug] Corrigindo formato do payload de 'recieve' para 'receive'`);
        webhookData.receive = webhookData.recieve;
      }
      
      const webhookHandler = await import('./webhook-handler');
      // Usamos a função processWebhook exportada pelo módulo
      const result = await webhookHandler.processWebhook(webhookData);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      log(`[Webhook] Erro ao processar webhook: ${error.message}`, "webhook");
      console.error("[Webhook] Erro completo:", error);
      return res.status(500).json({ 
        success: false,
        message: `Erro ao processar webhook: ${error.message}`
      });
    }
  });
  */
  
  // Mantendo esta rota apenas para compatibilidade com versões antigas
  app.post("/api/webhook/legacy", async (req, res) => {
    try {
      log("[Webhook Legacy] Recebido webhook da Evolution API", "webhook");
      const webhookData = req.body;
      
      // Para melhor debug, gravamos o payload do webhook de forma mais legível
      try {
        console.log("[Webhook] Recebido webhook com dados:", 
          JSON.stringify(webhookData, (key, value) => {
            // Limitamos strings muito grandes para tornar o log mais legível
            if (typeof value === 'string' && value.length > 200) {
              return value.substring(0, 200) + '... (truncado)';
            }
            return value;
          }, 2)
        );
      } catch (error: any) {
        console.log("[Webhook] Não foi possível logar o payload completo:", error?.message || "Erro desconhecido");
      }
      
      // Log adicional para debug de tipos de eventos
      if (webhookData && webhookData.event) {
        log(`[Webhook] Tipo de evento recebido: ${webhookData.event}`, "webhook");
      } else {
        log(`[Webhook] Nenhum evento identificado no payload`, "webhook");
      }
      
      // Verifica se é um evento que não contém mensagens (atualização de status, etc)
      if (webhookData && webhookData.event && 
          (webhookData.event === 'status.instance' || 
           webhookData.event === 'connection.update' || 
           webhookData.event === 'qrcode.updated')) {
        log(`[Webhook] Evento de sistema/status recebido: ${webhookData.event}. Não processa mensagens.`, "webhook");
        return res.status(200).json({ 
          success: true,
          message: `Evento ${webhookData.event} recebido com sucesso`
        });
      }
      
      // Tratar diferentes formatos de webhook conforme documentação Evolution API v2
      let instanceName = '';
      let messages = [];
      
      // Extrai instância e verifica em múltiplos locais possíveis (compatibilidade com várias versões)
      instanceName = webhookData.instanceName || 
                    webhookData.instance || 
                    webhookData.waInstance || 
                    (webhookData.data && webhookData.data.instance) || 
                    '';
                    
      // Se não encontrou a instância, tenta outros métodos      
      if (!instanceName) {
        log(`[Webhook] Nome de instância não encontrado nos caminhos comuns. Buscando em outros campos...`, "webhook");
        
        // Procura em qualquer propriedade de primeiro nível
        for (const key in webhookData) {
          if (typeof webhookData[key] === 'string' && 
             (key.includes('instance') || key.includes('Instance'))) {
            instanceName = webhookData[key];
            log(`[Webhook] Nome de instância encontrado em campo alternativo ${key}: ${instanceName}`, "webhook");
            break;
          }
        }
      }
      
      // Detectando mensagens em diferentes formatos de payload
      
      // Formato 1: Evolution API v2 messages.upsert padrão (mais comum)
      if (webhookData.event === "messages.upsert" && webhookData.data && webhookData.data.messages) {
        messages = webhookData.data.messages;
        log(`[Webhook] Formato Evolution API v2: messages.upsert com ${messages.length} mensagem(ns)`, "webhook");
      } 
      // Formato 2: webhookSimple da Evolution API (formato resumido)
      else if (webhookData.key && webhookData.key.remoteJid && webhookData.message) {
        messages = [webhookData]; // O próprio payload é a mensagem
        log(`[Webhook] Formato webhookSimple detectado`, "webhook");
      }
      // Formato 3: formato direto/custom
      else if (webhookData.text || webhookData.body || webhookData.content) {
        // Cria um objeto de mensagem compatível com o nosso processador
        const phoneNumber = webhookData.from || webhookData.remoteJid || webhookData.sender || '';
        messages = [{
          key: { remoteJid: phoneNumber },
          message: { 
            conversation: webhookData.text || webhookData.body || webhookData.content 
          }
        }];
        log(`[Webhook] Formato direto/custom detectado`, "webhook");
      }
      // Formato 4: mensagens aninhadas em outro local
      else if (webhookData.data && typeof webhookData.data === 'object') {
        log(`[Webhook] Procurando mensagens em campos aninhados...`, "webhook");
        
        // Procura por campos que possam conter mensagens
        for (const key in webhookData.data) {
          if (Array.isArray(webhookData.data[key])) {
            messages = webhookData.data[key];
            log(`[Webhook] Mensagens encontradas em data.${key}, ${messages.length} mensagem(ns)`, "webhook");
            break;
          } else if (webhookData.data[key] && typeof webhookData.data[key] === 'object' && webhookData.data[key].message) {
            messages = [webhookData.data[key]];
            log(`[Webhook] Mensagem encontrada em data.${key}`, "webhook");
            break;
          }
        }
      }
      
      // Se não conseguimos identificar a instância após todas as tentativas
      if (!instanceName) {
        log(`[Webhook] ALERTA: Não foi possível identificar a instância no webhook. Payload desconhecido.`, "webhook");
        // Ainda retornamos 200 para evitar que a Evolution API continue tentando enviar
        return res.status(200).json({ 
          success: false, 
          message: "Não foi possível identificar a instância no webhook"
        });
      }
      
      // Se não temos mensagens, também retornamos
      if (!messages || messages.length === 0) {
        log(`[Webhook] Nenhuma mensagem encontrada no webhook para instância: ${instanceName}`, "webhook");
        return res.status(200).json({ 
          success: true,
          message: "Webhook recebido, mas sem mensagens para processar"
        });
      }
      
      // Log para debug da estrutura das mensagens encontradas
      try {
        log(`[Webhook] Estrutura das mensagens encontradas: ${JSON.stringify(messages[0])}`, "webhook");
      } catch (error: any) {
        log(`[Webhook] Não foi possível serializar a estrutura das mensagens para log: ${error?.message || "Erro desconhecido"}`, "webhook");
      }
      
      let successfullyProcessed = false;
      
      // Processa cada mensagem encontrada
      for (const message of messages) {
        try {
          // Ignorar mensagens enviadas pela própria instância (fromMe: true)
          if (message.key && message.key.fromMe === true) {
            log(`[Webhook] Ignorando mensagem enviada pela própria instância`, "webhook");
            continue;
          }
          
          let fromNumber = '';
          let messageContent = '';
          
          // Formato 1: estrutura completa do WhatsApp
          if (message.key && message.key.remoteJid) {
            fromNumber = message.key.remoteJid.split("@")[0];
            
            // O texto pode estar em diferentes locais dependendo do tipo de mensagem
            if (message.message) {
              if (message.message.conversation) {
                messageContent = message.message.conversation;
              } else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
                messageContent = message.message.extendedTextMessage.text;
              } else if (message.message.buttonsResponseMessage && message.message.buttonsResponseMessage.selectedDisplayText) {
                messageContent = message.message.buttonsResponseMessage.selectedDisplayText;
              } else if (message.message.listResponseMessage && message.message.listResponseMessage.title) {
                messageContent = message.message.listResponseMessage.title;
              }
            }
          } 
          // Formato 2: formato simplificado
          else if (message.from || message.remoteJid) {
            fromNumber = (message.from || message.remoteJid || '').split("@")[0];
            messageContent = message.text || message.body || message.content || '';
          }
          
          // Formato 3: formatos personalizados
          if (!messageContent && message.message) {
            // Tenta extrair a mensagem de qualquer propriedade do objeto message
            for (const key in message.message) {
              const msgObj = message.message[key];
              if (typeof msgObj === 'string') {
                messageContent = msgObj;
                log(`[Webhook] Mensagem extraída de campo alternativo message.${key}`, "webhook");
                break;
              } else if (msgObj && typeof msgObj === 'object' && msgObj.text) {
                messageContent = msgObj.text;
                log(`[Webhook] Mensagem extraída de campo aninhado message.${key}.text`, "webhook");
                break;
              }
            }
          }
          
          // Normaliza o número de telefone
          if (fromNumber) {
            // Trata @s.whatsapp.net e outros sufixos
            fromNumber = fromNumber.split('@')[0].split(':')[0];
            
            // Remove caracteres não numéricos 
            fromNumber = fromNumber.replace(/\D/g, '');
            
            // Assegura que o número tenha o formato internacional
            if (fromNumber.startsWith('+')) {
              fromNumber = fromNumber.substring(1); // Remove o + inicial se presente
            }
            
            // Para compatibilidade, assegura que o número brasileiro tenha o formato com DDD
            // Se o cliente processar mensagens de outros países, isso deve ser revisado
            if (!fromNumber.startsWith('55') && fromNumber.length >= 8 && fromNumber.length <= 11) {
              fromNumber = `55${fromNumber}`;
              log(`[Webhook] Número convertido para formato Brasil: ${fromNumber}`, "webhook");
            }
          }
          
          // Se não conseguimos extrair número e mensagem, pulamos
          if (!fromNumber || !messageContent) {
            log(`[Webhook] Não foi possível extrair número e mensagem dos dados`, "webhook");
            continue;
          }
          
          const timestamp = message.messageTimestamp || message.timestamp || Math.floor(Date.now() / 1000);
          
          log(`[Webhook] Mensagem processável recebida de ${fromNumber}: "${messageContent}"`, "webhook");
          
          // Processa a mensagem recebida
          const processed = await processIncomingMessage(
            instanceName,
            fromNumber,
            messageContent,
            timestamp
          );
          
          if (processed) {
            log(`[Webhook] ✅ Mensagem processada com sucesso para ${instanceName}`, "webhook");
            successfullyProcessed = true;
          } else {
            log(`[Webhook] ❌ Nenhum fluxo acionado para a mensagem de ${fromNumber}`, "webhook");
          }
        } catch (error: any) {
          // Convertemos o erro para um tipo conhecido
          const messageError = error instanceof Error 
            ? error 
            : new Error(typeof error === 'string' ? error : error?.message || 'Erro desconhecido');
            
          log(`[Webhook] Erro ao processar mensagem específica: ${messageError.message}`, "webhook");
          console.error(`[Webhook] Erro completo ao processar mensagem específica:`, messageError);
          // Continuamos processando as próximas mensagens
        }
      }
      
      // Retornamos 200 OK sempre para a Evolution API
      res.status(200).json({ 
        success: true,
        processed: successfullyProcessed,
        instance: instanceName,
        messageCount: messages.length
      });
    } catch (error: any) {
      log(`[Webhook] Erro geral ao processar webhook: ${error.message}`, "webhook");
      console.error("[Webhook] Erro completo ao processar webhook:", error);
      // Ainda retornamos 200 para evitar que a Evolution API fique retentando
      res.status(200).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Rota para testar o envio direto de mensagens via Evolution API
  app.post("/api/test-flow", requireAuth, async (req, res) => {
    try {
      const instanceId = req.body.instanceId;
      const phoneNumber = req.body.phoneNumber || "5511999999999";
      
      const instance = await storage.getInstance(instanceId);
      
      if (!instance) {
        return res.status(400).json({ success: false, message: "Instância não encontrada" });
      }
      
      // Gera um ID único para o fluxo
      const flowId = "test-flow-" + Date.now();
      const queuedFlowId = flowId + "-" + Math.floor(Math.random() * 10000);
      
      // Adiciona algumas mensagens à fila para testes
      const messageIds = messageQueueManager.enqueueMessageSequence(
        instance.name,
        phoneNumber,
        [
          { text: "Mensagem de teste 1", delayAfterMs: 2000 },
          { text: "Mensagem de teste 2", delayAfterMs: 3000 },
          { text: "Mensagem de teste 3", delayAfterMs: 0 }
        ],
        { 
          initialDelayMs: 1000, 
          flowName: "Fluxo de teste",
          flowId: flowId,
          queuedFlowId: queuedFlowId,
          recipientName: "Contato de Teste",
          triggerKeyword: "TESTE",
          triggerMessage: "Mensagem de teste para ativar fluxo"
        }
      );
      
      // Registra atividade
      await storage.createActivity(req.user!.id, {
        type: "flow_test_created",
        description: `Fluxo de teste criado para o número ${phoneNumber}`,
        entityType: "flow",
        entityId: flowId
      });
      
      return res.json({
        success: true,
        message: "Fluxo de teste adicionado com sucesso",
        messageIds,
        flowId,
        queuedFlowId
      });
    } catch (error: any) {
      console.error("Erro ao criar fluxo de teste:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/test/send-message", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, phoneNumber, message, forceProcess = true } = req.body;
      
      if (!instanceId || !phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          message: "Parâmetros incompletos. Forneça instanceId, phoneNumber e message."
        });
      }
      
      log(`[TestRoute] Testando envio direto de mensagem via instância ${instanceId}`, "test");
      
      // Importamos a função de teste de utilidade
      const { testDirectMessageSend } = await import('./test-utils');
      
      // Tenta enviar a mensagem
      const result = await testDirectMessageSend(instanceId, phoneNumber, message, forceProcess);
      
      // Registra atividade de teste
      if (req.user && req.user.id) {
        await storage.createActivity(req.user.id, {
          type: 'test_direct_message_sent',
          description: `Testou envio direto de mensagem "${message}" para ${phoneNumber} via instância ID: ${instanceId}`,
          entityType: 'instance',
          entityId: instanceId
        });
      }
      
      // Retorna o resultado
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      log(`[TestRoute] Erro ao testar envio direto de mensagem: ${error.message}`, "test");
      console.error("[TestRoute] Erro detalhado:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar envio direto de mensagem: ${error.message}`
      });
    }
  });
  
  // Rota para testar o processamento de mensagens (apenas em desenvolvimento)
  app.post("/api/test/message", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, phoneNumber, message, forceProcess } = req.body;
      
      if (!instanceId || !phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          message: "Parâmetros incompletos. Forneça instanceId, phoneNumber e message."
        });
      }
      
      log(`[TestRoute] Simulando mensagem recebida para instância ${instanceId}`, "test");
      
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada."
        });
      }
      
      // Se forceProcess=true e instância não está conectada, permite o teste mesmo assim
      if (forceProcess && instance.status !== 'connected') {
        log(`[TestRoute] Instância não está conectada, mas forceProcess=true. Permitindo teste.`, "test");
        
        // Alterar status temporariamente para permitir o teste
        const originalStatus = instance.status;
        instance.status = 'connected';
        
        try {
          // Processa a mensagem recebida diretamente com processFlowsForInstance
          const processed = await processFlowsForInstance(
            instance,
            phoneNumber,
            message
          );
          
          // Restaura status original
          instance.status = originalStatus;
          
          if (processed) {
            log(`[TestRoute] Teste forçado processado com sucesso. Fluxo acionado.`, "test");
            
            // Registra atividade de teste
            if (req.user && req.user.id) {
              await storage.createActivity(req.user.id, {
                type: 'test_message_sent',
                description: `Testou mensagem "${message}" para a instância "${instance.name}" (modo forçado)`,
                entityType: 'instance',
                entityId: instance.id
              });
            }
            
            return res.status(200).json({
              success: true,
              message: "Teste forçado processado com sucesso. Fluxo de mensagens acionado.",
              mode: "forced"
            });
          } else {
            log(`[TestRoute] Teste forçado processado, mas nenhum fluxo foi acionado.`, "test");
            return res.status(200).json({
              success: false,
              message: "Teste forçado processado, mas nenhum fluxo foi acionado. Verifique as palavras-chave.",
              mode: "forced"
            });
          }
        } catch (error: any) {
          // Restaura status original em caso de erro
          instance.status = originalStatus;
          throw error;
        }
      }
      
      // Processamento normal da mensagem
      const processed = await processIncomingMessage(
        instance.name,
        phoneNumber,
        message,
        `test-${Date.now()}`,
        Date.now(),
        true // Forçamos o envio para webhook externo
      );
      
      if (processed) {
        log(`[TestRoute] Mensagem de teste processada com sucesso. Fluxo acionado.`, "test");
        
        // Registra atividade de teste
        if (req.user && req.user.id) {
          await storage.createActivity(req.user.id, {
            type: 'test_message_sent',
            description: `Testou mensagem "${message}" para a instância "${instance.name}"`,
            entityType: 'instance',
            entityId: instance.id
          });
        }
        
        return res.status(200).json({
          success: true,
          message: "Mensagem processada com sucesso. Fluxo de mensagens acionado.",
          mode: "normal"
        });
      } else {
        log(`[TestRoute] Mensagem de teste processada, mas nenhum fluxo foi acionado.`, "test");
        return res.status(200).json({
          success: false,
          message: "Mensagem processada, mas nenhum fluxo foi acionado. Verifique as palavras-chave ou o status da instância.",
          mode: "normal"
        });
      }
    } catch (error: any) {
      log(`[TestRoute] Erro ao testar mensagem: ${error.message}`, "test");
      return res.status(500).json({
        success: false,
        message: `Erro ao testar mensagem: ${error.message}`
      });
    }
  });

  /**
   * Endpoint simplificado para testar webhook e acionamento de fluxos
   * POST /api/test-webhook-flow
   */
  app.post("/api/test-webhook-flow", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, message, phoneNumber = "5511999999999" } = req.body;
      
      if (!instanceId || !message) {
        return res.status(400).json({
          success: false,
          message: "instanceId e message são campos obrigatórios"
        });
      }
      
      // Busca a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada"
        });
      }
      
      // Verifica se a instância pertence ao usuário
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado a esta instância"
        });
      }
      
      // Cria um payload de teste
      const testPayload = {
        event: "messages.upsert",
        instance: {
          instanceName: instance.name
        },
        data: {
          messages: [
            {
              key: {
                remoteJid: `${phoneNumber}@s.whatsapp.net`,
                fromMe: false,
                id: `test-${Date.now()}`
              },
              message: {
                conversation: message
              },
              messageTimestamp: Math.floor(Date.now() / 1000)
            }
          ]
        }
      };
      
      console.log(`\n=== TESTE WEBHOOK FLUXO ===`);
      console.log(`Instância: ${instance.name} (${instance.id})`);
      console.log(`Mensagem de teste: "${message}"`);
      console.log(`Número: ${phoneNumber}`);
      
      // Extrai a mensagem do payload
      const mensagemExtraida = extrairMensagemDaEvolutionAPI(testPayload);
      
      if (!mensagemExtraida) {
        console.log("❌ Falha na extração da mensagem do payload");
        return res.status(500).json({
          success: false,
          message: "Falha na extração da mensagem do payload de teste"
        });
      }
      
      console.log("✅ Mensagem extraída com sucesso");
      
      // Processa a mensagem como se fosse um webhook real
      const { processMessageDirectly } = await import('./direct-webhook-handler');
      const resultadoDireto = await processMessageDirectly({
        instanceId: instance.id,
        instanceName: instance.name,
        fromNumber: mensagemExtraida.numero || mensagemExtraida.fromNumber,
        messageContent: mensagemExtraida.texto || mensagemExtraida.messageContent,
        messageId: mensagemExtraida.id || mensagemExtraida.messageId,
        timestamp: mensagemExtraida.timestamp
      });
      
      console.log(`${resultadoDireto ? '✅' : '❌'} Processamento direto: ${resultadoDireto ? 'SUCESSO' : 'Nenhuma correspondência'}`);
      
      // Busca os fluxos ativos para esta instância
      const fluxos = await storage.getMessageFlowsByInstanceId(instance.id);
      const fluxosAtivos = fluxos.filter(flow => flow.status === "active");
      
      // Retorna o resultado
      return res.json({
        success: true,
        message: resultadoDireto 
          ? "✅ Palavra-chave detectada e fluxo acionado com sucesso!" 
          : "⚠️ Mensagem processada, mas nenhum fluxo foi acionado (nenhuma palavra-chave correspondente)",
        palavra_chave_encontrada: resultadoDireto,
        detalhes: {
          instancia: {
            id: instance.id,
            nome: instance.name,
            status: instance.status
          },
          mensagem: {
            texto: message,
            numero: phoneNumber
          },
          fluxos_ativos: fluxosAtivos.length,
          fluxos: fluxosAtivos.map(f => ({ 
            id: f.id, 
            nome: f.name, 
            keywords: f.keywords,
            tipo_gatilho: f.triggerType
          }))
        }
      });
    } catch (error: any) {
      console.error("Erro ao testar webhook e fluxo:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar webhook e fluxo: ${error.message}`
      });
    }
  });

  /**
   * Endpoint para testar o acionamento de um fluxo específico
   * POST /api/test-flow-direct
   * 
   * Este endpoint utiliza o sistema dedicado de acionamento de fluxos, que garante
   * que os fluxos sejam acionados corretamente independentemente do estado da interface.
   */
  app.post("/api/test-flow-direct", isAuthenticated, async (req, res) => {
    try {
      const { flowId, phoneNumber = "5511999999999" } = req.body;
      
      if (!flowId) {
        return res.status(400).json({ 
          success: false, 
          message: "ID do fluxo é obrigatório" 
        });
      }
      
      // Log detalhado para diagnóstico
      console.log(`[TEST FLOW] Iniciando teste direto de fluxo:
        - ID do fluxo: ${flowId}
        - Número de telefone: ${phoneNumber}
        - Timestamp: ${new Date().toISOString()}
      `);
      
      const { testFlowTrigger } = await import('./flow-message-trigger');
      
      const result = await testFlowTrigger(flowId, phoneNumber);
      
      // Log detalhado do resultado
      console.log(`[TEST FLOW] Resultado do teste:
        - Sucesso: ${result.success}
        - Mensagem: ${result.message}
        - Detalhes: ${JSON.stringify(result.flowDetails || {})}
      `);
      
      res.json(result);
    } catch (error: any) {
      console.error("Erro ao testar fluxo diretamente:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao testar fluxo: ${error.message}` 
      });
    }
  });
  
  /**
   * Rota para testar o processamento direto de mensagens com debug detalhado
   * Útil para diagnosticar problemas de acionamento de fluxos
   */
  app.post("/api/test/message-processor", isAuthenticated, async (req, res) => {
    try {
      const { 
        instanceId,
        messageContent,
        fromNumber = "5511999999999"
      } = req.body;
      
      if (!instanceId || !messageContent) {
        return res.status(400).json({
          success: false,
          message: "instanceId e messageContent são obrigatórios"
        });
      }
      
      console.log(`[TEST MESSAGE PROCESSOR] Iniciando teste com parâmetros:
        - instanceId: ${instanceId}
        - messageContent: ${messageContent}
        - fromNumber: ${fromNumber}
        - Timestamp: ${new Date().toISOString()}
      `);
      
      // Busca a instância para ter o nome dela
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada"
        });
      }
      
      // Processa a mensagem diretamente, com log completo ativado
      const result = await processIncomingMessage(
        instance,
        fromNumber,
        messageContent,
        `test-${Date.now()}`,
        Date.now(),
        true // enviar para webhook externo
      );
      
      console.log(`[TEST MESSAGE PROCESSOR] Resultado do processamento: ${result ? 'Sucesso' : 'Sem correspondência'}`);
      
      res.json({
        success: true,
        messageProcessed: result,
        instanceName: instance.name,
        messageContent,
        fromNumber
      });
    } catch (error: any) {
      console.error("[TEST MESSAGE PROCESSOR] Erro:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao processar mensagem: ${error.message}`,
        error: error.stack
      });
    }
  });

  /**
   * Endpoint para sincronizar todas as instâncias com a Evolution API
   * POST /api/instances/sync-all
   */
  app.post("/api/instances/sync-all", isAuthenticated, async (req, res) => {
    try {
      // Busca todas as instâncias do usuário
      const instances = await storage.getInstancesByUserId(req.user!.id);
      
      if (!instances || instances.length === 0) {
        return res.json({ 
          message: "Não há instâncias para sincronizar", 
          updated: 0 
        });
      }
      
      const results = [];
      let updatedCount = 0;
      
      for (const instance of instances) {
        try {
          // Formata o nome da instância para o formato da Evolution API
          const instanceName = instance.name.replace(/\s+/g, '_').toLowerCase();
          
          // Verifica o estado atual na Evolution API
          const stateResponse = await evolutionApi.checkConnectionState(instanceName);
          
          // Se a verificação falhar, pula para a próxima instância
          if (!stateResponse.status) {
            results.push({
              id: instance.id,
              name: instance.name,
              success: false,
              message: stateResponse.message || "Falha ao verificar estado"
            });
            continue;
          }
          
          // Converte o estado da Evolution API para o formato da nossa aplicação
          let status = 'disconnected';
          
          // CORREÇÃO: instância com "state": "open" deve ser tratada como CONECTADA (não desconectada)
          if (stateResponse.state === 'connected' || stateResponse.state === 'open') {
            status = 'connected';
          } else if (stateResponse.state === 'connecting' || stateResponse.state === 'qrcode') {
            status = 'connecting';
          }
          
          console.log(`[InstanceSync] Estado da instância ${instanceName}: API=${stateResponse.state}, Convertido=${status}`);
          
          // Se o estado mudou, atualiza o status na nossa aplicação
          if (instance.status !== status) {
            const validStatus = status as "connected" | "disconnected" | "connecting";
            await storage.updateInstanceStatus(instance.id, validStatus);
            
            if (validStatus === "connected") {
              await storage.updateInstanceLastConnection(instance.id);
            }
            
            updatedCount++;
            
            results.push({
              id: instance.id,
              name: instance.name,
              success: true,
              oldStatus: instance.status,
              newStatus: status,
              message: `Estado atualizado de ${instance.status} para ${status}`
            });
          } else {
            results.push({
              id: instance.id,
              name: instance.name,
              success: true,
              status: status,
              message: "Estado já está sincronizado"
            });
          }
        } catch (instanceError: any) {
          console.error(`Erro ao sincronizar instância ${instance.name}:`, instanceError);
          results.push({
            id: instance.id,
            name: instance.name,
            success: false,
            message: `Erro: ${instanceError.message}`
          });
        }
      }
      
      return res.json({
        message: `Sincronização concluída. ${updatedCount} instâncias atualizadas.`,
        updated: updatedCount,
        results: results
      });
    } catch (error: any) {
      console.error("Erro na sincronização de instâncias:", error);
      return res.status(500).json({ 
        message: `Erro na sincronização: ${error.message}`, 
        error: error 
      });
    }
  });

  // Analytics routes
  app.get("/api/analytics/summary", isAuthenticated, async (req, res) => {
    try {
      const { period = "7d", instanceId = "all" } = req.query;
      const data = await analyticsService.getSummary(
        req.user!.id, 
        period as string, 
        instanceId !== "all" ? instanceId as string : undefined
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ message: `Error fetching analytics summary: ${error.message}` });
    }
  });

  app.get("/api/analytics/message-volume", isAuthenticated, async (req, res) => {
    try {
      const { period = "7d", instanceId = "all" } = req.query;
      const data = await analyticsService.getMessageVolume(
        req.user!.id, 
        period as string, 
        instanceId !== "all" ? instanceId as string : undefined
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching message volume data:", error);
      res.status(500).json({ message: `Error fetching message volume data: ${error.message}` });
    }
  });

  app.get("/api/analytics/instances-performance", isAuthenticated, async (req, res) => {
    try {
      const { period = "7d" } = req.query;
      const data = await analyticsService.getInstancesPerformance(
        req.user!.id, 
        period as string
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching instances performance data:", error);
      res.status(500).json({ message: `Error fetching instances performance data: ${error.message}` });
    }
  });

  app.get("/api/analytics/flows-performance", isAuthenticated, async (req, res) => {
    try {
      const { period = "7d", instanceId = "all" } = req.query;
      const data = await analyticsService.getFlowsPerformance(
        req.user!.id, 
        period as string, 
        instanceId !== "all" ? instanceId as string : undefined
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching flows performance data:", error);
      res.status(500).json({ message: `Error fetching flows performance data: ${error.message}` });
    }
  });

  // Rotas para o auto-responder
  app.post("/api/auto-responder/start", isAuthenticated, async (req, res) => {
    try {
      const { intervalMinutes = 2 } = req.body;
      
      // Importamos dinâmicamente para evitar dependências circulares
      const { startAutoMonitoring } = await import('./auto-responder');
      
      startAutoMonitoring(intervalMinutes);
      
      res.json({ 
        success: true, 
        message: `Monitoramento automático iniciado com intervalo de ${intervalMinutes} minutos` 
      });
    } catch (error: any) {
      console.error("Error starting auto monitoring:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao iniciar monitoramento: ${error.message}` 
      });
    }
  });
  
  app.post("/api/auto-responder/stop", isAuthenticated, async (req, res) => {
    try {
      // Importamos dinâmicamente para evitar dependências circulares
      const { stopAutoMonitoring } = await import('./auto-responder');
      
      stopAutoMonitoring();
      
      res.json({ 
        success: true, 
        message: "Monitoramento automático interrompido" 
      });
    } catch (error: any) {
      console.error("Error stopping auto monitoring:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao interromper monitoramento: ${error.message}` 
      });
    }
  });
  
  app.post("/api/auto-responder/process/:instanceId", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      // Verificar se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Acesso negado a esta instância" 
        });
      }
      
      // Importamos dinâmicamente para evitar dependências circulares
      const { monitorAndProcessNewMessages } = await import('./auto-responder');
      
      console.log(`[AutoResponder] Processando mensagens para instância ${instanceId} com envio para webhook externo`);
      
      // Forçamos o envio para webhook externo definindo o segundo parâmetro como true
      const results = await monitorAndProcessNewMessages(instanceId, true);
      
      res.json({ 
        success: true, 
        message: `Processamento concluído para a instância ${instance.name}`,
        results,
        processedCount: results.filter(r => r.processed).length,
        totalMessages: results.length
      });
    } catch (error: any) {
      console.error("Error processing messages:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao processar mensagens: ${error.message}` 
      });
    }
  });
  
  app.post("/api/auto-responder/reply", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, phoneNumber, message, quotedMessageId } = req.body;
      
      if (!instanceId || !phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Dados inválidos. Forneça instanceId, phoneNumber e message." 
        });
      }
      
      // Verificar se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Acesso negado a esta instância" 
        });
      }
      
      // Importamos dinâmicamente para evitar dependências circulares
      const { sendDirectResponse } = await import('./auto-responder');
      
      const success = await sendDirectResponse(
        instanceId,
        phoneNumber,
        message,
        quotedMessageId
      );
      
      if (success) {
        res.json({ 
          success: true, 
          message: `Mensagem enviada com sucesso para ${phoneNumber}` 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Erro ao enviar mensagem" 
        });
      }
    } catch (error: any) {
      console.error("Error sending direct response:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao enviar resposta: ${error.message}` 
      });
    }
  });
  
  app.get("/api/analytics/top-triggers", isAuthenticated, async (req, res) => {
    try {
      const { period = "7d", instanceId = "all" } = req.query;
      const data = await analyticsService.getTopTriggers(
        req.user!.id, 
        period as string, 
        instanceId !== "all" ? instanceId as string : undefined
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching top triggers data:", error);
      res.status(500).json({ message: `Error fetching top triggers data: ${error.message}` });
    }
  });
  
  /**
   * Endpoint unificado para testar o processamento de webhooks e fluxos de mensagens
   * Fornece uma resposta detalhada sobre o que acontece em cada etapa
   * POST /api/test/webhook-and-flow-unified
   */
  app.post("/api/test/webhook-and-flow-unified", isAuthenticated, async (req, res) => {
    try {
      const { 
        instanceId, 
        messageContent, 
        fromNumber = "5511999999999",
        triggerType = "direct" // direct, webhook, both
      } = req.body;
      
      if (!instanceId || !messageContent) {
        return res.status(400).json({
          success: false,
          message: "instanceId e messageContent são obrigatórios"
        });
      }
      
      // Busca a instância para ter o nome dela
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada"
        });
      }
      
      // Cria um objeto para rastrear cada etapa do processamento
      const diagnostic = {
        timestamp: new Date().toISOString(),
        instance: {
          id: instance.id,
          name: instance.name,
          status: instance.status
        },
        input: {
          messageContent,
          fromNumber,
          triggerType
        },
        steps: [] as any[],
        summary: {
          success: false,
          messageProcessed: false,
          flowTriggered: false,
          webhookTriggered: false,
          errors: [] as string[]
        }
      };
      
      // Adiciona logs detalhados para cada etapa
      const logStep = (step: string, data: any) => {
        console.log(`[UNIFIED TEST] ${step}:`, JSON.stringify(data));
        diagnostic.steps.push({
          step,
          timestamp: new Date().toISOString(),
          data
        });
      };
      
      logStep("Iniciando teste", { 
        instanceName: instance.name, 
        messageContent, 
        fromNumber 
      });
      
      // Passo 1: Testar processamento direto via message-processor
      if (triggerType === "direct" || triggerType === "both") {
        try {
          logStep("Processando via message-processor", { method: "processIncomingMessage" });
          
          const messageId = `test-${Date.now()}`;
          const timestamp = Date.now();
          
          const directResult = await processIncomingMessage(
            instance,
            fromNumber,
            messageContent,
            messageId,
            timestamp,
            true // enviar para webhook externo
          );
          
          logStep("Resultado do processamento direto", { 
            processed: directResult,
            messageId,
            timestamp
          });
          
          diagnostic.summary.messageProcessed = true;
          diagnostic.summary.flowTriggered = !!directResult;
        } catch (directError: any) {
          const errorMsg = `Erro no processamento direto: ${directError.message}`;
          console.error("[UNIFIED TEST] " + errorMsg);
          diagnostic.summary.errors.push(errorMsg);
          logStep("Erro no processamento direto", { 
            error: directError.message,
            stack: directError.stack
          });
        }
      }
      
      // Passo 2: Testar via webhook-handler
      if (triggerType === "webhook" || triggerType === "both") {
        try {
          logStep("Preparando payload de webhook", { method: "processWebhook" });
          
          // Cria um payload de webhook simulado
          const webhookPayload = {
            instance: {
              instanceName: instance.name,
              instanceId: instance.id
            },
            event: "messages.upsert",
            data: {
              message: {
                from: fromNumber,
                body: messageContent,
                id: `webhook-test-${Date.now()}`
              }
            }
          };
          
          // Processa o webhook
          const webhookResult = await processWebhook(webhookPayload);
          
          logStep("Resultado do processamento via webhook", webhookResult);
          
          diagnostic.summary.webhookTriggered = webhookResult.success || false;
        } catch (webhookError: any) {
          const errorMsg = `Erro no processamento via webhook: ${webhookError.message}`;
          console.error("[UNIFIED TEST] " + errorMsg);
          diagnostic.summary.errors.push(errorMsg);
          logStep("Erro no processamento via webhook", { 
            error: webhookError.message,
            stack: webhookError.stack
          });
        }
      }
      
      // Passo 3: Testar usando o direct-webhook-handler
      try {
        logStep("Processando via direct-webhook-handler", { method: "processMessageDirectly" });
        
        const directWebhookResult = await processMessageDirectly({
          instanceId: instance.id,
          instanceName: instance.name,
          fromNumber,
          messageContent,
          messageId: `direct-webhook-${Date.now()}`,
          timestamp: Date.now()
        });
        
        logStep("Resultado do processamento via direct-webhook-handler", directWebhookResult);
      } catch (directWebhookError: any) {
        const errorMsg = `Erro no direct-webhook-handler: ${directWebhookError.message}`;
        console.error("[UNIFIED TEST] " + errorMsg);
        diagnostic.summary.errors.push(errorMsg);
        logStep("Erro no direct-webhook-handler", { 
          error: directWebhookError.message,
          stack: directWebhookError.stack
        });
      }
      
      // Finaliza e determina o status geral
      diagnostic.summary.success = 
        diagnostic.summary.flowTriggered || 
        diagnostic.summary.webhookTriggered || 
        diagnostic.summary.messageProcessed;
      
      // Registra atividade
      await storage.createActivity(req.user!.id, {
        type: "webhook_flow_test",
        description: `Teste unificado de webhook e fluxo para mensagem "${messageContent.substring(0, 30)}${messageContent.length > 30 ? '...' : ''}"`,
        entityType: "instance",
        entityId: instance.id,
        status: diagnostic.summary.success ? "success" : "error"
      });
      
      console.log(`[UNIFIED TEST] Teste concluído com ${diagnostic.summary.success ? 'sucesso' : 'falha'}`);
      
      return res.json(diagnostic);
    } catch (error: any) {
      console.error("[UNIFIED TEST] Erro geral:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao executar teste unificado: ${error.message}`,
        stack: error.stack
      });
    }
  });

  /**
   * Endpoint para testar a detecção de erros no devtools
   * Útil para verificar se os erros estão sendo propagados corretamente para o frontend
   * GET /api/debug/errors-test
   */
  app.get("/api/test/error-detection", isAuthenticated, async (req, res) => {
    try {
      const { type = "server" } = req.query;
      
      console.log(`[DEBUG] Testando detecção de erro do tipo: ${type}`);
      
      if (type === "server") {
        // Simula um erro de servidor (500)
        throw new Error("Erro de servidor simulado para teste de detecção!");
      } else if (type === "validation") {
        // Simula um erro de validação (400)
        return res.status(400).json({
          error: true,
          message: "Erro de validação simulado para teste",
          validationErrors: {
            field1: "Campo obrigatório",
            field2: "Formato inválido"
          }
        });
      } else if (type === "auth") {
        // Simula um erro de autenticação (401)
        return res.status(401).json({
          error: true,
          message: "Erro de autenticação simulado para teste"
        });
      } else if (type === "notfound") {
        // Simula um erro de recurso não encontrado (404)
        return res.status(404).json({
          error: true,
          message: "Recurso não encontrado (simulado para teste)"
        });
      } else if (type === "timeout") {
        // Simula um timeout
        await new Promise(resolve => setTimeout(resolve, 30000));
        return res.json({ success: true });
      } else {
        // Erro desconhecido
        return res.status(500).json({
          error: true, 
          message: "Tipo de erro desconhecido"
        });
      }
    } catch (error: any) {
      // Log detalhado do erro para depuração
      console.error("[TEST ERROR DETECTION] Erro capturado:", error);
      console.error("[TEST ERROR DETECTION] Stack trace:", error.stack);
      
      // Retorna erro com detalhes para o frontend
      return res.status(500).json({
        error: true,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Rota para buscar mensagens direto da Evolution API
  app.get("/api/instance/:instanceId/messages", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { page = "1", limit = "50", remoteJid } = req.query;
      
      // Valida se o usuário tem acesso à instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Instância não encontrada" });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Você não tem acesso a esta instância" });
      }
      
      log(`[API] Buscando mensagens para instância ${instance.name}`, "api");
      
      // Busca mensagens na Evolution API
      const messagesResponse = await evolutionApi.findMessages(
        instance.name,
        remoteJid as string | undefined,
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );
      
      if (!messagesResponse.status) {
        return res.status(400).json({ 
          message: `Erro ao buscar mensagens: ${messagesResponse.message}` 
        });
      }
      
      // Retorna todas as mensagens encontradas
      res.json({
        instance: instance.name,
        messages: messagesResponse.result
      });
    } catch (error: any) {
      console.error("Error fetching messages from Evolution API:", error);
      res.status(500).json({ 
        message: `Erro ao buscar mensagens: ${error.message}` 
      });
    }
  });

  // Rota para buscar contatos de uma instância
  app.get("/api/instance/:instanceId/contacts", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      // Valida se o usuário tem acesso à instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Instância não encontrada" });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Você não tem acesso a esta instância" });
      }
      
      log(`[API] Buscando contatos para instância ${instance.name}`, "api");
      
      // Busca contatos na Evolution API
      const contactsResponse = await evolutionApi.getAllContacts(instance.name);
      
      if (!contactsResponse.status) {
        return res.status(400).json({ 
          message: `Erro ao buscar contatos: ${contactsResponse.message}` 
        });
      }
      
      // Formata os contatos para enviar ao cliente
      const formattedContacts = (contactsResponse.contacts || []).map((contact: any) => {
        // Identifica o número de telefone do contato
        let phoneNumber = contact.id?.user || contact.id;
        
        // Remove o @s.whatsapp.net ou @c.us se presente
        if (typeof phoneNumber === 'string') {
          phoneNumber = phoneNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
        }
        
        return {
          phoneNumber,
          name: contact.name || contact.shortName || contact.notify || null,
          pushName: contact.pushName || null,
          isGroup: contact.isGroup || false,
          isMyContact: contact.isMyContact || false
        };
      });
      
      // Filtrar apenas os contatos válidos (não grupos, a menos que solicitado)
      const showGroups = req.query.showGroups === 'true';
      const filteredContacts = formattedContacts.filter((contact: any) => {
        // Inclui apenas não-grupos ou grupos se showGroups=true
        return (showGroups || !contact.isGroup);
      });
      
      res.json(filteredContacts);
    } catch (error: any) {
      console.error("Error fetching contacts from Evolution API:", error);
      res.status(500).json({ 
        message: `Erro ao buscar contatos: ${error.message}` 
      });
    }
  });
  
  // Rota para enviar mensagens em massa
  app.post("/api/send-mass-message", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, message, contacts, delayBetweenMessages = 2 } = req.body;
      
      if (!instanceId || !message || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ 
          message: "Parâmetros inválidos. Forneça instanceId, message e contacts[]."
        });
      }
      
      // Valida se o usuário tem acesso à instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Instância não encontrada" });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Você não tem acesso a esta instância" });
      }
      
      if (instance.status !== 'connected') {
        return res.status(400).json({ message: "Instância não está conectada" });
      }
      
      log(`[API] Enviando mensagem em massa para ${contacts.length} contatos via instância ${instance.name}`, "api");
      
      // Array para armazenar resultados
      const results: {
        phoneNumber: string;
        success: boolean;
        message?: string;
      }[] = [];
      
      // Processa cada contato com um atraso entre eles
      for (let i = 0; i < contacts.length; i++) {
        const phoneNumber = contacts[i];
        
        try {
          // Envia a mensagem via Evolution API
          const sendResult = await evolutionApi.sendMessage(
            instance.name,
            phoneNumber,
            message
          );
          
          // Registra o resultado
          results.push({
            phoneNumber,
            success: sendResult.status,
            message: sendResult.status ? "Enviado com sucesso" : sendResult.message
          });
          
          // Registra atividade
          await storage.createActivity(req.user!.id, {
            type: "message_sent",
            description: `Mensagem em massa enviada para ${phoneNumber}`,
            entityType: "instance",
            entityId: instance.id
          });
          
          log(`[API] Mensagem em massa enviada para ${phoneNumber}: ${sendResult.status ? 'sucesso' : 'falha'}`, "api");
          
          // Aguarda o atraso configurado antes da próxima mensagem (exceto para a última)
          if (i < contacts.length - 1 && delayBetweenMessages > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenMessages * 1000));
          }
        } catch (error: any) {
          log(`[API] Erro ao enviar mensagem para ${phoneNumber}: ${error.message}`, "api");
          
          // Registra falha
          results.push({
            phoneNumber,
            success: false,
            message: `Erro: ${error.message}`
          });
        }
      }
      
      // Conta os sucessos e falhas
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      res.json({
        message: `Processamento de mensagens em massa concluído`,
        totalCount: contacts.length,
        successCount,
        failedCount,
        results
      });
    } catch (error: any) {
      console.error("Error sending mass messages:", error);
      res.status(500).json({ 
        message: `Erro ao enviar mensagens em massa: ${error.message}` 
      });
    }
  });
  
  // Rota para enviar fluxos de mensagens em massa
  app.post("/api/send-flow-mass", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, flowId, contacts, delayBetweenContacts = 5 } = req.body;
      
      if (!instanceId || !flowId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ 
          message: "Parâmetros inválidos. Forneça instanceId, flowId e contacts[]."
        });
      }
      
      // Valida se o usuário tem acesso à instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Instância não encontrada" });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Você não tem acesso a esta instância" });
      }
      
      if (instance.status !== 'connected') {
        return res.status(400).json({ message: "Instância não está conectada" });
      }
      
      // Busca o fluxo de mensagens
      const flow = await storage.getMessageFlow(flowId);
      if (!flow) {
        return res.status(404).json({ message: "Fluxo de mensagens não encontrado" });
      }
      
      if (flow.userId !== req.user!.id) {
        return res.status(403).json({ message: "Você não tem acesso a este fluxo de mensagens" });
      }
      
      if (flow.instanceId !== instanceId) {
        return res.status(400).json({ message: "O fluxo não pertence à instância selecionada" });
      }
      
      log(`[API] Enviando fluxo de mensagens "${flow.name}" em massa para ${contacts.length} contatos via instância ${instance.name}`, "api");
      
      // Importar a função que dispara fluxos
      const { triggerMessageFlow } = await import('./message-processor');
      
      // Array para armazenar resultados
      const results: {
        phoneNumber: string;
        success: boolean;
        message?: string;
      }[] = [];
      
      // Processa cada contato com um atraso entre eles
      for (let i = 0; i < contacts.length; i++) {
        const phoneNumber = contacts[i];
        
        try {
          // Dispara o fluxo de mensagens para este contato
          const result = await triggerMessageFlow(instance.name, flow, phoneNumber);
          
          // Registra o resultado
          results.push({
            phoneNumber,
            success: true,
            message: `Fluxo "${flow.name}" iniciado com sucesso`
          });
          
          // Registra atividade
          await storage.createActivity(req.user!.id, {
            type: "flow_mass_sent",
            description: `Fluxo de mensagens "${flow.name}" enviado para ${phoneNumber}`,
            entityType: "message_flow",
            entityId: flow.id,
            instanceId: instance.id
          });
          
          log(`[API] Fluxo em massa "${flow.name}" enviado para ${phoneNumber}: sucesso`, "api");
          
          // Registra no histórico de mensagens
          await storage.createMessageHistory(req.user!.id, {
            instanceId: instance.id,
            instanceName: instance.name,
            sender: phoneNumber,
            messageContent: `[Enviado via envio em massa] Fluxo: ${flow.name}`,
            triggeredKeyword: flow.keyword,
            flowId: flow.id,
            status: "scheduled",
            timestamp: new Date()
          });
          
          // Aguarda o atraso configurado antes do próximo contato (exceto para o último)
          if (i < contacts.length - 1 && delayBetweenContacts > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenContacts * 1000));
          }
        } catch (error: any) {
          log(`[API] Erro ao enviar fluxo para ${phoneNumber}: ${error.message}`, "api");
          
          // Registra falha
          results.push({
            phoneNumber,
            success: false,
            message: `Erro: ${error.message}`
          });
        }
      }
      
      // Conta os sucessos e falhas
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      res.json({
        message: `Processamento de fluxo em massa concluído`,
        flowName: flow.name,
        totalCount: contacts.length,
        successCount,
        failedCount,
        results
      });
    } catch (error: any) {
      console.error("Error sending mass flows:", error);
      res.status(500).json({ 
        message: `Erro ao enviar fluxos em massa: ${error.message}` 
      });
    }
  });

  // Rotas do histórico de mensagens
  app.get("/api/message-history", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messageHistory = await storage.getMessageHistoryByUserId(req.user!.id, limit);
      res.json(messageHistory);
    } catch (error: any) {
      console.error("Error getting message history:", error);
      res.status(500).json({ message: `Error getting message history: ${error.message}` });
    }
  });

  app.get("/api/message-history/instance/:id", isAuthenticated, async (req, res) => {
    try {
      const instance = await storage.getInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this instance" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messageHistory = await storage.getMessageHistoryByInstanceId(req.params.id, limit);
      res.json(messageHistory);
    } catch (error: any) {
      console.error("Error getting instance message history:", error);
      res.status(500).json({ message: `Error getting instance message history: ${error.message}` });
    }
  });
  
  // Rota para testar diretamente um fluxo de mensagens sem precisar receber uma mensagem real
  // Endpoint removido para evitar duplicação. O endpoint principal para teste de fluxo está na linha 818.
  
  // Endpoint de depuração para testes diretos de envio de mensagens
  // Já definido anteriormente - cria conflito na rota
  /* // app.post('/api/debug-message-send/:instanceId', isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          message: "Número de telefone e mensagem são obrigatórios"
        });
      }
      
      // Verifica se a instância pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance || instance.userId !== req.user!.id) {
        return res.status(404).json({ 
          success: false,
          message: "Instância não encontrada" 
        });
      }
      
      // Verificar se a instância está conectada
      const connectionState = await evolutionApi.checkConnectionState(instance.name);
      if (!connectionState.status || connectionState.state !== 'open') {
        return res.status(400).json({
          success: false,
          message: "Instância não está conectada",
          connectionState
        });
      }
      
      // Logs detalhados para debug
      log(`[API DEBUG] Iniciando teste de envio direto para ${phoneNumber} via instância ${instance.name}`, 'api');
      log(`[API DEBUG] Mensagem: "${message}"`, 'api');
      
      // Faz o envio direto via API da Evolution
      const sendResult = await evolutionApi.sendMessage(
        instance.name,
        phoneNumber,
        message,
        {
          delay: 500, // Usa um delay menor para testes
          linkPreview: false
        }
      );
      
      // Log detalhado da resposta
      log(`[API DEBUG] Resultado do envio: ${JSON.stringify(sendResult)}`, 'api');
      
      if (!sendResult.status) {
        return res.status(400).json({
          success: false,
          message: `Erro ao enviar mensagem: ${sendResult.message}`,
          debugInfo: {
            error: sendResult.error,
            phoneNumber,
            message,
            instanceName: instance.name,
            userId: req.user!.id
          }
        });
      }
      
      // Registra no histórico de atividades para acompanhamento
      await storage.createActivity(req.user!.id, {
        type: 'debug_message_send',
        description: `Teste direto de mensagem para ${phoneNumber}`,
        entityType: 'debug',
        entityId: instance.id
      });
      
      return res.json({
        success: true,
        message: "Mensagem enviada com sucesso no modo debug",
        response: sendResult.result,
        debug: {
          instance: {
            id: instance.id,
            name: instance.name,
            status: connectionState.state
          },
          request: {
            phoneNumber,
            messagePreview: message.length > 50 ? `${message.substring(0, 50)}...` : message
          }
        }
      });
    } catch (error: any) {
      console.error("[API DEBUG] Erro ao testar envio de mensagem:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar envio: ${error.message}`,
        error: error.stack
      });
    }
  });
  */
  
  // Removida a rota duplicada /api/webhook, usando apenas a rota específica abaixo com instanceId
  
  // Webhook específico para instância (permite resposta mais granular)
  app.post("/api/webhook/:instanceId", async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      console.log(`\n\n=== INÍCIO DE PROCESSAMENTO DE WEBHOOK ===`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`Instância ID/Nome: ${instanceId}`);
      
      // Log detalhado do webhook recebido (completo)
      try {
        console.log(`\n=== PAYLOAD COMPLETO DO WEBHOOK ===`);
        console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
        console.log(`Body: ${JSON.stringify(req.body, null, 2)}`);
      } catch (e) {
        console.log(`Erro ao fazer log do payload: ${e}`);
      }
      
      // Verifica se a instância existe pelo nome da instância
      // Primeiro, tenta buscar pelo ID
      console.log(`\n=== VERIFICANDO INSTÂNCIA ===`);
      let instance = await storage.getInstance(instanceId);
      
      // Se não encontrar pelo ID, tenta buscar pelo nome
      if (!instance) {
        console.log(`Instância não encontrada pelo ID: ${instanceId}, tentando buscar pelo nome...`);
        const instancesByName = await storage.getInstancesByName(instanceId);
        if (instancesByName && instancesByName.length > 0) {
          instance = instancesByName[0];
          console.log(`Instância encontrada pelo nome: ${instance.name} (ID: ${instance.id})`);
        }
      } else {
        console.log(`Instância encontrada pelo ID: ${instance.id}, nome: ${instance.name}`);
      }
      
      if (!instance) {
        console.log(`\n❌ INSTÂNCIA NÃO ENCONTRADA: ${instanceId}`);
        return res.status(200).json({ 
          success: false, 
          message: "Instância não encontrada, mas webhook aceito",
          instanceId
        });
      }
      
      // VERSÃO DIRETA E SIMPLIFICADA PARA PROCESSAMENTO
      // Extrai mensagens em diferentes formatos da API
      console.log(`\n=== EXTRAINDO MENSAGEM DO PAYLOAD ===`);
      const mensagemRecebida = extrairMensagemDaEvolutionAPI(req.body);
      
      if (mensagemRecebida) {
        console.log(`\n✅ MENSAGEM EXTRAÍDA COM SUCESSO:`);
        console.log(`- Número: ${mensagemRecebida.numero}`);
        console.log(`- Texto: ${mensagemRecebida.texto}`);
        console.log(`- ID: ${mensagemRecebida.id || 'não disponível'}`);
        console.log(`- Timestamp: ${new Date(mensagemRecebida.timestamp || Date.now()).toISOString()}`);
        
        // Processa a mensagem através do direct-webhook-handler para resposta automática
        console.log(`\n=== PROCESSANDO COM DIRECT-WEBHOOK-HANDLER ===`);
        const resultadoDireto = await processMessageDirectly({
          instanceId: instance.id,
          instanceName: instance.name,
          fromNumber: mensagemRecebida.numero,
          messageContent: mensagemRecebida.texto,
          messageId: mensagemRecebida.id || `msg-${Date.now()}`,
          timestamp: mensagemRecebida.timestamp || Date.now()
        });
        
        console.log(`Resultado do processamento direto: ${resultadoDireto ? 'Palavra-chave encontrada' : 'Nenhuma palavra-chave correspondente'}`);
        
        // Também processa pelo método tradicional para compatibilidade
        console.log(`\n=== PROCESSANDO COM WEBHOOK-HANDLER TRADICIONAL ===`);
        const webhookData = {
          ...req.body,
          instance: {
            ...req.body.instance,
            instanceId: instance.id
          }
        };
        
        try {
          const resultadoTradicional = await processWebhook(webhookData);
          console.log(`Resultado do processamento tradicional:`, resultadoTradicional);
        } catch (webhookError) {
          console.log(`Erro no processamento tradicional: ${webhookError}`);
        }
      } else {
        console.log(`\n❌ FALHA AO EXTRAIR MENSAGEM DO PAYLOAD`);
      }
      
      console.log(`\n=== FIM DO PROCESSAMENTO DE WEBHOOK ===\n`);
      
      // Sempre retorna 200 para a Evolution API, mesmo em caso de erro no processamento
      res.status(200).json({
        success: true,
        message: "Webhook recebido e processado com sucesso",
        instanceId: instance.id,
        instanceName: instance.name,
        mensagemExtraida: mensagemRecebida ? true : false
      });
    } catch (error: any) {
      console.error("\n❌❌❌ ERRO CRÍTICO NO PROCESSAMENTO DO WEBHOOK:", error);
      // Sempre retorna 200 para a Evolution API não considerar o webhook como falho
      res.status(200).json({ 
        success: false, 
        message: `Erro ao processar webhook: ${error.message}` 
      });
    }
  });
  
  /**
   * Endpoint para testar o webhook callback interno
   * GET /api/test-webhook-callback
   * 
   * Este endpoint simula o recebimento de uma mensagem do WhatsApp
   * e processa através do sistema de resposta automática,
   * útil para testar o sistema sem depender do webhook externo
   */
  app.get("/api/test-webhook-callback", isAuthenticated, async (req, res) => {
    try {
      console.log("\n=== TESTE DE WEBHOOK CALLBACK INTERNO ===");
      
      // Extrair parâmetros da query
      const instanceId = req.query.instanceId as string;
      const keyword = req.query.keyword as string;
      const phoneNumber = req.query.phoneNumber as string;
      const message = req.query.message as string;
      const flowId = req.query.flowId as string;
      const flowName = req.query.flowName as string;
      
      console.log(`Parâmetros recebidos:
        - instanceId: ${instanceId}
        - keyword: ${keyword}
        - phoneNumber: ${phoneNumber}
        - message: ${message}
        - flowId: ${flowId}
        - flowName: ${flowName}
      `);
      
      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: "Instância não encontrada"
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado a esta instância"
        });
      }
      
      // Simula uma mensagem recebida
      const messageId = `sim-msg-${Date.now()}`;
      const timestamp = Date.now();
      
      console.log(`\n=== PROCESSANDO MENSAGEM SIMULADA ===`);
      console.log(`- ID: ${messageId}`);
      console.log(`- Timestamp: ${new Date(timestamp).toISOString()}`);
      console.log(`- De: ${phoneNumber}`);
      console.log(`- Mensagem: ${message}`);
      
      // Processa a mensagem através do direct-webhook-handler para resposta automática
      console.log(`\n=== PROCESSANDO COM DIRECT-WEBHOOK-HANDLER ===`);
      const resultadoDireto = await processMessageDirectly({
        instanceId: instanceId,
        instanceName: instance.name,
        fromNumber: phoneNumber,
        messageContent: message,
        messageId: messageId,
        timestamp: timestamp
      });
      
      console.log(`Resultado do processamento direto: ${resultadoDireto ? 'Palavra-chave encontrada' : 'Nenhuma palavra-chave correspondente'}`);
      
      // Verifica se existe um fluxo com a keyword informada
      const messageFlows = await storage.getMessageFlowsByInstanceId(instanceId);
      const matchingFlows = messageFlows.filter(flow => 
        (flow.keyword === keyword || keyword === '*') && 
        flow.status === 'active'
      );
      
      let flowTriggered = false;
      let flowResult = null;
      
      if (matchingFlows.length > 0) {
        // Acionamos diretamente o fluxo encontrado
        console.log(`\n=== ACIONANDO FLUXO DIRETAMENTE ===`);
        const flow = matchingFlows[0];
        console.log(`- ID do Fluxo: ${flow.id}`);
        console.log(`- Nome do Fluxo: ${flow.name}`);
        console.log(`- Palavra-chave: ${flow.keyword}`);
        
        try {
          flowResult = await triggerFlowWithMessage({
            instanceId,
            instanceName: instance.name,
            fromNumber: phoneNumber,
            messageContent: message,
            messageId,
            timestamp,
            userId: req.user!.id
          });
          
          flowTriggered = true;
          console.log(`Fluxo acionado com sucesso!`);
        } catch (flowError: any) {
          console.error(`Erro ao acionar fluxo: ${flowError.message}`);
        }
      } else {
        console.log(`Nenhum fluxo correspondente encontrado para a palavra-chave: ${keyword}`);
      }
      
      // Registra a atividade
      await storage.createActivity({
        type: 'webhook_test',
        description: `Teste de webhook interno para a instância ${instance.name}`,
        userId: req.user!.id,
        status: flowTriggered ? 'success' : 'info',
        metadata: {
          instanceId,
          keyword,
          phoneNumber,
          message,
          flowTriggered,
          timestamp: new Date()
        }
      });
      
      console.log(`\n=== FIM DO PROCESSAMENTO DE TESTE ===\n`);
      
      return res.status(200).json({
        success: true,
        message: "Teste de webhook interno processado com sucesso",
        instanceId: instance.id,
        instanceName: instance.name,
        keyword,
        phoneNumber,
        messageProcessed: true,
        flowTriggered,
        flowResult,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error("\n❌❌❌ ERRO CRÍTICO NO TESTE DE WEBHOOK:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao processar teste de webhook: ${error.message}`,
        error: error.stack
      });
    }
  });

  app.post("/api/webhook", async (req, res) => {
    console.log(req)
    console.log('CHEGOUUUUUUUUU')
  });
  
  // Configura webhook para uma instância específica
  app.post("/api/webhook/setup/:instanceId", isAuthenticated, async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      // Verifica se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Acesso negado a esta instância" 
        });
      }
      
      // Obtém a URL base para o webhook
      // Se API_URL existe como env, tenta descobrir a URL da aplicação a partir dele
      let baseUrl = process.env.APP_URL;
      
      if (!baseUrl && process.env.API_URL) {
        // Extrai o domínio do API_URL
        try {
          const apiUrl = new URL(process.env.API_URL);
          // Se a API estiver em api.membropro.com.br, nosso app provavelmente está em app.membropro.com.br
          if (apiUrl.hostname === 'api.membropro.com.br') {
            baseUrl = `https://app.membropro.com.br`;
          } else {
            // Caso contrário, usa o domínio atual da requisição
            baseUrl = req.protocol + '://' + req.get('host');
          }
        } catch (e) {
          // Se não conseguir extrair, usa a URL da requisição
          baseUrl = req.protocol + '://' + req.get('host');
        }
      } else if (!baseUrl) {
        // Fallback para a URL da requisição
        baseUrl = req.protocol + '://' + req.get('host');
      }
      
      // Faz log da URL que será usada
      log(`[Webhook] Usando URL base para webhook: ${baseUrl}`, 'express');
      
      // Configura o webhook
      const success = await setupInstanceWebhook(instanceId, baseUrl);
      
      if (success) {
        return res.json({ 
          success: true, 
          message: `Webhook configurado com sucesso para instância ${instance.name}`,
          webhook: `${baseUrl}/api/webhook/${instance.name}` // Usa o nome em vez do ID para garantir compatibilidade
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: "Erro ao configurar webhook" 
        });
      }
    } catch (error: any) {
      console.error("Erro ao configurar webhook:", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao configurar webhook: ${error.message}` 
      });
    }
  });
  
  // Rota temporária para visualizar logs do sistema
  app.get("/debug/logs", async (req, res) => {
    try {
      // Cria um array para armazenar os logs
      const systemInfo: any[] = [];
      
      // Coleta os últimos logs do sistema
      const startTime = Date.now() - (60 * 60 * 1000); // Últimos 60 minutos
      
      // Adiciona informações sobre as instâncias conectadas
      const connectedInstances = await storage.getAllConnectedInstances();
      systemInfo.push({
        timestamp: new Date().toISOString(),
        category: "SYSTEM",
        message: `Instâncias conectadas: ${connectedInstances.length}`,
        details: connectedInstances.length > 0 
          ? connectedInstances.map(i => `${i.name} (${i.status})`).join(", ") 
          : "Nenhuma instância conectada"
      });
      
      // Obtém as instâncias desconectadas
      const allInstances = await storage.getInstancesByUserId(0); // Todos os usuários
      const disconnectedCount = allInstances.filter((i: any) => i.status !== "connected").length;
      systemInfo.push({
        timestamp: new Date().toISOString(),
        category: "SYSTEM",
        message: `Instâncias desconectadas: ${disconnectedCount}`,
        details: disconnectedCount > 0 
          ? allInstances
              .filter((i: any) => i.status !== "connected")
              .map((i: any) => `${i.name} (${i.status})`)
              .join(", ") 
          : "Nenhuma instância desconectada"
      });
      
      // Adiciona informações sobre fluxos ativos
      const activeFlows = await storage.getMessageFlowsByUserId(0); // Todos os usuários
      const activeFlowsFiltered = activeFlows.filter((f: any) => f.status === "active");
      systemInfo.push({
        timestamp: new Date().toISOString(),
        category: "SYSTEM",
        message: `Fluxos de mensagens ativos: ${activeFlowsFiltered.length}`,
        details: activeFlowsFiltered.length > 0 
          ? activeFlowsFiltered.map((f: any) => `${f.name} (${f.triggerType}: "${f.keyword}")`).join(", ") 
          : "Nenhum fluxo de mensagens ativo"
      });
      
      // Coleta histórico de mensagens
      let messageHistoryData: any[] = [];
      try {
        const recentMessages = await storage.getRecentMessageHistory(50); // últimas 50 mensagens
        systemInfo.push({
          timestamp: new Date().toISOString(),
          category: "SYSTEM",
          message: `Mensagens recentes: ${recentMessages.length}`,
          details: recentMessages.length > 0 ? 
            `Última mensagem: "${recentMessages[0].messageContent}" (${recentMessages[0].sender})` : 
            "Sem mensagens recentes"
        });
        
        // Preenche dados de histórico para exibição na tabela
        messageHistoryData = recentMessages.map(msg => ({
          timestamp: new Date(msg.timestamp).toISOString(),
          status: msg.status,
          sender: msg.sender,
          content: msg.messageContent,
          keyword: msg.triggeredKeyword || "-",
          instanceName: msg.instanceName
        }));
        
      } catch (err: any) {
        systemInfo.push({
          timestamp: new Date().toISOString(),
          category: "ERROR",
          message: "Erro ao obter mensagens recentes",
          details: err.message || err
        });
      }
      
      // Informações sobre atividades recentes
      let activityData: any[] = [];
      try {
        const recentActivities = await storage.getRecentActivities(50); // últimas 50 atividades
        systemInfo.push({
          timestamp: new Date().toISOString(),
          category: "SYSTEM",
          message: `Atividades recentes: ${recentActivities.length}`,
          details: recentActivities.length > 0 ? 
            `Última atividade: ${recentActivities[0].description}` : 
            "Sem atividades recentes"
        });
        
        // Preenche dados de atividades para exibição na tabela
        activityData = recentActivities.map(act => ({
          timestamp: new Date(act.createdAt).toISOString(),
          type: act.type,
          description: act.description,
          entityType: act.entityType || "-",
          entityId: act.entityId ? act.entityId.substring(0, 8) + "..." : "-"
        }));
        
      } catch (err: any) {
        systemInfo.push({
          timestamp: new Date().toISOString(),
          category: "ERROR",
          message: "Erro ao obter atividades recentes",
          details: err.message || err
        });
      }
      
      // Envia HTML formatado em vez de JSON para melhor visualização
      const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Logs do Sistema - WhatsApp SaaS</title>
        <style>
          body {
            font-family: sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
          }
          h1, h2 {
            color: #333;
            border-bottom: 2px solid #ddd;
            padding-bottom: 10px;
          }
          .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
          }
          .log-entry {
            border-bottom: 1px solid #eee;
            padding: 10px 0;
            margin: 5px 0;
          }
          .log-entry:last-child {
            border-bottom: none;
          }
          .log-time {
            color: #888;
            font-size: 0.8em;
          }
          .log-category {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            margin: 0 10px;
            font-weight: bold;
          }
          .category-ERROR { background: #ffebee; color: #d32f2f; }
          .category-WARNING { background: #fff8e1; color: #ff8f00; }
          .category-INFO { background: #e8f5e9; color: #388e3c; }
          .category-SYSTEM { background: #e3f2fd; color: #1976d2; }
          .log-message {
            font-weight: bold;
            margin: 5px 0;
          }
          .log-details {
            font-family: monospace;
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            margin: 5px 0;
            white-space: pre-wrap;
            max-height: 150px;
            overflow-y: auto;
          }
          .refresh-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-bottom: 20px;
          }
          .refresh-btn:hover {
            background: #388e3c;
          }
          .console-view {
            background: #263238;
            color: #eeffff;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            height: 300px;
            overflow: auto;
            margin-top: 20px;
          }
          .console-line {
            line-height: 1.5;
            margin: 2px 0;
          }
          .debug { color: #80cbc4; }
          .info { color: #89ddff; }
          .error { color: #f07178; }
          .warning { color: #ffcb6b; }
          .message { color: #c3e88d; }
          .activity { color: #c792ea; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 14px;
          }
          th {
            background: #f0f0f0;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            border-bottom: 2px solid #ddd;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #eee;
          }
          tr:hover {
            background: #f9f9f9;
          }
          
          .tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
          }
          .tag-triggered { background: #e8f5e9; color: #388e3c; }
          .tag-no_match { background: #f5f5f5; color: #757575; }
          .tag-error { background: #ffebee; color: #d32f2f; }
          .tag-scheduled { background: #e3f2fd; color: #1976d2; }
          
          .tabs {
            display: flex;
            margin-bottom: 10px;
            border-bottom: 1px solid #ddd;
          }
          .tab {
            padding: 10px 20px;
            cursor: pointer;
            margin-right: 5px;
            border: 1px solid #ddd;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            background: #f5f5f5;
          }
          .tab.active {
            background: white;
            border-bottom: 1px solid white;
            margin-bottom: -1px;
            font-weight: bold;
          }
          .tab-content {
            display: none;
          }
          .tab-content.active {
            display: block;
          }
        </style>
      </head>
      <body>
        <h1>Logs do Sistema - WhatsApp SaaS</h1>
        <p>Esta página exibe informações de diagnóstico do sistema para ajudar a identificar e resolver problemas.</p>
        <button class="refresh-btn" onclick="window.location.reload()">Atualizar Dados</button>
        
        <div class="tabs">
          <div class="tab active" onclick="switchTab('info')">Informações do Sistema</div>
          <div class="tab" onclick="switchTab('logs')">Logs em Tempo Real</div>
          <div class="tab" onclick="switchTab('messages')">Histórico de Mensagens</div>
          <div class="tab" onclick="switchTab('activities')">Atividades</div>
        </div>
        
        <div class="tab-content active" id="info">
          <div class="container">
            <h2>Informações do Sistema</h2>
            ${systemInfo.map(info => `
              <div class="log-entry">
                <span class="log-time">${info.timestamp}</span>
                <span class="log-category category-${info.category}">${info.category}</span>
                <div class="log-message">${info.message}</div>
                <div class="log-details">${info.details}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="tab-content" id="logs">
          <div class="container">
            <h2>Logs em Tempo Real</h2>
            <p>Esta seção mostra logs do sistema em tempo real. Inclui atividades, mensagens processadas e erros.</p>
            <div class="console-view" id="console-logs">
              <!-- Logs do console serão adicionados aqui -->
              <div class="console-line info">[SYSTEM] Conectando ao sistema de logs...</div>
            </div>
          </div>
        </div>
        
        <div class="tab-content" id="messages">
          <div class="container">
            <h2>Histórico de Mensagens</h2>
            <p>Últimas ${messageHistoryData.length} mensagens recebidas pelo sistema:</p>
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Status</th>
                  <th>Instância</th>
                  <th>Remetente</th>
                  <th>Conteúdo</th>
                  <th>Palavra-chave</th>
                </tr>
              </thead>
              <tbody>
                ${messageHistoryData.map(msg => `
                  <tr>
                    <td>${new Date(msg.timestamp).toLocaleString()}</td>
                    <td><span class="tag tag-${msg.status}">${msg.status}</span></td>
                    <td>${msg.instanceName}</td>
                    <td>${msg.sender}</td>
                    <td>${msg.content}</td>
                    <td>${msg.keyword}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="tab-content" id="activities">
          <div class="container">
            <h2>Atividades do Sistema</h2>
            <p>Últimas ${activityData.length} atividades registradas:</p>
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Entidade</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                ${activityData.map(act => `
                  <tr>
                    <td>${new Date(act.timestamp).toLocaleString()}</td>
                    <td>${act.type}</td>
                    <td>${act.description}</td>
                    <td>${act.entityType}</td>
                    <td>${act.entityId}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <script>
          // Função para alternar entre abas
          function switchTab(tabId) {
            // Desativar todas as abas
            document.querySelectorAll('.tab').forEach(tab => {
              tab.classList.remove('active');
            });
            
            // Desativar todos os conteúdos
            document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.remove('active');
            });
            
            // Ativar a aba selecionada
            document.querySelectorAll('.tab').forEach(tab => {
              if (tab.textContent.toLowerCase().includes(tabId)) {
                tab.classList.add('active');
              }
            });
            
            // Ativar o conteúdo selecionado
            document.getElementById(tabId).classList.add('active');
          }
          
          // Função para puxar logs a cada 3 segundos
          const consoleContainer = document.getElementById('console-logs');
          
          // Função para adicionar logs ao console
          function addLog(message, type = 'info') {
            const logLine = document.createElement('div');
            logLine.className = 'console-line ' + type;
            logLine.textContent = message;
            consoleContainer.appendChild(logLine);
            consoleContainer.scrollTop = consoleContainer.scrollHeight;
          }
          
          // Função para carregar os logs mais recentes
          async function fetchLogs() {
            try {
              const response = await fetch('/api/debug/recent-logs');
              if (!response.ok) {
                throw new Error('Falha ao obter logs');
              }
              const logs = await response.json();
              
              // Limitar o número de logs exibidos para evitar sobrecarga
              if (consoleContainer.children.length > 200) {
                const excess = consoleContainer.children.length - 200;
                for (let i = 0; i < excess; i++) {
                  consoleContainer.removeChild(consoleContainer.children[0]);
                }
              }
              
              // Adiciona cada log ao console
              logs.forEach(log => {
                let type = 'info';
                if (log.message.includes('ERROR') || log.message.includes('erro')) type = 'error';
                if (log.message.includes('WARN')) type = 'warning';
                if (log.message.includes('DEBUG')) type = 'debug';
                if (log.message.includes('MESSAGE')) type = 'message';
                if (log.message.includes('ACTIVITY')) type = 'activity';
                
                addLog(\`[\${new Date(log.timestamp).toLocaleTimeString()}] \${log.message}\`, type);
              });
            } catch (error) {
              addLog(\`Erro ao carregar logs: \${error.message}\`, 'error');
            }
          }
          
          // Carrega logs imediatamente
          fetchLogs();
          
          // Atualiza periodicamente
          setInterval(fetchLogs, 3000);
        </script>
      </body>
      </html>
      `;
      
      res.send(html);
    } catch (error: any) {
      res.status(500).send(`Erro ao obter logs: ${error.message}`);
    }
  });
  
  // API para fornecer logs recentes em formato JSON
  app.get("/api/debug/recent-logs", async (req, res) => {
    try {
      // Verificar se há um filtro de categoria
      const categoryFilter = req.query.category as string | undefined;
      
      // Array para armazenar todos os logs do sistema
      const recentLogs: {
        timestamp: string, 
        message: string, 
        category?: string, 
        source?: string,
        level?: 'info' | 'warning' | 'error' | 'success',
        details?: any
      }[] = [];
      
      // Filtrar logs por categoria se especificado
      if (categoryFilter === 'flow_activity') {
        // Buscar especificamente atividades relacionadas a fluxos de mensagens
        try {
          const messageHistoryItems = await storage.getLatestMessageHistory(30);
          
          // Para cada mensagem, buscar informações sobre fluxos acionados
          messageHistoryItems.forEach((item: {
            id: number;
            userId: number;
            instanceId: string;
            instanceName: string;
            flowId: string | null;
            sender: string;
            messageContent: string;
            triggeredKeyword: string | null;
            timestamp: Date;
            status: string;
          }) => {
            // Verificar se há um gatilho acionado
            // Usar a data atual pra evitar problemas com timestamp incorreto
            const currentDate = new Date();
            
            if (item.flowId && item.triggeredKeyword) {
              recentLogs.push({
                timestamp: currentDate.toISOString(),
                message: `Palavra-chave "${item.triggeredKeyword}" detectada no número ${item.sender}`,
                category: 'flow_activity',
                source: item.instanceId,
                level: 'success',
                details: {
                  flowId: item.flowId,
                  messageContent: item.messageContent,
                  phoneNumber: item.sender,
                  // Usar a data atual no formato brasileiro (DD/MM/YYYY HH:MM:SS)
                  timestamp: `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`
                }
              });
            } else {
              // Mensagem recebida sem acionar um fluxo
              recentLogs.push({
                timestamp: currentDate.toISOString(),
                message: `Mensagem recebida de ${item.sender} sem acionar fluxos`,
                category: 'flow_activity',
                source: item.instanceId,
                level: 'info',
                details: {
                  messageContent: item.messageContent,
                  sender: item.sender,
                  // Usar a data atual no formato brasileiro (DD/MM/YYYY HH:MM:SS)
                  timestamp: `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`
                }
              });
            }
          });
          
          // Retornar diretamente para não prosseguir com os outros logs
          if (recentLogs.length === 0) {
            // Se não houver mensagens, adicionar um log informativo
            const currentDate = new Date();
            recentLogs.push({
              timestamp: currentDate.toISOString(),
              message: 'Nenhuma atividade de fluxo registrada recentemente',
              category: 'flow_activity',
              level: 'info',
              details: {
                timestamp: `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`
              }
            });
          }
          
          // Ordenar logs pelo timestamp (mais recente primeiro)
          recentLogs.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          return res.json(recentLogs);
        } catch (err) {
          console.error("Erro ao obter histórico de mensagens para logs de fluxo:", err);
          const currentDate = new Date();
          recentLogs.push({
            timestamp: currentDate.toISOString(),
            message: `Erro ao obter histórico de atividades de fluxo: ${err}`,
            category: 'flow_activity',
            level: 'error',
            details: {
              timestamp: `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`
            }
          });
          return res.json(recentLogs);
        }
      }
      
      // Adicionar logs de webhook diretamente da tabela de logs internos
      try {
        const webhookLogs = await storage.getSystemLogsByType('webhook', 20);
        webhookLogs.forEach(log => {
          // Verificar se o log contém informações sobre a instância teste1
          const isTeste1Log = log.message && log.message.toLowerCase().includes('teste1');
          
          recentLogs.push({
            timestamp: new Date(log.timestamp).toISOString(),
            message: `[WEBHOOK] ${log.message}`,
            category: 'webhook',
            source: isTeste1Log ? 'teste1' : undefined,
            level: 'info'
          });
        });
      } catch (err) {
        console.error("Erro ao obter logs de webhook:", err);
        recentLogs.push({
          timestamp: new Date().toISOString(),
          message: `[ERROR] Erro ao obter logs de webhook: ${err}`,
          category: 'error',
          level: 'error'
        });
      }
      
      // Adicionar logs específicos da instância teste1
      try {
        const teste1Logs = await storage.getInstanceLogs('teste1', 20);
        teste1Logs.forEach(log => {
          recentLogs.push({
            timestamp: new Date(log.timestamp).toISOString(),
            message: `[TESTE1] ${log.message}`,
            category: 'instance',
            source: 'teste1'
          });
        });
      } catch (err) {
        console.error("Erro ao obter logs da instância teste1:", err);
        recentLogs.push({
          timestamp: new Date().toISOString(),
          message: `[ERROR] Erro ao obter logs da instância teste1: ${err}`,
          category: 'error'
        });
      }
      
      // Adicionar logs das atividades recentes
      try {
        const activities = await storage.getRecentActivities(20);
        activities.forEach(activity => {
          // Verificar se a atividade está relacionada à teste1
          const isTeste1Activity = 
            (activity.description && activity.description.toLowerCase().includes('teste1')) || 
            (activity.entityType === 'instance' && activity.entityId && activity.entityId.toLowerCase().includes('teste1'));
          
          recentLogs.push({
            timestamp: new Date(activity.createdAt).toISOString(),
            message: `[ACTIVITY] ${activity.type}: ${activity.description}`,
            category: 'activity',
            source: isTeste1Activity ? 'teste1' : undefined
          });
        });
      } catch (err) {
        console.error("Erro ao obter atividades para logs:", err);
        recentLogs.push({
          timestamp: new Date().toISOString(),
          message: `[ERROR] Erro ao obter atividades: ${err}`,
          category: 'error'
        });
      }
      
      // Adicionar logs do histórico de mensagens
      try {
        // Buscar histórico de mensagens da instância teste1
        const teste1Id = await storage.getInstanceIdByName('teste1');
        const messageQueryParams = teste1Id ? { instanceId: teste1Id } : undefined;
        
        // Aumentamos para 50 mensagens para garantir melhor visibilidade
        const recentMessages = await storage.getRecentMessageHistory(50, messageQueryParams);
        
        // Adiciona informações sobre o número total de mensagens primeiro
        recentLogs.push({
          timestamp: new Date().toISOString(),
          message: `[SYSTEM] Carregadas ${recentMessages.length} mensagens recentes${teste1Id ? ' da instância teste1' : ''}`,
          category: 'system',
          source: teste1Id ? 'teste1' : undefined
        });
        
        recentMessages.forEach(msg => {
          // Determinar o tipo de ação baseado no status
          let statusText = "recebida";
          if (msg.status === "triggered") statusText = "com gatilho acionado";
          else if (msg.status === "error") statusText = "com erro";
          else if (msg.status === "received") statusText = "recebida via webhook";
          else if (msg.status === "scheduled") statusText = "agendada";
          
          const triggerInfo = msg.triggeredKeyword 
            ? ` (palavra-chave: "${msg.triggeredKeyword}")` 
            : "";
          
          // Destacar explicitamente a instância teste1
          const isTeste1 = msg.instanceName && msg.instanceName.toLowerCase() === 'teste1';
          const instanceName = isTeste1 ? 'teste1' : msg.instanceName || 'desconhecida';
          const instanceInfo = ` via "${instanceName}"`;
          
          const msgTimestamp = new Date(msg.timestamp);
          const formattedMsgDate = formatDateBrazilian(msgTimestamp);
          
          recentLogs.push({
            timestamp: msgTimestamp.toISOString(),
            message: `[MESSAGE] ${statusText}: "${msg.messageContent}" de ${msg.sender}${triggerInfo}${instanceInfo}`,
            category: msg.status === "received" ? 'webhook' : 'message',
            source: isTeste1 ? 'teste1' : undefined,
            details: {
              timestamp: formattedMsgDate
            }
          });
        });
      } catch (err) {
        console.error("Erro ao obter histórico de mensagens para logs:", err);
        const currentDate = new Date();
        const formattedDate = formatDateBrazilian(currentDate);
        
        recentLogs.push({
          timestamp: currentDate.toISOString(),
          message: `[ERROR] Erro ao obter histórico de mensagens: ${err}`,
          category: 'error',
          details: {
            timestamp: formattedDate
          }
        });
      }
      
      // Adicionar logs de diagnóstico (se existirem na variável global)
      try {
        if (global.latestDiagnosticResults && Array.isArray(global.latestDiagnosticResults) && global.latestDiagnosticResults.length > 0) {
          // Convertemos os resultados do diagnóstico para o formato de logs
          global.latestDiagnosticResults.forEach((result: any) => {
            let statusPrefix = '';
            let category = 'diagnostic';
            
            // Definir prefixo e categoria com base no status
            switch (result.status) {
              case 'error':
                statusPrefix = '[DIAGNÓSTICO-ERRO]';
                category = 'error';
                break;
              case 'warning':
                statusPrefix = '[DIAGNÓSTICO-AVISO]';
                category = 'warning';
                break;
              case 'success':
                statusPrefix = '[DIAGNÓSTICO-OK]';
                category = 'diagnostic';
                break;
              default:
                statusPrefix = '[DIAGNÓSTICO-INFO]';
                category = 'diagnostic';
            }
            
            // Verificar se o diagnóstico está relacionado à instância teste1
            const isTeste1Diagnostic = 
              (result.subCategory && result.subCategory.toLowerCase() === 'teste1') ||
              (result.description && result.description.toLowerCase().includes('teste1')) ||
              (result.name && result.name.toLowerCase().includes('teste1'));
            
            const diagTimestamp = result.timestamp ? new Date(result.timestamp) : new Date();
            const formattedDiagDate = formatDateBrazilian(diagTimestamp);
            
            recentLogs.push({
              timestamp: diagTimestamp.toISOString(),
              message: `${statusPrefix} ${result.name}: ${result.description}`,
              category: category,
              source: isTeste1Diagnostic ? 'teste1' : undefined,
              details: {
                timestamp: formattedDiagDate
              }
            });
          });
        }
      } catch (err) {
        console.error("Erro ao processar logs de diagnóstico:", err);
        const currentDate = new Date();
        const formattedDate = formatDateBrazilian(currentDate);
        
        recentLogs.push({
          timestamp: currentDate.toISOString(),
          message: `[ERROR] Erro ao processar logs de diagnóstico: ${err}`,
          category: 'error',
          details: {
            timestamp: formattedDate
          }
        });
      }
      
      // Ordenar logs por timestamp (mais recentes primeiro)
      recentLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(recentLogs);
    } catch (error: any) {
      res.status(500).json({ error: `Erro ao obter logs recentes: ${error.message}` });
    }
  });
  
  // API para executar o diagnóstico do sistema e retornar os resultados
  app.post("/api/debug/run-diagnostic", isAuthenticated, async (req, res) => {
    try {
      // Log da ação de diagnóstico
      log(`[DIAGNÓSTICO] Iniciando diagnóstico do sistema a pedido do usuário ${req.user!.id}`, 'diagnostic');
      
      // Executar o diagnóstico completo
      const diagnosticResults = await diagnosticService.runCompleteDiagnostic();
      
      // Armazenar os resultados mais recentes globalmente para que possam ser acessados pela API de logs
      global.latestDiagnosticResults = diagnosticResults;
      
      // Registrar atividade do usuário
      await storage.createActivity(req.user!.id, {
        type: "system_diagnostic",
        description: "Diagnóstico completo do sistema executado",
        entityType: "system"
      });
      
      // Retornar os resultados para o cliente
      res.json({
        success: true,
        timestamp: new Date(),
        message: "Diagnóstico do sistema concluído com sucesso",
        results: diagnosticResults
      });
    } catch (error: any) {
      console.error("Erro ao executar diagnóstico do sistema:", error);
      
      // Registrar o erro como atividade
      if (req.user) {
        await storage.createActivity(req.user.id, {
          type: "system_diagnostic_error",
          description: `Erro ao executar diagnóstico: ${error.message}`,
          entityType: "system"
        });
      }
      
      res.status(500).json({
        success: false,
        message: `Erro ao executar diagnóstico do sistema: ${error.message}`
      });
    }
  });
  
  // API para executar o diagnóstico do sistema de arquivos
  app.post("/api/debug/run-filesystem-diagnostic", isAuthenticated, async (req, res) => {
    try {
      // Log da ação de diagnóstico
      log(`[DIAGNÓSTICO] Iniciando diagnóstico do sistema de arquivos a pedido do usuário ${req.user!.id}`, 'diagnostic');
      
      // Executar o diagnóstico do sistema de arquivos
      const diagnosticResults = await diagnosticService.runFilesystemDiagnostic();
      
      // Adicionar os resultados aos resultados globais de diagnóstico
      if (!global.latestDiagnosticResults) {
        global.latestDiagnosticResults = [];
      }
      
      // Adicionar apenas os novos resultados e filtrar os resultados antigos do sistema de arquivos
      global.latestDiagnosticResults = [
        ...diagnosticResults,
        ...global.latestDiagnosticResults.filter((r: any) => r.category !== 'filesystem')
      ];
      
      // Registrar atividade do usuário
      await storage.createActivity(req.user!.id, {
        type: "filesystem_diagnostic",
        description: "Diagnóstico do sistema de arquivos executado",
        entityType: "system"
      });
      
      // Retornar os resultados para o cliente
      res.json({
        success: true,
        timestamp: new Date(),
        message: "Diagnóstico do sistema de arquivos concluído com sucesso",
        results: diagnosticResults
      });
    } catch (error: any) {
      console.error("Erro ao executar diagnóstico do sistema de arquivos:", error);
      
      // Registrar o erro como atividade
      if (req.user) {
        await storage.createActivity(req.user.id, {
          type: "filesystem_diagnostic_error",
          description: `Erro ao executar diagnóstico do sistema de arquivos: ${error.message}`,
          entityType: "system"
        });
      }
      
      res.status(500).json({
        success: false,
        message: `Erro ao executar diagnóstico do sistema de arquivos: ${error.message}`
      });
    }
  });
  
  // API para executar o diagnóstico específico para uma instância
  app.post("/api/debug/run-instance-diagnostic/:instanceId", isAuthenticated, async (req, res) => {
    try {
      const instanceId = req.params.instanceId;
      
      // Verificar se a instância existe e pertence ao usuário
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false,
          message: "Instância não encontrada" 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Não autorizado a acessar esta instância" 
        });
      }
      
      // Log da ação de diagnóstico
      log(`[DIAGNÓSTICO] Iniciando diagnóstico da instância ${instance.name} a pedido do usuário ${req.user!.id}`, 'diagnostic');
      
      // Executar o diagnóstico da instância
      const diagnosticResults = await diagnosticService.runInstanceDiagnostic(instanceId);
      
      // Adicionar estes resultados aos resultados globais de diagnóstico
      if (!global.latestDiagnosticResults) {
        global.latestDiagnosticResults = [];
      }
      
      // Adicionar apenas os novos resultados
      global.latestDiagnosticResults = [
        ...diagnosticResults,
        ...global.latestDiagnosticResults.filter((r: any) => 
          !(r.category === 'Instance' && r.subCategory === instance.name))
      ];
      
      // Registrar atividade do usuário
      await storage.createActivity(req.user!.id, {
        type: "instance_diagnostic",
        description: `Diagnóstico da instância ${instance.name} executado`,
        entityType: "instance",
        entityId: instanceId,
        instanceId
      });
      
      // Retornar os resultados para o cliente
      res.json({
        success: true,
        timestamp: new Date(),
        message: `Diagnóstico da instância ${instance.name} concluído com sucesso`,
        results: diagnosticResults
      });
    } catch (error: any) {
      console.error("Erro ao executar diagnóstico da instância:", error);
      
      // Registrar o erro como atividade
      if (req.user) {
        await storage.createActivity(req.user.id, {
          type: "instance_diagnostic_error",
          description: `Erro ao executar diagnóstico da instância: ${error.message}`,
          entityType: "instance",
          entityId: req.params.instanceId
        });
      }
      
      res.status(500).json({
        success: false,
        message: `Erro ao executar diagnóstico da instância: ${error.message}`
      });
    }
  });

  // Rota para testar a resposta automática à palavra-chave "chat"
  app.post("/api/test/auto-chat-response", isAuthenticated, async (req, res) => {
    try {
      const { instanceId, phoneNumber } = req.body;
      
      if (!instanceId || !phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "ID da instância e número de telefone são obrigatórios" 
        });
      }
      
      // Busca a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instância não encontrada" 
        });
      }
      
      // Verifica permissão
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: "Você não tem permissão para acessar esta instância" 
        });
      }
      
      // Cria uma mensagem de teste com a palavra "chat"
      const testMessage = "chat com atendente";
      const messageId = `test-chat-${Date.now()}`;
      const timestamp = Date.now();
      
      // Processa a mensagem simulada usando nosso processador de mensagens
      log(`[TestAutoChat] Simulando mensagem "${testMessage}" do número ${phoneNumber} para instância ${instance.name}`, 'test');
      
      const processed = await processIncomingMessage(
        instance,
        phoneNumber,
        testMessage,
        messageId,
        timestamp,
        true // Envia para webhook
      );
      
      if (processed) {
        await storage.createActivity(req.user!.id, {
          type: "auto_chat_test",
          description: `Teste de resposta automática à "chat" realizado para o número ${phoneNumber}`,
          entityType: "instance",
          entityId: instance.id
        });
        
        return res.json({
          success: true,
          message: "Resposta automática à palavra-chave 'chat' processada com sucesso",
          instance: {
            id: instance.id,
            name: instance.name
          },
          phoneNumber,
          processed
        });
      } else {
        return res.json({
          success: false,
          message: "Nenhum fluxo para resposta automática à 'chat' encontrado ou ativado",
          instance: {
            id: instance.id,
            name: instance.name
          }
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar resposta automática à 'chat':", error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao testar resposta automática: ${error.message}` 
      });
    }
  });

  // Endpoint para obter o status atual da fila de fluxos
  app.get("/api/flow-queue/status", isAuthenticated, (req, res) => {
    try {
      const queueStatus = flowQueueService.getQueueStatus();
      res.json(queueStatus);
    } catch (error: any) {
      console.error("Erro ao obter status da fila de fluxos:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao obter status da fila: ${error.message}`
      });
    }
  });
  
  /**
   * Endpoint para obter fluxos disponíveis para uma instância específica
   */
  app.get('/api/instance-flows/:instanceId', isAuthenticated, async (req, res) => {
    const { instanceId } = req.params;
    
    if (!instanceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'instanceId é obrigatório' 
      });
    }
    
    try {
      // Busca a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Instância não encontrada' 
        });
      }
      
      // Verifica se o usuário é dono da instância
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você não tem permissão para acessar esta instância' 
        });
      }
      
      // Busca fluxos ativos da instância
      const flows = await storage.getMessageFlowsByInstanceId(instanceId);
      const activeFlows = flows.filter(flow => flow.status === 'active');
      
      // Retorna apenas os dados necessários para o frontend
      const simplifiedFlows = activeFlows.map(flow => ({
        id: flow.id,
        name: flow.name,
        keyword: flow.keyword,
        messagesCount: flow.messages.length
      }));
      
      res.json({
        success: true,
        instanceId,
        instanceName: instance.name,
        flows: simplifiedFlows
      });
    } catch (error: any) {
      console.error('Erro ao buscar fluxos da instância:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar fluxos da instância'
      });
    }
  });

  /**
   * Endpoint para criar um fluxo de teste para visualização na fila
   * Permite escolher o fluxo a ser testado e o número para onde enviar
   */
  app.post('/api/test-flow', isAuthenticated, async (req, res) => {
    const { instanceId, phoneNumber, flowId } = req.body;
    
    if (!instanceId || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'instanceId e phoneNumber são obrigatórios' 
      });
    }
    
    try {
      // Busca a instância
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Instância não encontrada' 
        });
      }
      
      // Verifica se o usuário é dono da instância
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você não tem permissão para acessar esta instância' 
        });
      }
      
      // Busca fluxos ativos da instância
      const flows = await storage.getMessageFlowsByInstanceId(instanceId);
      const activeFlows = flows.filter(flow => flow.status === 'active');
      
      if (activeFlows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não há fluxos ativos para esta instância'
        });
      }
      
      // Se flowId for fornecido, usa o fluxo específico, senão escolhe aleatoriamente
      let selectedFlow;
      if (flowId) {
        selectedFlow = activeFlows.find(flow => flow.id === flowId);
        if (!selectedFlow) {
          return res.status(404).json({
            success: false,
            message: 'Fluxo selecionado não encontrado ou não está ativo'
          });
        }
      } else {
        // Escolhe um fluxo aleatório para testar
        selectedFlow = activeFlows[Math.floor(Math.random() * activeFlows.length)];
      }
      
      // Enfileira as mensagens do fluxo para o número especificado
      const messages = selectedFlow.messages.map(msg => {
        if (msg.type === 'text') {
          return {
            text: msg.text,
            delayAfterMs: msg.delay || 1000
          };
        } else if (msg.type === 'image' && msg.mediaUrl) {
          return {
            mediaUrl: msg.mediaUrl,
            caption: msg.caption || '',
            type: 'image',
            delayAfterMs: msg.delay || 1000
          };
        } else if (msg.type === 'audio' && msg.mediaUrl) {
          return {
            mediaUrl: msg.mediaUrl,
            type: 'audio',
            ptt: true,
            delayAfterMs: msg.delay || 1000
          };
        } else if (msg.type === 'video' && msg.mediaUrl) {
          return {
            mediaUrl: msg.mediaUrl,
            caption: msg.caption || '',
            type: 'video',
            delayAfterMs: msg.delay || 1000
          };
        } else if (msg.type === 'file' && msg.mediaUrl) {
          return {
            mediaUrl: msg.mediaUrl,
            fileName: msg.fileName || 'arquivo.pdf',
            type: 'document',
            delayAfterMs: msg.delay || 1000
          };
        }
        // Fallback para mensagem de texto
        return {
          text: 'Mensagem de teste',
          delayAfterMs: 1000
        };
      });
      
      // Adiciona o fluxo à fila usando o gerenciador de mensagens
      messageQueueManager.enqueueMessageSequence(
        instance.name, 
        phoneNumber, 
        messages, 
        {
          flowId: selectedFlow.id,
          flowName: `Teste: ${selectedFlow.name}`,
          triggerKeyword: 'teste',
          triggerMessage: 'Mensagem de teste',
          initialDelayMs: 1000,
          recipientName: `Teste para ${phoneNumber}`
        }
      );
      
      res.json({
        success: true,
        message: `Fluxo ${selectedFlow.name} adicionado à fila para o número ${phoneNumber}`,
        flowId: selectedFlow.id,
        flowName: selectedFlow.name,
        messagesCount: messages.length,
        phoneNumber
      });
    } catch (error: any) {
      console.error('Erro ao criar fluxo de teste:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar fluxo de teste'
      });
    }
  });

  app.post('/api/test/autoresponder', isAuthenticated, async (req, res) => {
    const { instanceId, phoneNumber, message } = req.body;
    
    if (!instanceId || !phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parâmetros incompletos. Forneça instanceId, phoneNumber e message' 
      });
    }
    
    try {
      const instance = await storage.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Instância não encontrada' 
        });
      }
      
      if (instance.userId !== req.user!.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Acesso negado a esta instância' 
        });
      }
      
      // Preparamos um objeto que simula uma mensagem recebida
      const mockMessage = {
        key: {
          remoteJid: phoneNumber + '@s.whatsapp.net',
          fromMe: false,
          id: 'test_msg_' + Date.now()
        },
        message: {
          conversation: message
        },
        messageTimestamp: Date.now(),
        status: 1
      };
      
      // Log da mensagem simulada
      log(`[TEST] Simulando mensagem recebida: ${message} de ${phoneNumber}`, 'test');
      console.log(`[TESTE] Simulando mensagem: "${message}" de ${phoneNumber} para instância ${instance.name}`);
      
      // Processamos a mensagem usando o processador direto
      const result = await processMessageDirectly({
        instanceName: instance.name,
        instanceId: instance.id,
        fromNumber: phoneNumber,
        messageContent: message,
        messageId: mockMessage.key.id,
        timestamp: mockMessage.messageTimestamp,
        userId: instance.userId,
        rawMessage: mockMessage
      });
      
      // Retorna o resultado do processamento
      res.json({
        success: true,
        message: result?.flowTriggered 
          ? `Fluxo "${result.flowName}" acionado com sucesso com a palavra-chave "${result.keyword}"` 
          : 'Mensagem processada, mas nenhum fluxo foi acionado',
        result: {
          messageProcessed: true,
          flowTriggered: !!result?.flowTriggered,
          flowName: result?.flowName,
          keyword: result?.keyword,
          phoneNumber
        }
      });
    } catch (error: any) {
      console.error('Erro ao testar autoresponder:', error);
      res.status(500).json({
        success: false,
        message: `Erro ao testar sistema de resposta automática: ${error.message}`,
        error: error.toString()
      });
    }
  });

  // Endpoint para receber callbacks do webhook (endpoint local para testes)
  app.get("/api/webhook-callback", async (req, res) => {
    try {
      const { instanceId, keyword, numero: phoneNumber, mensagem: message, flowId, flowName, timestamp } = req.query;
      
      log(`[Webhook Callback] Recebido callback com palavra-chave: ${keyword}`, 'webhook');
      console.log(`[WEBHOOK] ✅ Recebido webhook para palavra-chave "${keyword}" da instância ${instanceId}`);
      
      // Log dos parâmetros recebidos
      log(`[Webhook Callback] Parâmetros: ${JSON.stringify(req.query)}`, 'webhook');
      
      // Se tiver uma conversation em JSON, tenta parsear
      let conversation = null;
      if (req.query.conversation) {
        try {
          conversation = JSON.parse(req.query.conversation as string);
          log(`[Webhook Callback] Conversation: ${JSON.stringify(conversation)}`, 'webhook');
        } catch (e) {
          log(`[Webhook Callback] Erro ao parsear conversation: ${e.message}`, 'webhook');
        }
      }
      
      // Retorna resposta de sucesso com os dados processados
      res.json({
        success: true,
        message: `Webhook recebido com sucesso para palavra-chave "${keyword}"`,
        data: {
          instanceId,
          keyword,
          phoneNumber,
          message,
          flowId,
          flowName,
          timestamp,
          conversation
        }
      });
    } catch (error: any) {
      console.error('Erro ao processar webhook callback:', error);
      log(`[Webhook Callback] Erro: ${error.message}`, 'webhook');
      
      res.status(500).json({
        success: false,
        message: `Erro ao processar webhook: ${error.message}`,
        error: error.toString()
      });
    }
  });
  
  // Endpoint para testar o webhook callback sem autenticação
  app.get("/api/test-webhook-callback", isAuthenticated, async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string || 'teste1';
      const keyword = req.query.keyword as string || 'olá';
      const phoneNumber = req.query.phoneNumber as string || '5511999999999';
      const message = req.query.message as string || 'Olá, como vai?';
      const flowId = req.query.flowId as string || '12345';
      const flowName = req.query.flowName as string || 'Teste';
      
      // Simula uma chamada ao webhook-callback
      log(`[Test Webhook] Simulando chamada de webhook para palavra-chave: ${keyword}`, 'test');
      console.log(`[TESTE WEBHOOK] Simulando chamada para palavra-chave "${keyword}" da instância ${instanceId}`);
      
      // Faz uma chamada interna usando axios para o nosso próprio webhook-callback
      const axios = require('axios');
      const response = await axios.get(`http://localhost:5000/api/webhook-callback`, {
        params: {
          instanceId,
          keyword,
          numero: phoneNumber,
          mensagem: message,
          flowId,
          flowName,
          timestamp: Date.now()
        }
      });
      
      // Retorna a resposta do webhook
      res.json({
        success: true,
        message: 'Teste de webhook realizado com sucesso',
        webhookResponse: response.data
      });
    } catch (error: any) {
      console.error('Erro ao testar webhook callback:', error);
      log(`[Test Webhook] Erro: ${error.message}`, 'test');
      
      res.status(500).json({
        success: false,
        message: `Erro ao testar webhook callback: ${error.message}`,
        error: error.toString()
      });
    }
  });

  return httpServer;
}
