/**
 * Serviço dedicado a acionar fluxos de mensagens
 * 
 * Este módulo oferece um sistema robusto e confiável para garantir que os fluxos
 * de mensagens sejam acionados corretamente quando uma palavra-chave é detectada,
 * independentemente do estado da interface ou da conexão.
 */

import { log } from './vite';
import { storage } from './storage';
import { evolutionApi } from './evolution-api';
import { sendToExternalWebhook } from './external-webhook-service';
import { messageQueueManager } from './message-queue-manager';
import { MessageFlow } from '@shared/schema';

// Mapa para controle de keywords já processadas recentemente (evita duplicações)
const processedKeywords = new Map<string, number>();

/**
 * Processa uma mensagem recebida e verifica se deve acionar algum fluxo
 * @param data Dados da mensagem a ser processada
 */
export async function triggerFlowWithMessage(data: {
  instanceId: string;
  instanceName: string;
  fromNumber: string;
  messageContent: string;
  messageId?: string;
  timestamp?: number;
  userId?: number;
}): Promise<{
  success: boolean;
  triggered: boolean;
  flowId?: string;
  flowName?: string;
  keyword?: string;
  error?: any;
}> {
  try {
    // Log detalhado para diagnóstico
    log(`[FlowTrigger] Analisando mensagem: "${data.messageContent.substring(0, 50)}${data.messageContent.length > 50 ? '...' : ''}"`, 'flow-trigger');
    
    // Busca o usuário da instância se não foi fornecido
    let userId = data.userId;
    if (!userId) {
      const instance = await storage.getInstance(data.instanceId);
      if (!instance) {
        throw new Error(`Instância não encontrada: ${data.instanceId}`);
      }
      userId = instance.userId;
    }
    
    // Busca todos os fluxos de mensagens ativos para esta instância
    const flows = await storage.getMessageFlowsByInstanceId(data.instanceId);
    const activeFlows = flows.filter(flow => flow.status === 'active');
    
    if (activeFlows.length === 0) {
      log(`[FlowTrigger] Nenhum fluxo ativo encontrado para a instância ${data.instanceName}`, 'flow-trigger');
      return { success: true, triggered: false };
    }
    
    // Verifica cada fluxo para encontrar correspondências
    for (const flow of activeFlows) {
      // Verifica se o fluxo tem uma palavra-chave configurada
      if (!flow.keyword) continue;
      
      const keyword = flow.keyword.toLowerCase();
      const messageContent = data.messageContent.toLowerCase();
      
      let isMatch = false;
      
      // Verifica de acordo com o tipo de gatilho
      const triggerType = flow.triggerType as string || 'contains';
      
      if ((triggerType === 'exact-match' || triggerType === 'exact_match') && messageContent === keyword) {
        isMatch = true;
      } else if (triggerType === 'contains' && messageContent.includes(keyword)) {
        isMatch = true;
      } else if (triggerType === 'all-messages' || triggerType === 'all_messages') {
        isMatch = true;
      }
      
      // Se encontrou correspondência
      if (isMatch) {
        // Evita processar a mesma keyword várias vezes em um curto período (1 segundo)
        const keywordKey = `${data.instanceId}:${data.fromNumber}:${keyword}`;
        const now = Date.now();
        const lastProcessed = processedKeywords.get(keywordKey) || 0;
        
        if (now - lastProcessed < 1000) {
          log(`[FlowTrigger] Ignorando keyword repetida "${keyword}" (processada recentemente)`, 'flow-trigger');
          continue;
        }
        
        // Marca essa keyword como processada agora
        processedKeywords.set(keywordKey, now);
        
        // Limpa keywords antigas a cada 100 entradas para evitar vazamento de memória
        if (processedKeywords.size > 100) {
          const fiveMinutesAgo = now - 5 * 60 * 1000;
          
          // Limpa manualmente processedKeywords quando fica muito grande
          const keysToDelete: string[] = [];
          processedKeywords.forEach((timestamp, key) => {
            if (timestamp < fiveMinutesAgo) {
              keysToDelete.push(key);
            }
          });
          
          keysToDelete.forEach(key => {
            processedKeywords.delete(key);
          });
        }
        
        log(`[FlowTrigger] ✅ Palavra-chave "${keyword}" encontrada no fluxo "${flow.name}"`, 'flow-trigger');
        
        // 1. Registra no histórico de mensagens
        await storage.createMessageHistory(userId, {
          instanceId: data.instanceId,
          instanceName: data.instanceName,
          sender: data.fromNumber,
          messageContent: data.messageContent,
          flowId: flow.id,
          triggeredKeyword: flow.keyword,
          status: "triggered",
          timestamp: new Date(data.timestamp || Date.now())
        });
        
        // 2. Envia para webhook externo
        const webhookSuccess = await sendToExternalWebhook(
          {
            flowId: flow.id,
            flowName: flow.name,
            keyword: flow.keyword,
            userId
          },
          { 
            phoneNumber: data.fromNumber, 
            messageContent: data.messageContent,
            timestamp: data.timestamp
          },
          { 
            id: data.instanceId,
            name: data.instanceName,
            status: 'connected'
          }
        );
        
        if (webhookSuccess) {
          log(`[FlowTrigger] Webhook externo notificado com sucesso`, 'flow-trigger');
        }
        
        // 3. Aciona o envio das mensagens de resposta
        try {
          // Processa e adiciona as mensagens na fila de envio
          const queuedFlowId = await messageQueueManager.addFlowMessagesToQueue(
            flow,
            data.instanceId,
            data.instanceName,
            data.fromNumber,
            data.messageContent,
            userId
          );
          
          if (queuedFlowId) {
            log(`[FlowTrigger] Fluxo "${flow.name}" em execução (ID: ${queuedFlowId})`, 'flow-trigger');
          } else {
            log(`[FlowTrigger] Erro ao adicionar mensagens do fluxo "${flow.name}" à fila`, 'flow-trigger');
          }
        } catch (queueError) {
          log(`[FlowTrigger] Erro ao processar fila de mensagens: ${queueError}`, 'flow-trigger');
        }
        
        return {
          success: true,
          triggered: true,
          flowId: flow.id,
          flowName: flow.name,
          keyword: flow.keyword
        };
      }
    }
    
    log(`[FlowTrigger] Nenhuma palavra-chave correspondente encontrada`, 'flow-trigger');
    return { success: true, triggered: false };
    
  } catch (error) {
    log(`[FlowTrigger] Erro ao processar fluxo: ${error}`, 'flow-trigger');
    console.error('[FlowTrigger] Erro detalhado:', error);
    
    return {
      success: false,
      triggered: false,
      error: error
    };
  }
}

