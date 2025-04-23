/**
 * Manipulador de webhooks da Evolution API
 * 
 * Este serviço recebe e processa as notificações de webhooks
 * enviadas pela Evolution API, permitindo resposta instantânea
 * a novas mensagens sem necessidade de polling constante.
 * 
 * Atualizado para suportar múltiplos formatos da Evolution API v2
 * que podem variar dependendo da versão e configuração.
 */

import { log } from './vite';
import { storage } from './storage';
import { processIncomingMessage } from './message-processor';
import { evolutionApi } from './evolution-api';

/**
 * Processa um evento de webhook da Evolution API
 * Exportado como processWebhook para compatibilidade com as rotas
 */
export async function processWebhook(webhookData: any): Promise<any> {
  console.log('teste')
  try {
    // Verifica se o webhook contém os dados necessários
    if (!webhookData || !webhookData.instance || !webhookData.instance.instanceName) {
      log(`[Webhook] Dados de webhook inválidos`, 'webhook');
      return {
        success: false,
        message: 'Dados de webhook inválidos'
      };
    }

    const instanceName = webhookData.instance.instanceName;
    log(`[Webhook] Recebido webhook para instância ${instanceName}`, 'webhook');

    // Busca instância no banco de dados pelo nome
    const instances = await storage.getInstancesByName(instanceName);
    if (!instances || instances.length === 0) {
      log(`[Webhook] Instância ${instanceName} não encontrada no banco de dados`, 'webhook');
      return {
        success: false,
        message: `Instância ${instanceName} não encontrada`
      };
    }

    const instance = instances[0];

    // Registra a recepção do webhook
    log(`[Webhook] Processando webhook para instância ${instanceName} (ID: ${instance.id})`, 'webhook');

    // Extrai o ID da instância (pode estar em diferentes lugares dependendo da versão da API)
    const instanceId = webhookData.instance?.instanceId || instance.id;
    
    // Debug completo do webhook recebido para diagnóstico
    console.log('[DEBUG WEBHOOK COMPLETO]', JSON.stringify(webhookData, null, 2));
    
    // Verifica se é um evento de mensagem
    if (webhookData.event === 'messages.upsert' || 
        (webhookData.data && webhookData.data.message) || 
        !!webhookData.receive || 
        !!webhookData.recieve) {
      await handleNewMessage(instanceId, webhookData);
    } 
    // Verificar se é um evento de mudança de estado de conexão
    else if (webhookData.event === 'connection.update' || 
             webhookData.event === 'status.instance' || 
             (webhookData.connection && webhookData.connection.state)) {
      await handleConnectionUpdate(instanceId, webhookData);
    }
    // Outros tipos de eventos
    else {
      log(`[Webhook] Evento desconhecido ou não tratado: ${webhookData.event || 'sem tipo de evento'}`, 'webhook');
      console.log(`[Webhook] Estrutura do webhook não reconhecida:`, JSON.stringify(webhookData, null, 2));
    }

    return {
      success: true,
      message: 'Webhook processado com sucesso',
      instanceId: instance.id
    };
  } catch (error) {
    log(`[Webhook] Erro ao processar webhook: ${error}`, 'webhook');
    return {
      success: false,
      message: `Erro ao processar webhook: ${error}`
    };
  }
}

/**
 * Trata um evento de nova mensagem de forma simplificada
 * Foca em extrair diretamente o número do remetente e o conteúdo da mensagem
 * para processar o fluxo de respostas de forma mais direta
 */
