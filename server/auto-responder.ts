/**
 * Serviço de resposta automática baseado no histórico de mensagens
 * 
 * Este serviço monitora as mensagens recebidas das instâncias do WhatsApp e 
 * automaticamente processa e responde usando fluxos de mensagens configurados.
 */

import { evolutionApi } from './evolution-api';
import { storage } from './storage';
import { log } from './vite';
import { processFlowsForInstance } from './message-processor';

// Classe para cache de mensagens processadas
class MessageProcessingCache {
  private cache: Map<string, { value: any, expires: number }> = new Map();
  
  set(key: string, value: any, ttl: number = 60000): void {
    const expires = Date.now() + ttl;
    this.cache.set(key, { value, expires });
  }

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Cache global para reuso em todo o serviço
const messageProcessingCache = new MessageProcessingCache();

interface ProcessMessageResult {
  success: boolean;
  phoneNumber: string;
  message: any;
  processed?: boolean;
  error?: any;
}

/**
 * Monitora o histórico de mensagens e processa mensagens não lidas
 * Versão robusta com cache e verificação de status das instâncias
 * Atualizado para melhor detecção e loggging em tempo real
 */
export async function monitorAndProcessNewMessages(instanceId: string, sendToWebhook: boolean = false): Promise<ProcessMessageResult[]> {
  try {
    // Busca a instância no banco de dados
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instância não encontrada: ${instanceId}`);
    }
    
    // Adicionamos um timestamp para verificar rapidamente em um cache local
    // se a mensagem já foi processada recentemente
    const currentTime = Date.now();
    const cacheKey = `${instanceId}_last_check`;
    const lastCheck = messageProcessingCache.get(cacheKey) || 0;
    
    // Evita logar constantemente a mesma informação para não poluir os logs
    const shouldLog = currentTime - lastCheck > 10000; // Log a cada 10 segundos no máximo
    
    if (shouldLog) {
      log(`[AutoResponder] Monitorando mensagens para instância: ${instance.name}`, 'auto-responder');
    }
    
    // Verificação de status da conexão antes de buscar mensagens
    // Esta verificação garante que a instância está realmente conectada
    try {
      const connectionState = await evolutionApi.checkConnectionState(instance.name);
      
      // CORREÇÃO IMPORTANTE: Na Evolution API, o estado 'open' significa que está conectado
      // Em vez de verificar "state !== 'open'", verificamos se não está conectado
      // Na Evolution API v2, 'open' é o estado correto para uma instância conectada
      const isConnected = connectionState.status && (connectionState.state === 'open' || connectionState.state === 'connected');
      
      if (!isConnected) {
        log(`[AutoResponder] Instância ${instance.name} não está conectada (estado: ${connectionState.state}). Tentando reconectar...`, 'auto-responder');
        
        // Armazena o status antigo para comparação
        const oldStatus = instance.status;
        
        // Atualiza o status da instância no banco para refletir o estado real
        if (oldStatus === 'connected') {
          await storage.updateInstanceStatus(instanceId, 'disconnected');
          log(`[AutoResponder] Status da instância ${instance.name} atualizado para 'disconnected'`, 'auto-responder');
        }
        
        // Se a instância estava conectada mas agora está desconectada, tenta reconectar
        if (oldStatus === 'connected') {
          try {
            log(`[AutoResponder] Tentando reconectar instância ${instance.name}...`, 'auto-responder');
            // Apenas tenta reconectar se o estado for 'disconnected' ou similar
            if (connectionState.state === 'disconnected' || connectionState.state === 'close') {
              await evolutionApi.connectInstance(instance.name);
              log(`[AutoResponder] Reconexão iniciada para instância ${instance.name}. Aguardando...`, 'auto-responder');
            }
          } catch (reconnectError) {
            log(`[AutoResponder] Erro ao tentar reconectar instância ${instance.name}: ${reconnectError}`, 'auto-responder');
          }
        }
        
        // Se a instância não está conectada, não continuamos a buscar mensagens
        return [];
      } else if (instance.status !== 'connected') {
        // Se a instância está conectada na API mas não no banco, atualizamos
        await storage.updateInstanceStatus(instanceId, 'connected');
        log(`[AutoResponder] Status da instância ${instance.name} atualizado para 'connected'`, 'auto-responder');
      }
    } catch (connectionError) {
      log(`[AutoResponder] Erro ao verificar conexão da instância ${instance.name}: ${connectionError}`, 'auto-responder');
      // Continuamos o processo mesmo com erro, para tentar buscar mensagens
    }
    
    // Cache de mensagens processadas para esta instância
    // Reduzimos o TTL do cache para 10 minutos para não acumular muitos IDs
    const processedMsgCacheKey = `${instanceId}_processed_msgs`;
    let processedMsgIds = messageProcessingCache.get(processedMsgCacheKey) as Set<string>;
    if (!processedMsgIds) {
      processedMsgIds = new Set<string>();
      messageProcessingCache.set(processedMsgCacheKey, processedMsgIds, 600000); // 10 minutos
    }
    
    // Limpar IDs antigos se o cache estiver muito grande (mais de 1000 mensagens)
    if (processedMsgIds.size > 1000) {
      log(`[AutoResponder] Cache de mensagens processadas muito grande (${processedMsgIds.size}). Limpando cache antigo.`, 'auto-responder');
      messageProcessingCache.delete(processedMsgCacheKey);
      processedMsgIds = new Set<string>();
      messageProcessingCache.set(processedMsgCacheKey, processedMsgIds, 600000);
    }
    
    // Busca mensagens mais recentes primeiro (aumentamos para 100 mensagens para capturar mais)
    // Compare com última sincronização para detectar novas mensagens
    const messagesResponse = await evolutionApi.findMessages(instance.name, undefined, 1, 100);
    if (!messagesResponse.status) {
      throw new Error(`Erro ao buscar mensagens: ${messagesResponse.message}`);
    }
    
    // Atualiza o timestamp da última verificação
    messageProcessingCache.set(cacheKey, currentTime, 3600000); // 1h
    
    // Verifica se temos mensagens - com mais formatos suportados
    let messages = [];
    
    // Extrai mensagens de vários formatos possíveis da Evolution API
    if (messagesResponse.result?.messages?.messages?.records) {
      // Formato padrão
      messages = messagesResponse.result.messages.messages.records;
    } else if (Array.isArray(messagesResponse.result?.messages)) {
      // Formato alternativo
      messages = messagesResponse.result.messages;
    } else if (Array.isArray(messagesResponse.result?.records)) {
      // Outro formato alternativo
      messages = messagesResponse.result.records;
    } else if (messagesResponse.result?.data?.messages) {
      // Formato da Evolution API v2
      messages = Array.isArray(messagesResponse.result.data.messages) 
        ? messagesResponse.result.data.messages 
        : [messagesResponse.result.data.messages];
    } else if (messagesResponse.messages) {
      // Acesso direto
      messages = Array.isArray(messagesResponse.messages) 
        ? messagesResponse.messages 
        : [messagesResponse.messages];
    }
    
    // Garantia final de que messages é um array válido
    if (!Array.isArray(messages)) {
      messages = [];
      console.log('[AutoResponder] Formato de resposta não reconhecido:', messagesResponse);
    }
    
    if (!messages.length) {
      if (shouldLog) {
        log(`[AutoResponder] Nenhuma mensagem encontrada para instância ${instance.name}`, 'auto-responder');
      }
      return [];
    }
    
    // Log extra para debug
    console.log(`[AutoResponder] Encontradas ${messages.length} mensagens para análise em ${instance.name}`);
    if (messages.length > 0) {
      console.log('[AutoResponder] Exemplo da primeira mensagem:', JSON.stringify(messages[0]).substring(0, 200) + '...');
    }
    
    // Verificar se os dados retornados estão no formato esperado e mostrar um exemplo para debug
    if (shouldLog && messages.length > 0) {
      try {
        const sampleMsg = messages[0];
        const sampleId = sampleMsg.id || sampleMsg.key?.id || 'sem ID';
        const sampleJid = sampleMsg.key?.remoteJid || 'sem JID';
        const sampleTime = sampleMsg.messageTimestamp || 'sem timestamp';
        log(`[AutoResponder] Exemplo de formato de mensagem: ID=${sampleId}, JID=${sampleJid}, Time=${sampleTime}`, 'auto-responder');
      } catch (formatError) {
        log(`[AutoResponder] Erro ao analisar formato de mensagem: ${formatError}`, 'auto-responder');
      }
    }
    
    // Primeiro passo: identificar mensagens mais recentes que ainda não foram processadas
    const currentTimestampSecs = Math.floor(Date.now() / 1000);
    // Considera mensagens das últimas 2 horas como candidatas a processamento
    const twoHoursAgo = currentTimestampSecs - (2 * 60 * 60);
    
    // Filtra mensagens recentes não processadas e não enviadas por nós
    const newMessages = messages.filter((msg: any) => {
      // Obtém id único da mensagem
      const messageId = msg.id || msg.key?.id;
      if (!messageId) return false;
      
      // Ignora mensagens enviadas por nós
      if (msg.key?.fromMe) return false;
      
      // Verifica se a mensagem é recente (últimas 2 horas)
      const msgTimestamp = msg.messageTimestamp || 0;
      const isRecent = msgTimestamp > twoHoursAgo;
      
      // Ignora mensagens antigas para não processar histórico muito antigo
      if (!isRecent) return false;
      
      // Verifica se a mensagem já foi processada
      if (processedMsgIds.has(messageId)) return false;
      
      // Adiciona esta mensagem ao cache para não processá-la novamente
      processedMsgIds.add(messageId);
      
      // Esta mensagem deve ser processada
      return true;
    });
    
    if (!newMessages.length) {
      if (shouldLog) {
        log(`[AutoResponder] Nenhuma mensagem nova para processar em ${instance.name}`, 'auto-responder');
      }
      return [];
    }
    
    log(`[AutoResponder] Processando ${newMessages.length} novas mensagens de ${instance.name}`, 'auto-responder');
    
    // Registra atividade de processamento no banco
    await storage.createActivity(instance.userId, {
      type: "messages_processed",
      description: `${newMessages.length} novas mensagens processadas automaticamente`,
      entityType: "instance",
      entityId: instance.id
    });
    
    // Processa cada mensagem nova em paralelo para maior eficiência
    const results = await Promise.all(newMessages.map(async (msg: any) => {
      try {
        // Extrai informações da mensagem
        const messageId = msg.id || msg.key?.id;
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid) {
          log(`[AutoResponder] Mensagem sem remoteJid: ${JSON.stringify(msg.key)}`, 'auto-responder');
          return {
            success: false,
            phoneNumber: 'desconhecido',
            message: msg,
            error: new Error('Mensagem sem remoteJid')
          };
        }
        
        const phoneNumber = remoteJid.split('@')[0];
        const pushName = msg.pushName || 'Usuário';
        
        // Extrai o texto da mensagem com melhor tratamento de tipos
        let messageText = '';
        if (msg.message) {
          if (msg.message.conversation) {
            messageText = msg.message.conversation;
          } else if (msg.message.extendedTextMessage?.text) {
            messageText = msg.message.extendedTextMessage.text;
          } else if (msg.body) {
            // Em alguns formatos da API, o texto vem diretamente no campo body
            messageText = msg.body;
          } else {
            // Tenta extrair o texto de várias propriedades possíveis
            Object.entries(msg.message).forEach(([key, value]: [string, any]) => {
              if (
                typeof value === 'string' && 
                !messageText && 
                key !== 'messageContextInfo' && 
                key !== 'deviceListMetadata'
              ) {
                messageText = value;
              } else if (
                typeof value === 'object' && 
                value !== null && 
                'text' in value && 
                typeof value.text === 'string'
              ) {
                messageText = value.text;
              }
            });
          }
        }
        
        if (!messageText) {
          messageText = "(Conteúdo não textual)";
        }
        
        log(`[AutoResponder] Processando mensagem de ${pushName} (${phoneNumber}): "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`, 'auto-responder');
        
        // Log detalhado para debug de mensagens
        console.log(`[DEBUG MENSAGEM] Processando:
          - ID Mensagem: ${messageId}
          - Contato: ${pushName} (${phoneNumber})
          - Conteúdo: ${messageText}
          - Instância: ${instance.name}
          - Origem: Monitoramento automático
        `);
        
        // Processa a mensagem através do processador de fluxos
        const timestamp = msg.messageTimestamp || Math.floor(Date.now() / 1000);
        const processed = await processFlowsForInstance(
          instance,
          phoneNumber,
          messageText,
          timestamp,
          messageId,
          sendToWebhook // Passa o parâmetro para enviar para webhook externo
        );
        
        // Se a mensagem foi processada com sucesso por um fluxo, registramos para analytics
        if (processed) {
          log(`[AutoResponder] Mensagem de ${phoneNumber} processada com sucesso por um fluxo`, 'auto-responder');
        }
        
        return {
          success: true,
          phoneNumber,
          message: msg,
          processed: !!processed
        };
        
      } catch (error) {
        log(`[AutoResponder] Erro ao processar mensagem: ${error}`, 'auto-responder');
        return {
          success: false,
          phoneNumber: msg.key?.remoteJid?.split('@')[0] || 'desconhecido',
          message: msg,
          error
        };
      }
    }));
    
    // Registra estatísticas sobre o processamento
    const successCount = results.filter(r => r.success).length;
    const processedCount = results.filter(r => r.processed).length;
    
    if (processedCount > 0) {
      log(`[AutoResponder] Resultados do processamento: ${successCount} sucessos, ${processedCount} mensagens processadas por fluxos`, 'auto-responder');
    }
    
    return results;
    
  } catch (error) {
    log(`[AutoResponder] Erro ao monitorar mensagens: ${error}`, 'auto-responder');
    throw error;
  }
}