/**
 * Testa o acionamento de um fluxo específico com uma palavra-chave
 * @param flowId ID do fluxo a ser testado
 * @param phoneNumber Número para envio (opcional, usa número de teste por padrão)
 */
export async function testFlowTrigger(
  flowId: string,
  phoneNumber: string = '5511999999999'
): Promise<{
  success: boolean;
  message: string;
  flowDetails?: any;
}> {
  try {
    // Log detalhado para diagnóstico
    console.log(`[TEST FLOW TRIGGER] Iniciando teste para flowId: ${flowId}, telefone: ${phoneNumber}`);
    
    // Busca o fluxo específico
    const flow = await storage.getMessageFlow(flowId);
    if (!flow) {
      console.log(`[TEST FLOW TRIGGER] Fluxo não encontrado: ${flowId}`);
      return {
        success: false,
        message: "Fluxo não encontrado"
      };
    }
    
    console.log(`[TEST FLOW TRIGGER] Fluxo encontrado: "${flow.name}" (${flow.id}), status: ${flow.status}`);
    
    // Verifica se o fluxo está ativo
    if (flow.status !== 'active') {
      console.log(`[TEST FLOW TRIGGER] O fluxo não está ativo: ${flow.status}`);
      return {
        success: false,
        message: `O fluxo "${flow.name}" não está ativo (status: ${flow.status})`
      };
    }
    
    // Verifica se a instância existe
    const instance = await storage.getInstance(flow.instanceId);
    if (!instance) {
      console.log(`[TEST FLOW TRIGGER] Instância não encontrada: ${flow.instanceId}`);
      return {
        success: false,
        message: "Instância do fluxo não encontrada"
      };
    }
    
    console.log(`[TEST FLOW TRIGGER] Instância encontrada: "${instance.name}" (${instance.id}), status: ${instance.status}`);
    
    // Verifica se a instância está conectada
    // Tratamos vários formatos de status possíveis como string
    const status = instance.status as string;
    if (status !== 'connected' && status !== 'open' && status !== 'true') {
      console.log(`[TEST FLOW TRIGGER] A instância não está conectada: ${instance.status}`);
      return {
        success: false,
        message: `A instância "${instance.name}" não está conectada (status: ${instance.status})`
      };
    }
    
    // Status está correto, definimos explicitamente para garantir consistência
    console.log(`[TEST FLOW TRIGGER] A instância está conectada com status: ${instance.status}`);
    if (instance.status !== 'connected') {
      await storage.updateInstanceStatus(instance.id, 'connected');
      console.log(`[TEST FLOW TRIGGER] Status atualizado para 'connected'`);
    }
    
    // Testa o acionamento com a palavra-chave do fluxo
    const keyword = flow.keyword || "mensagem de teste";
    
    log(`[FlowTrigger] Testando fluxo "${flow.name}" com a palavra-chave "${keyword}"`, 'flow-trigger');
    
    // Vamos verificar diretamente o tipo de gatilho e garantir que estamos testando corretamente
    console.log(`[TEST FLOW TRIGGER] Tipo de gatilho: ${flow.triggerType}, keyword: "${keyword}"`);
    
    // Usando message-processor para garantir consistência
    const { triggerMessageFlow } = await import('./message-processor');
    
    // Acionar diretamente o processador de fluxos
    try {
      console.log(`[TEST FLOW TRIGGER] Acionando triggerMessageFlow para instância ${instance.name}`);
      
      const queueResult = await triggerMessageFlow(
        instance.name,
        flow,
        phoneNumber,
        keyword // Passar a própria keyword como o conteúdo da mensagem
      );
      
      console.log(`[TEST FLOW TRIGGER] Resultado do acionamento:`, queueResult);
      
      return {
        success: true,
        message: `Fluxo "${flow.name}" acionado com sucesso!`,
        flowDetails: {
          id: flow.id,
          name: flow.name,
          keyword: flow.keyword,
          instanceId: flow.instanceId,
          instanceName: instance.name,
          queuedAt: new Date().toISOString()
        }
      };
    } catch (triggerError: any) {
      console.error(`[TEST FLOW TRIGGER] Erro ao acionar fluxo:`, triggerError);
      return {
        success: false,
        message: `Erro ao acionar fluxo: ${triggerError.message}`
      };
    }
  } catch (error: any) {
    console.error(`[TEST FLOW TRIGGER] Erro geral:`, error);
    log(`[FlowTrigger] Erro ao testar fluxo: ${error.message}`, 'flow-trigger');
    return {
      success: false,
      message: `Erro ao testar fluxo: ${error.message}`
    };
  }
}