async function handleNewMessage(instanceId: string, webhookData: any): Promise<void> {
  try {
    log(`[Webhook] Processando evento de nova mensagem para instância ${instanceId}`, 'webhook');
    
    // Debug completo do webhook para análise
    console.log(`[DEBUG WEBHOOK COMPLETO]`, JSON.stringify(webhookData, null, 2));
    
    // Busca a instância completa (necessário fazer antes para verificar se existe)
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      log(`[Webhook] Instância ${instanceId} não encontrada para processamento de mensagem`, 'webhook');
      return;
    }
    
    // Registra a atividade de recebimento de webhook
    await storage.createActivity(instance.userId, {
      type: "webhook_message_received",
      description: `Webhook de mensagem recebido para a instância ${instance.name}`,
      entityType: "instance",
      entityId: instance.id
    });
    
    // Extrai as mensagens do webhook de modo simplificado (suporta diferentes formatos da API)
    let messages = [];
    
    if (webhookData.receive?.messages && webhookData.receive.messages.length > 0) {
      messages = webhookData.receive.messages;
    } else if (webhookData.recieve?.messages && webhookData.recieve.messages.length > 0) {
      messages = webhookData.recieve.messages;
    } else if (webhookData.data?.message) {
      messages = [webhookData.data.message];
    } else if (webhookData.messages && webhookData.messages.length > 0) {
      messages = webhookData.messages;
    } else if (webhookData.data?.messages && webhookData.data.messages.length > 0) {
      messages = webhookData.data.messages;
    }
    
    log(`[Webhook] Encontradas ${messages.length} mensagens para processar`, 'webhook');
    
    // Cria uma fila para mostrar que as mensagens estão sendo processadas
    const messageQueue = messages.map((msg: any, index: number) => {
      // Formata um identificador básico para a mensagem
      const messageId = msg.key?.id || msg.id || `msg-${Date.now()}-${index}`;
      return {
        index,
        messageId,
        status: 'pendente',
        processStartTime: null,
        processEndTime: null
      };
    });
    
    console.log(`[WEBHOOK FILA] Mensagens para processar:`, JSON.stringify(messageQueue, null, 2));
    
    // Processa cada mensagem na notificação
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const queueItem = messageQueue[i];
      
      queueItem.status = 'processando';
      queueItem.processStartTime = new Date().toISOString();
      
      log(`[Webhook] Iniciando processamento da mensagem ${i+1}/${messages.length}`, 'webhook');
      
      // Ignora mensagens enviadas por nós mesmos
      const isFromMe = message.key?.fromMe === true || message.fromMe === true;
      if (isFromMe) {
        log(`[Webhook] Ignorando mensagem enviada por mim mesmo`, 'webhook');
        queueItem.status = 'ignorada';
        queueItem.processEndTime = new Date().toISOString();
        continue;
      }
      
      // Obtém ID da mensagem
      const messageId = message.key?.id || message.id || `webhook-${Date.now()}-${i}`;
      
      // Extrai o número do telefone - prioriza formatos mais comuns
      let phoneNumber = null;
      
      if (message.key?.remoteJid) {
        phoneNumber = message.key.remoteJid.split('@')[0];
      } else if (message.sender?.formattedNumber) {
        phoneNumber = message.sender.formattedNumber;
      } else if (message.sender?.id) {
        phoneNumber = message.sender.id.split('@')[0];
      } else if (message.from) {
        phoneNumber = typeof message.from === 'string' ? message.from.split('@')[0] : message.from;
      }
      
      // Normaliza o formato do número (remove caracteres não numéricos)
      if (phoneNumber) {
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      }
      
      if (!phoneNumber) {
        log(`[Webhook] Mensagem sem número de telefone válido, ignorando`, 'webhook');
        queueItem.status = 'erro';
        queueItem.processEndTime = new Date().toISOString();
        continue;
      }
      
      // Extrai o texto da mensagem - prioriza formatos mais comuns
      let messageText = '';
      
      if (message.message?.conversation) {
        messageText = message.message.conversation;
      } else if (message.message?.extendedTextMessage?.text) {
        messageText = message.message.extendedTextMessage.text;
      } else if (message.body) {
        messageText = message.body;
      } else if (typeof message.message === 'string') {
        messageText = message.message;
      } else if (message.text) {
        messageText = message.text;
      }
      
      // Se não conseguiu extrair texto, marca como conteúdo não textual
      if (!messageText) {
        messageText = "(Conteúdo não textual)";
      }
      
      // Obtém timestamp
      const timestamp = message.messageTimestamp 
        ? (typeof message.messageTimestamp === 'number' ? message.messageTimestamp : parseInt(message.messageTimestamp)) 
        : Math.floor(Date.now() / 1000);
      
      log(`[Webhook] Processando mensagem de ${phoneNumber}: "${messageText}"`, 'webhook');
      
      try {
        // Log detalhado da mensagem que será processada
        console.log(`[WEBHOOK MENSAGEM] Processando mensagem:
          - Número remetente: ${phoneNumber}
          - Conteúdo: "${messageText}"
          - ID: ${messageId}
          - Timestamp: ${new Date(timestamp * 1000).toISOString()}
          - Instância: ${instance.name} (${instance.id})
        `);
        
        // Registra no histórico antes do processamento
        const messageHistoryEntry = await storage.createMessageHistory(instance.userId, {
          instanceId: instance.id,
          instanceName: instance.name,
          sender: phoneNumber,
          messageContent: messageText,
          timestamp: new Date(timestamp * 1000),
          status: 'received',
          triggeredKeyword: null,
          flowId: null
        });
        
        console.log(`[WEBHOOK PROCESSANDO] Iniciando processamento do fluxo para a mensagem "${messageText}"`);
        
        // Processa a mensagem para verificar e disparar fluxos configurados
        // Adicionamos o parâmetro true para sendToWebhook
        log(`[Webhook] Chamando processIncomingMessage com parâmetro sendToWebhook=true`, 'webhook');
        
        const processed = await processIncomingMessage(
          instance,
          phoneNumber,
          messageText,
          messageId,
          timestamp * 1000,
          true // Ativa envio para webhook externo
        );
        
        log(`[Webhook] Resultado do processamento: ${processed ? 'Mensagem processada' : 'Mensagem não processada'}`, 'webhook');
        
        if (processed) {
          log(`[Webhook] Mensagem processada com sucesso por um fluxo: ${messageId}`, 'webhook');
          queueItem.status = 'concluído';
          
          // Atualiza o registro no histórico
          if (messageHistoryEntry?.id) {
            await storage.updateMessageHistoryStatus(
              messageHistoryEntry.id, 
              'triggered',
              `Mensagem processada e fluxo disparado`
            );
          }
        } else {
          log(`[Webhook] Mensagem não processada por nenhum fluxo: ${messageId}`, 'webhook');
          queueItem.status = 'não processada';
        }
      } catch (processError) {
        log(`[Webhook] Erro ao processar mensagem via webhook: ${processError}`, 'webhook');
        queueItem.status = 'erro';
        console.error('[WEBHOOK ERRO] Detalhes do erro:', processError);
      }
      
      queueItem.processEndTime = new Date().toISOString();
    }
    
    // Log final da fila de processamento
    console.log(`[WEBHOOK FILA] Status final do processamento:`, JSON.stringify(messageQueue, null, 2));
    
  } catch (error) {
    log(`[Webhook] Erro ao processar evento de mensagem: ${error}`, 'webhook');
    console.error('[WEBHOOK ERRO GERAL] Falha no tratamento do webhook:', error);
  }
}