/**
 * Envia uma resposta direta a uma mensagem específica
 */
export async function sendDirectResponse(
  instanceId: string,
  phoneNumber: string,
  message: string,
  quotedMessageId?: string
): Promise<boolean> {
  try {
    // Busca a instância
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instância não encontrada: ${instanceId}`);
    }
    
    // Se temos um ID de mensagem para citar
    let options: any = undefined;
    if (quotedMessageId) {
      log(`[AutoResponder] Buscando detalhes da mensagem para resposta citada: ${quotedMessageId}`, 'auto-responder');
      
      // Em uma implementação completa, aqui buscaríamos os detalhes da mensagem
      // para criar a estrutura quoted corretamente
      options = {
        quoted: {
          remoteJid: `${phoneNumber}@s.whatsapp.net`,
          fromMe: false,
          id: quotedMessageId
        }
      };
    }
    
    // Envia a mensagem
    const response = await evolutionApi.sendMessage(
      instance.name,
      phoneNumber,
      message,
      options
    );
    
    if (!response.status) {
      log(`[AutoResponder] Erro ao enviar resposta: ${response.message}`, 'auto-responder');
      return false;
    }
    
    log(`[AutoResponder] Resposta enviada com sucesso para ${phoneNumber}`, 'auto-responder');
    
    // Registra a atividade
    await storage.createActivity(instance.userId, {
      type: "message_sent",
      description: `Mensagem enviada para ${phoneNumber}`,
      entityType: "instance",
      entityId: instance.id
    });
    
    return true;
  } catch (error) {
    log(`[AutoResponder] Erro ao enviar resposta direta: ${error}`, 'auto-responder');
    return false;
  }
}

/**
 * Verifica se um número é um número de WhatsApp válido
 */
export async function verifyWhatsAppNumber(instanceId: string, phoneNumber: string): Promise<boolean> {
  try {
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instância não encontrada: ${instanceId}`);
    }
    
    // Normaliza o número de telefone
    const formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
    
    const response = await evolutionApi.verifyWhatsAppNumbers(instance.name, [formattedPhone]);
    
    if (!response.status || !response.result || !response.result.numbers) {
      return false;
    }
    
    // A API retorna um array com os números que são válidos no WhatsApp
    const validNumbers = response.result.numbers.valid || [];
    return validNumbers.includes(formattedPhone);
    
  } catch (error) {
    log(`[AutoResponder] Erro ao verificar número de WhatsApp: ${error}`, 'auto-responder');
    return false;
  }
}