/**
 * Verifica se uma mensagem específica aciona algum fluxo
 * Útil para testes de múltiplos fluxos com uma única mensagem
 */
export async function checkMessageTriggers(
  instanceId: string,
  messageContent: string,
  phoneNumber: string = '5511999999999'
): Promise<{
  success: boolean;
  triggered: boolean;
  triggeredFlows: Array<{
    id: string;
    name: string;
    keyword: string;
  }>;
  error?: any;
}> {
  try {
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      return {
        success: false,
        triggered: false,
        triggeredFlows: [],
        error: new Error("Instância não encontrada")
      };
    }
    
    // Busca todos os fluxos ativos desta instância
    const flows = await storage.getMessageFlowsByInstanceId(instanceId);
    const activeFlows = flows.filter(flow => flow.status === 'active');
    
    if (activeFlows.length === 0) {
      return {
        success: true,
        triggered: false,
        triggeredFlows: [],
      };
    }
    
    // Verifica quais fluxos seriam acionados com esta mensagem (sem acionar de fato)
    const messageContentLower = messageContent.toLowerCase();
    const triggeredFlows = activeFlows.filter(flow => {
      if (!flow.keyword) return false;
      
      const keyword = flow.keyword.toLowerCase();
      const triggerType = flow.triggerType as string || 'contains';
      
      if ((triggerType === 'exact-match' || triggerType === 'exact_match') && messageContentLower === keyword) {
        return true;
      } else if (triggerType === 'contains' && messageContentLower.includes(keyword)) {
        return true;
      } else if (triggerType === 'all-messages' || triggerType === 'all_messages') {
        return true;
      }
      
      return false;
    });
    
    return {
      success: true,
      triggered: triggeredFlows.length > 0,
      triggeredFlows: triggeredFlows.map(flow => ({
        id: flow.id,
        name: flow.name,
        keyword: flow.keyword
      }))
    };
    
  } catch (error) {
    return {
      success: false,
      triggered: false,
      triggeredFlows: [],
      error
    };
  }
}