/**
 * Trata um evento de atualização de conexão
 */
async function handleConnectionUpdate(instanceId: string, webhookData: any): Promise<void> {
  try {
    log(`[Webhook] Processando evento de atualização de conexão`, 'webhook');

    // Extrai informações de estado da conexão
    const connectionState = webhookData.connection || {};
    const newState = connectionState.state || '';

    // Busca a instância no banco
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      log(`[Webhook] Instância ${instanceId} não encontrada`, 'webhook');
      return;
    }

    log(`[Webhook] Instância ${instance.name} teve atualização de estado: ${newState}`, 'webhook');

    // Atualiza o status da instância de acordo com o novo estado
    // Suporte para ambos os formatos da Evolution API v1 e v2
    const isConnected = newState === 'open' || newState === 'connected' || newState === 'CONNECTED';
    const isDisconnected = newState === 'close' || newState === 'disconnected' || newState === 'DISCONNECTED';
    
    if (isConnected && instance.status !== 'connected') {
      await storage.updateInstanceStatus(instanceId, 'connected');
      log(`[Webhook] Status da instância ${instance.name} atualizado para 'connected' (estado original: ${newState})`, 'webhook');
      
      // Após a conexão, configuramos as settings recomendadas
      try {
        await evolutionApi.setSettings(instance.name, {
          reject_call: true,
          read_messages: true,
          read_status: true
        });
        log(`[Webhook] Configurações de leitura de mensagens aplicadas para ${instance.name}`, 'webhook');
      } catch (error: any) {
        log(`[Webhook] Erro ao configurar settings após conexão: ${error?.message || 'Erro desconhecido'}`, 'webhook');
      }
      
      // Registra atividade
      await storage.createActivity(instance.userId, {
        type: "instance_connected",
        description: `Instância ${instance.name} conectada via webhook`,
        entityType: "instance",
        entityId: instance.id
      });
    } 
    else if (isDisconnected && instance.status !== 'disconnected') {
      await storage.updateInstanceStatus(instanceId, 'disconnected');
      log(`[Webhook] Status da instância ${instance.name} atualizado para 'disconnected' (estado original: ${newState})`, 'webhook');
      
      // Registra atividade
      await storage.createActivity(instance.userId, {
        type: "instance_disconnected",
        description: `Instância ${instance.name} desconectada via webhook`,
        entityType: "instance",
        entityId: instance.id
      });
    }
  } catch (error) {
    log(`[Webhook] Erro ao processar evento de conexão: ${error}`, 'webhook');
  }
}