/**
 * Configura um intervalo para monitorar automaticamente novas mensagens
 * para todas as instâncias conectadas
 */
let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Configuração aprimorada do monitoramento automático com logging em tempo real
 * e tratamento robusto de identificação de palavras-chave
 */
export function startAutoMonitoring(intervalSeconds: number = 1): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  
  const intervalMs = intervalSeconds * 1000;
  
  log(`[AutoResponder] Iniciando monitoramento automático a cada ${intervalSeconds} segundos`, 'auto-responder');
  console.log(`✅ [AutoMonitor] Sistema de detecção de palavras-chave iniciado! Monitorando a cada ${intervalSeconds} segundos`);
  
  // Marcador de tempo para controlar logs
  let lastLogTimestamp = 0;
  let monitoringCycleCount = 0;
  
  monitorInterval = setInterval(async () => {
    try {
      monitoringCycleCount++;
      
      // Timestamp para logs
      const currentTimestamp = Date.now();
      const shouldLogDetailedInfo = currentTimestamp - lastLogTimestamp > 30000; // Log detalhado a cada 30 segundos
      
      if (shouldLogDetailedInfo) {
        lastLogTimestamp = currentTimestamp;
        log(`[AutoResponder] Ciclo de monitoramento #${monitoringCycleCount} em execução - ${new Date().toISOString()}`, 'auto-responder');
      }
      
      // Busca todas as instâncias conectadas
      const instances = await storage.getAllConnectedInstances();
      
      // Só faz log se tiver pelo menos uma instância conectada
      if (instances.length > 0 && shouldLogDetailedInfo) {
        log(`[AutoResponder] Monitorando ${instances.length} instâncias conectadas`, 'auto-responder');
        console.log(`[Monitor Status] Verificando novas mensagens em ${instances.length} instâncias - ciclo #${monitoringCycleCount}`);
      }
      
      // Se não houver instâncias conectadas e for um ciclo de log detalhado
      if (instances.length === 0 && shouldLogDetailedInfo) {
        log(`[AutoResponder] ⚠️ Nenhuma instância conectada para monitoramento`, 'auto-responder');
        console.log(`⚠️ [Monitor Status] Nenhuma instância conectada disponível para monitoramento`);
      }
      
      // Processa mensagens para cada instância (em paralelo)
      const instanceResults = await Promise.all(instances.map(async (instance) => {
        try {
          // Também enviamos para o webhook no monitoramento automático (true)
          const results = await monitorAndProcessNewMessages(instance.id, true);
          
          // Verifica se encontrou e processou novas mensagens
          if (results && results.length > 0) {
            const processedMsgs = results.filter(r => r.processed);
            
            // Detecta se houve mensagens processadas
            if (processedMsgs && processedMsgs.length > 0) {
              // Log em tempo real para mensagens processadas
              log(`[AutoResponder] ✅ ${processedMsgs.length} novas mensagens processadas para instância ${instance.name} - ${new Date().toISOString()}`, 'auto-responder');
              console.log(`✅ [Monitor] ${processedMsgs.length} novas mensagens processadas para instância ${instance.name}`);
              
              // Registra o detalhe de cada mensagem processada
              processedMsgs.forEach(msg => {
                log(`[AutoResponder] 🔔 Mensagem de ${msg.phoneNumber} processada automaticamente`, 'auto-responder');
                console.log(`🔔 [Fluxo Acionado] Mensagem de ${msg.phoneNumber} acionou um fluxo de respostas!`);
              });
            }
            
            // Log para quando recebemos mensagens, mas nenhuma acionou fluxos
            if (results.length > 0 && processedMsgs.length === 0 && shouldLogDetailedInfo) {
              log(`[AutoResponder] ℹ️ ${results.length} mensagens analisadas, mas nenhuma acionou fluxos para instância ${instance.name}`, 'auto-responder');
            }
          }
          
          return { instance, success: true, processed: results?.filter(r => r.processed)?.length || 0 };
        } catch (error) {
          log(`[AutoResponder] ❌ Erro ao processar instância ${instance.name}: ${error}`, 'auto-responder');
          console.error(`❌ [Monitor Erro] Falha ao processar a instância ${instance.name}: ${error}`);
          return { instance, success: false, error };
        }
      }));
      
      // Resumo do ciclo de monitoramento (só loga se for interessante)
      const successfulInstances = instanceResults.filter(r => r.success);
      const processedCount = successfulInstances.reduce((sum, r) => sum + (r.processed || 0), 0);
      
      if (processedCount > 0) {
        log(`[AutoResponder] 📊 Resumo do ciclo #${monitoringCycleCount}: ${processedCount} mensagens processadas em ${successfulInstances.length}/${instances.length} instâncias`, 'auto-responder');
        console.log(`📊 [Monitor] Total: ${processedCount} mensagens com fluxos acionados em ${successfulInstances.length} instâncias`);
      }
    } catch (error) {
      log(`[AutoResponder] ⚠️ Erro no monitoramento automático: ${error}`, 'auto-responder');
      console.error(`⚠️ [Monitor Erro Global] Falha no sistema de monitoramento: ${error}`);
    }
  }, intervalMs);
}

export function stopAutoMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log(`[AutoResponder] Monitoramento automático interrompido`, 'auto-responder');
  }
}