/**
 * Configura o webhook para uma instância na Evolution API
 */
export async function setupInstanceWebhook(instanceId: string, baseUrl: string): Promise<boolean> {
  try {
    // Busca a instância no banco
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      log(`[Webhook] Instância ${instanceId} não encontrada para configuração de webhook`, 'webhook');
      return false;
    }

    // Constrói a URL do webhook com autenticação
    const webhookUrl = `${baseUrl}/api/webhook/${instanceId}`;
    log(`[Webhook] Configurando webhook para instância ${instance.name}: ${webhookUrl}`, 'webhook');

    // Configura o webhook na Evolution API
    const result = await evolutionApi.setWebhook(instance.name, webhookUrl);
    
    if (!result.status) {
      log(`[Webhook] Erro ao configurar webhook: ${result.message}`, 'webhook');
      return false;
    }
    
    // Configura também as settings recomendadas
    try {
      const settingsResult = await evolutionApi.setSettings(instance.name, {
        reject_call: true,
        read_messages: true,
        read_status: true,
        msg_delete: true,
        groups_ignore: false
      });
      
      if (settingsResult.status) {
        log(`[Webhook] Settings configurados com sucesso para ${instance.name}`, 'webhook');
      } else {
        log(`[Webhook] Erro ao configurar settings: ${settingsResult.message}`, 'webhook');
      }
    } catch (settingsError: any) {
      log(`[Webhook] Exceção ao configurar settings: ${settingsError?.message || 'Erro desconhecido'}`, 'webhook');
      // Não interrompe o fluxo, apenas registra o erro
    }

    log(`[Webhook] Webhook configurado com sucesso para instância ${instance.name}`, 'webhook');
    
    // Registra atividade
    await storage.createActivity(instance.userId, {
      type: "webhook_configured",
      description: `Webhook configurado para instância ${instance.name}`,
      entityType: "instance",
      entityId: instance.id
    });

    return true;
  } catch (error) {
    log(`[Webhook] Erro ao configurar webhook: ${error}`, 'webhook');
    return false;
  }
}