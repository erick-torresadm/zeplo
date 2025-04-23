/**
 * Sistema de Fila de Mensagens
 * 
 * Gerencia o envio sequencial de mensagens com atrasos configuráveis
 * conforme exigido para os fluxos de respostas automáticas do WhatsApp.
 * 
 * Integra-se com o FlowQueueService para rastrear fluxos ativos em tempo real.
 */

import { log } from './vite';
import { evolutionApi } from './evolution-api';
import { storage } from './storage';
import { v4 as uuidv4 } from 'uuid';
import { flowQueueService } from './flow-queue-service';

/**
 * Estrutura de uma mensagem na fila
 */
interface QueuedMessage {
  id: string;
  instanceName: string;
  phoneNumber: string;
  message: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFileName?: string;
  delayBeforeSendMs?: number;
  scheduledTime: number;
  messageHistoryId?: number; // ID no histórico de mensagens (se registrado)
  queuedFlowId?: string;     // ID do fluxo de mensagens na fila (para rastreamento)
  isFirstMessageInFlow?: boolean; // Indica se é a primeira mensagem do fluxo
  isLastMessageInFlow?: boolean;  // Indica se é a última mensagem do fluxo
  flowId?: string; // ID do fluxo que gerou a mensagem
  retries: number;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  result?: any; // Resultado da API quando processada
  error?: any; // Erro, se houver
}

/**
 * Gerenciador de fila de mensagens
 */
class MessageQueueManager {
  private messageQueue: Map<string, QueuedMessage> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_PROCESS_INTERVAL_MS = 1000; // Intervalo padrão para processar a fila
  private readonly MAX_RETRIES = 3; // Número máximo de tentativas para enviar uma mensagem
  
  constructor() {
    this.startProcessing();
    log('[MessageQueueManager] Sistema de fila de mensagens inicializado', 'message-queue');
  }
  
  /**
   * Adiciona as mensagens de um fluxo inteiro à fila
   * @param flow Fluxo de mensagens a ser processado
   * @param instanceId ID da instância
   * @param instanceName Nome da instância
   * @param phoneNumber Número do telefone de destino
   * @param originalMessage Mensagem original que acionou o fluxo
   * @param userId ID do usuário proprietário do fluxo
   * @returns ID do fluxo na fila de monitoramento
   */
  public async addFlowMessagesToQueue(
    flow: any,
    instanceId: string,
    instanceName: string,
    phoneNumber: string,
    originalMessage: string,
    userId: number
  ): Promise<string> {
    // Identifica o nome de contato com base no formato do número de telefone
    let recipientName = 'Contato';
    try {
      const contactName = await this.extractContactName(instanceName, phoneNumber);
      if (contactName) {
        recipientName = contactName;
      }
    } catch (error) {
      log(`[MessageQueueManager] Erro ao obter nome do contato: ${error}`, 'message-queue');
    }
    
    // Gera um ID único para este fluxo na fila
    const queuedFlowId = uuidv4();
    
    log(`[MessageQueueManager] Processando fluxo "${flow.name}" para ${phoneNumber} (${recipientName})`, 'message-queue');
    
    // Verifica se as mensagens estão no formato esperado
    if (!flow.messages) {
      log(`[MessageQueueManager] Fluxo sem mensagens definidas: ${flow.id}`, 'message-queue');
      return '';
    }
    
    let messages = flow.messages;
    
    // Conversão de string para array se necessário (compatibilidade com versões anteriores)
    if (typeof messages === 'string') {
      try {
        // Tenta analisar como JSON
        const parsed = JSON.parse(messages);
        messages = Array.isArray(parsed) ? parsed : [{ text: messages }];
      } catch (e) {
        // Se não for JSON válido, trata como texto simples
        messages = [{ text: messages }];
      }
    } else if (!Array.isArray(messages)) {
      // Se não for array nem string, converte para um item de array
      messages = [{ text: JSON.stringify(messages) }];
    }
    
    // Garante que ao menos uma mensagem seja enviada
    if (messages.length === 0) {
      log(`[MessageQueueManager] Fluxo sem mensagens após processamento: ${flow.id}`, 'message-queue');
      return '';
    }
    
    // Registra no serviço de fila para monitoramento em tempo real
    flowQueueService.addOrUpdateFlow({
      id: queuedFlowId,
      flowId: flow.id,
      flowName: flow.name,
      instanceId: instanceId,
      instanceName: instanceName,
      recipientNumber: phoneNumber,
      recipientName: recipientName,
      status: 'pending',
      scheduledTime: Date.now(),
      messageIndex: 0,
      totalMessages: messages.length,
      triggerKeyword: flow.keyword,
      triggerMessage: originalMessage,
      userId: userId
    });
    
    // Atraso inicial configurado no fluxo ou padrão
    let initialDelay = 0;
    if (flow.triggerDelay && !isNaN(parseInt(flow.triggerDelay))) {
      initialDelay = parseInt(flow.triggerDelay) * 1000; // Converte para milissegundos
    }
    
    let cumulativeDelay = initialDelay;
    
    // Processa cada mensagem do fluxo
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      try {
        // Flag para identificar primeira e última mensagem
        const isFirstMessage = i === 0;
        const isLastMessage = i === messages.length - 1;
        
        // Atraso específico para esta mensagem (em segundos, convertido para ms)
        const messageDelay = typeof message.delay === 'number' 
          ? message.delay * 1000 
          : typeof message.delay === 'string' && !isNaN(parseInt(message.delay))
            ? parseInt(message.delay) * 1000
            : 1000; // Padrão: 1 segundo
        
        // Adiciona à fila com base no tipo de mensagem
        if (typeof message === 'string') {
          // Mensagem de texto simples
          this.enqueueTextMessage(instanceName, phoneNumber, message, {
            delayBeforeSendMs: cumulativeDelay,
            flowId: flow.id,
            queuedFlowId: queuedFlowId,
            isFirstMessageInFlow: isFirstMessage,
            isLastMessageInFlow: isLastMessage
          });
        } else if (typeof message === 'object' && message !== null) {
          // Tratamento baseado no tipo de mensagem
          switch (message.type) {
            case 'image':
              if (message.mediaUrl) {
                this.enqueueMediaMessage(
                  instanceName, phoneNumber, 'image', message.mediaUrl, {
                    caption: message.caption || '',
                    delayBeforeSendMs: cumulativeDelay,
                    flowId: flow.id,
                    queuedFlowId: queuedFlowId,
                    isFirstMessageInFlow: isFirstMessage,
                    isLastMessageInFlow: isLastMessage
                  }
                );
              }
              break;
              
            case 'audio':
              if (message.mediaUrl) {
                this.enqueueMediaMessage(
                  instanceName, phoneNumber, 'audio', message.mediaUrl, {
                    delayBeforeSendMs: cumulativeDelay,
                    flowId: flow.id,
                    queuedFlowId: queuedFlowId,
                    isFirstMessageInFlow: isFirstMessage,
                    isLastMessageInFlow: isLastMessage
                  }
                );
              }
              break;
              
            case 'video':
              if (message.mediaUrl) {
                this.enqueueMediaMessage(
                  instanceName, phoneNumber, 'video', message.mediaUrl, {
                    caption: message.caption || '',
                    delayBeforeSendMs: cumulativeDelay,
                    flowId: flow.id,
                    queuedFlowId: queuedFlowId,
                    isFirstMessageInFlow: isFirstMessage,
                    isLastMessageInFlow: isLastMessage
                  }
                );
              }
              break;
              
            case 'document':
              if (message.mediaUrl) {
                this.enqueueMediaMessage(
                  instanceName, phoneNumber, 'document', message.mediaUrl, {
                    fileName: message.fileName || 'documento.pdf',
                    delayBeforeSendMs: cumulativeDelay,
                    flowId: flow.id,
                    queuedFlowId: queuedFlowId,
                    isFirstMessageInFlow: isFirstMessage,
                    isLastMessageInFlow: isLastMessage
                  }
                );
              }
              break;
              
            case 'text':
            default:
              // Para tipo text ou qualquer outro tipo não especificado
              const text = message.text || message.message || JSON.stringify(message);
              this.enqueueTextMessage(instanceName, phoneNumber, text, {
                delayBeforeSendMs: cumulativeDelay,
                flowId: flow.id,
                queuedFlowId: queuedFlowId,
                isFirstMessageInFlow: isFirstMessage,
                isLastMessageInFlow: isLastMessage
              });
              break;
          }
        }
        
        // Atualiza o atraso cumulativo para a próxima mensagem
        cumulativeDelay += messageDelay;
        
      } catch (error) {
        log(`[MessageQueueManager] Erro ao processar mensagem ${i} do fluxo: ${error}`, 'message-queue');
      }
    }
    
    // Registra atividade no sistema
    try {
      await storage.createActivity(userId, {
        type: "flow_triggered",
        description: `Fluxo "${flow.name}" acionado para ${phoneNumber} (${recipientName})`,
        entityType: "message_flow",
        entityId: flow.id,
        metadata: {
          instanceId,
          instanceName,
          phoneNumber,
          recipientName,
          triggerKeyword: flow.keyword,
          messageCount: messages.length
        }
      });
    } catch (activityError) {
      log(`[MessageQueueManager] Erro ao registrar atividade de fluxo: ${activityError}`, 'message-queue');
    }
    
    return queuedFlowId;
  }
  
  /**
   * Extrai o nome do contato com base no número de telefone
   */
  private async extractContactName(instanceName: string, phoneNumber: string): Promise<string | null> {
    try {
      // Formata o número do telefone
      const formattedPhone = phoneNumber.replace(/\D/g, '');
      
      // Busca contatos da instância
      const contacts = await evolutionApi.getAllContacts(instanceName);
      
      if (!contacts.status || !contacts.contacts) {
        return null;
      }
      
      // Procura o contato correspondente
      const contact = contacts.contacts.find((c: any) => {
        // Normaliza o ID do contato
        let contactId = c.id || '';
        if (typeof contactId === 'object' && contactId.user) {
          contactId = contactId.user;
        }
        
        // Remove sufixos como @s.whatsapp.net ou @c.us
        if (typeof contactId === 'string') {
          contactId = contactId.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
        }
        
        // Remove caracteres não numéricos para comparar
        contactId = contactId.replace(/\D/g, '');
        
        return contactId === formattedPhone;
      });
      
      if (!contact) return null;
      
      // Retorna o nome do contato, em ordem de preferência
      return contact.name || contact.shortName || contact.pushName || contact.notify || null;
      
    } catch (error) {
      log(`[MessageQueueManager] Erro ao extrair nome do contato: ${error}`, 'message-queue');
      return null;
    }
  }
  
  /**
   * Adiciona uma mensagem de texto à fila
   */
  public enqueueTextMessage(
    instanceName: string,
    phoneNumber: string,
    message: string,
    options?: {
      delayBeforeSendMs?: number,
      flowId?: string,
      messageHistoryId?: number,
      queuedFlowId?: string
    }
  ): string {
    const messageId = uuidv4();
    const now = Date.now();
    const scheduledTime = now + (options?.delayBeforeSendMs || 0);
    
    const queuedMessage: QueuedMessage = {
      id: messageId,
      instanceName,
      phoneNumber,
      message,
      delayBeforeSendMs: options?.delayBeforeSendMs,
      scheduledTime,
      flowId: options?.flowId,
      queuedFlowId: options?.queuedFlowId,
      messageHistoryId: options?.messageHistoryId,
      retries: 0,
      status: 'scheduled'
    };
    
    this.messageQueue.set(messageId, queuedMessage);
    
    log(`[MessageQueueManager] Mensagem de texto adicionada à fila para ${phoneNumber} (atraso: ${options?.delayBeforeSendMs || 0}ms)`, 'message-queue');
    
    // Se tiver ID de histórico, atualiza o status no banco de dados
    if (options?.messageHistoryId) {
      this.updateMessageHistoryStatus(options.messageHistoryId, 'scheduled');
    }
    
    return messageId;
  }
  
  /**
   * Adiciona uma mensagem de mídia à fila (imagem, áudio, vídeo, documento)
   */
  public enqueueMediaMessage(
    instanceName: string,
    phoneNumber: string,
    mediaType: 'image' | 'audio' | 'video' | 'document',
    mediaUrl: string,
    options?: {
      caption?: string,
      fileName?: string,
      delayBeforeSendMs?: number,
      flowId?: string,
      queuedFlowId?: string,
      messageHistoryId?: number
    }
  ): string {
    const messageId = uuidv4();
    const now = Date.now();
    const scheduledTime = now + (options?.delayBeforeSendMs || 0);
    
    const queuedMessage: QueuedMessage = {
      id: messageId,
      instanceName,
      phoneNumber,
      message: options?.caption || '', // A legenda vai como mensagem
      mediaType,
      mediaUrl,
      mediaCaption: options?.caption,
      mediaFileName: options?.fileName,
      delayBeforeSendMs: options?.delayBeforeSendMs,
      scheduledTime,
      flowId: options?.flowId,
      queuedFlowId: options?.queuedFlowId,
      messageHistoryId: options?.messageHistoryId,
      retries: 0,
      status: 'scheduled'
    };
    
    this.messageQueue.set(messageId, queuedMessage);
    
    log(`[MessageQueueManager] Mensagem de mídia (${mediaType}) adicionada à fila para ${phoneNumber} (atraso: ${options?.delayBeforeSendMs || 0}ms)`, 'message-queue');
    
    // Se tiver ID de histórico, atualiza o status no banco de dados
    if (options?.messageHistoryId) {
      this.updateMessageHistoryStatus(options.messageHistoryId, 'scheduled');
    }
    
    return messageId;
  }
  
  /**
   * Enfileira uma sequência de mensagens com atrasos entre elas
   */
  public enqueueMessageSequence(
    instanceName: string,
    phoneNumber: string,
    messages: Array<{
      text: string,
      delayAfterMs?: number
    }>,
    options?: {
      initialDelayMs?: number,
      flowId?: string,
      flowName?: string,
      triggerKeyword?: string,
      triggerMessage?: string,
      recipientName?: string,
      queuedFlowId?: string
    }
  ): string[] {
    const messageIds: string[] = [];
    let cumulativeDelay = options?.initialDelayMs || 0;
    const now = Date.now();
    
    // Registra o fluxo no serviço de fila de fluxos para monitoramento em tempo real
    if (options?.flowId) {
      // Busca a instância para obter mais detalhes
      storage.getInstancesByName(instanceName).then(instances => {
        if (instances && instances.length > 0) {
          const instance = instances[0];
          // Adiciona o fluxo à fila de monitoramento
          flowQueueService.addOrUpdateFlow({
            flowId: options.flowId!,
            flowName: options.flowName || `Fluxo ${options.flowId}`,
            instanceId: instance.id,
            instanceName: instanceName,
            recipientNumber: phoneNumber,
            recipientName: options.recipientName,
            status: 'pending',
            scheduledTime: now + (options.initialDelayMs || 0),
            messageIndex: 0,
            totalMessages: messages.length,
            triggerKeyword: options.triggerKeyword,
            triggerMessage: options.triggerMessage
          });
          
          log(`[MessageQueueManager] Fluxo "${options.flowName || options.flowId}" adicionado à fila de monitoramento`, 'message-queue');
        }
      }).catch(error => {
        log(`[MessageQueueManager] Erro ao registrar fluxo na fila de monitoramento: ${error}`, 'message-queue');
      });
    }
    
    // Enfileira cada mensagem na sequência com o atraso acumulado
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const msgId = this.enqueueTextMessage(instanceName, phoneNumber, message.text, {
        delayBeforeSendMs: cumulativeDelay,
        flowId: options?.flowId,
        queuedFlowId: options?.queuedFlowId
      });
      
      messageIds.push(msgId);
      
      // Adiciona o atraso após esta mensagem para a próxima
      cumulativeDelay += (message.delayAfterMs || 0);
      
      // Atualiza o índice da mensagem no serviço de fila de fluxos
      if (options?.flowId) {
        // Programa uma atualização do estado do fluxo quando a mensagem estiver pronta para ser processada
        const scheduledTime = now + cumulativeDelay;
        setTimeout(() => {
          this.updateFlowMessageStatus(options.flowId!, phoneNumber, i, messages.length);
        }, cumulativeDelay);
      }
    }
    
    log(`[MessageQueueManager] Sequência de ${messages.length} mensagens adicionada à fila para ${phoneNumber}`, 'message-queue');
    
    return messageIds;
  }
  
  /**
   * Atualiza o status de uma mensagem de fluxo no serviço de monitoramento
   */
  private updateFlowMessageStatus(
    flowId: string, 
    phoneNumber: string, 
    messageIndex: number, 
    totalMessages: number
  ): void {
    // Busca todos os fluxos ativos para este destinatário
    const queueStatus = flowQueueService.getQueueStatus();
    const flowItem = queueStatus.queuedFlows.find(
      f => f.flowId === flowId && 
           f.recipientNumber === phoneNumber &&
           (f.status === 'pending' || f.status === 'sending')
    );
    
    if (flowItem) {
      // Se é a primeira mensagem, atualiza o status para "sending"
      if (messageIndex === 0) {
        flowQueueService.updateFlowStatus(flowItem.id, 'sending', messageIndex);
        log(`[MessageQueueManager] Iniciando envio do fluxo ${flowItem.flowName} para ${phoneNumber}`, 'message-queue');
      } 
      // Se é a última mensagem, atualiza o status para "sent" após envio
      else if (messageIndex === totalMessages - 1) {
        // Programa uma atualização para "sent" após 2 segundos para dar tempo de processar a mensagem
        setTimeout(() => {
          flowQueueService.updateFlowStatus(flowItem.id, 'sent', messageIndex);
          log(`[MessageQueueManager] Fluxo ${flowItem.flowName} concluído para ${phoneNumber}`, 'message-queue');
        }, 2000);
      } 
      // Para mensagens intermediárias, apenas atualiza o índice
      else {
        flowQueueService.updateFlowStatus(flowItem.id, 'sending', messageIndex);
      }
    }
  }
  
  /**
   * Inicia o processamento da fila em intervalos regulares
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(
      () => this.processQueue(),
      this.DEFAULT_PROCESS_INTERVAL_MS
    );
    
    log('[MessageQueueManager] Processamento de fila iniciado', 'message-queue');
  }
  
  /**
   * Para o processamento da fila
   */
  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      log('[MessageQueueManager] Processamento de fila interrompido', 'message-queue');
    }
  }
  
  /**
   * Processa a fila de mensagens
   */
  private async processQueue(): Promise<void> {
    const now = Date.now();
    const messagesToProcess: QueuedMessage[] = [];
    
    // Identifica mensagens que estão prontas para serem processadas
    for (const [messageId, message] of this.messageQueue.entries()) {
      if (message.status === 'scheduled' && message.scheduledTime <= now) {
        messagesToProcess.push(message);
        
        // Atualiza status para processing na fila
        message.status = 'processing';
        this.messageQueue.set(messageId, message);
      }
    }
    
    // Processa as mensagens identificadas
    if (messagesToProcess.length > 0) {
      log(`[MessageQueueManager] Processando ${messagesToProcess.length} mensagens da fila`, 'message-queue');
      
      // Processa cada mensagem de forma assíncrona
      for (const message of messagesToProcess) {
        this.processMessage(message).catch(error => {
          log(`[MessageQueueManager] Erro ao processar mensagem ${message.id}: ${error}`, 'message-queue');
        });
      }
    }
  }
  
  /**
   * Processa uma mensagem específica da fila
   */
  private async processMessage(message: QueuedMessage): Promise<void> {
    try {
      log(`[MessageQueueManager] Processando mensagem para ${message.phoneNumber}`, 'message-queue');
      
      // Verifica o tipo de mensagem e executa o envio apropriado
      let response;
      
      if (message.mediaType) {
        // Envia mensagem de mídia
        switch (message.mediaType) {
          case 'image':
            response = await evolutionApi.sendImageMessage(
              message.instanceName, 
              message.phoneNumber, 
              message.mediaUrl!, 
              message.mediaCaption
            );
            break;
          case 'audio':
            response = await evolutionApi.sendAudioMessage(
              message.instanceName, 
              message.phoneNumber, 
              message.mediaUrl!
            );
            break;
          case 'video':
            response = await evolutionApi.sendVideoMessage(
              message.instanceName, 
              message.phoneNumber, 
              message.mediaUrl!, 
              message.mediaCaption
            );
            break;
          case 'document':
            response = await evolutionApi.sendDocumentMessage(
              message.instanceName, 
              message.phoneNumber, 
              message.mediaUrl!, 
              message.mediaFileName || 'documento'
            );
            break;
        }
      } else {
        // Envia mensagem de texto
        // Garantimos que o texto é enviado exatamente como foi digitado pelo usuário
        const textoExato = message.message.trim();
        log(`[MessageQueueManager] Enviando texto exato: "${textoExato}"`, 'message-queue');
        
        // Se tivermos o ID de um fluxo na fila, atualiza seu status
        if (message.queuedFlowId) {
          log(`[MessageQueueManager] Encontrado queuedFlowId: ${message.queuedFlowId}, atualizando status para 'sending'`, 'message-queue');
          flowQueueService.updateFlowStatus(message.queuedFlowId, 'sending');
        }
        
        response = await evolutionApi.sendMessage(
          message.instanceName, 
          message.phoneNumber, 
          textoExato // Garantimos que o texto original é preservado
        );
      }
      
      // Atualiza o status da mensagem na fila
      if (response.success) {
        message.status = 'completed';
        message.result = response;
        
        log(`[MessageQueueManager] Mensagem enviada com sucesso para ${message.phoneNumber}`, 'message-queue');
        
        // Se tivermos o ID de um fluxo na fila, atualiza seu status após completar
        if (message.queuedFlowId) {
          log(`[MessageQueueManager] Mensagem enviada com sucesso, atualizando queuedFlowId: ${message.queuedFlowId} para 'sent'`, 'message-queue');
          flowQueueService.updateFlowStatus(message.queuedFlowId, 'sent');
        }
        
        // Atualiza o status no histórico de mensagens, se aplicável
        if (message.messageHistoryId) {
          this.updateMessageHistoryStatus(message.messageHistoryId, 'sent', 
            `Resposta enviada com sucesso (${message.mediaType || 'texto'})`);
        }
      } else {
        // Tenta novamente se não atingiu o número máximo de tentativas
        message.retries++;
        
        if (message.retries < this.MAX_RETRIES) {
          message.status = 'scheduled';
          message.scheduledTime = Date.now() + 5000; // Tenta novamente em 5 segundos
          log(`[MessageQueueManager] Falha ao enviar mensagem, reagendando (tentativa ${message.retries}/${this.MAX_RETRIES})`, 'message-queue');
        } else {
          message.status = 'failed';
          message.error = response;
          log(`[MessageQueueManager] Falha ao enviar mensagem após ${this.MAX_RETRIES} tentativas`, 'message-queue');
          
          // Atualiza o status no histórico de mensagens
          if (message.messageHistoryId) {
            this.updateMessageHistoryStatus(message.messageHistoryId, 'error', 
              `Falha ao enviar: ${response.message || 'Erro desconhecido'}`);
          }
        }
      }
      
      // Atualiza a mensagem na fila
      this.messageQueue.set(message.id, message);
      
      // Remove da fila se concluída ou falhou definitivamente
      if (message.status === 'completed' || message.status === 'failed') {
        // Mantém na fila por um tempo para histórico recente, será removida depois
        setTimeout(() => {
          this.messageQueue.delete(message.id);
        }, 60000); // Remove após 1 minuto
      }
    } catch (error) {
      log(`[MessageQueueManager] Erro ao processar mensagem: ${error}`, 'message-queue');
      
      // Atualiza a mensagem na fila
      message.retries++;
      
      if (message.retries < this.MAX_RETRIES) {
        message.status = 'scheduled';
        message.scheduledTime = Date.now() + 5000; // Tenta novamente em 5 segundos
        this.messageQueue.set(message.id, message);
      } else {
        message.status = 'failed';
        message.error = error;
        this.messageQueue.set(message.id, message);
        
        // Se tivermos um ID de fluxo em fila, marca como falho
        if (message.queuedFlowId) {
          log(`[MessageQueueManager] Falha ao enviar mensagem, marcando queuedFlowId: ${message.queuedFlowId} como 'failed'`, 'message-queue');
          flowQueueService.updateFlowStatus(message.queuedFlowId, 'failed');
        }
        
        // Atualiza o status no histórico de mensagens
        if (message.messageHistoryId) {
          this.updateMessageHistoryStatus(message.messageHistoryId, 'error', 
            `Erro: ${error.message || 'Desconhecido'}`);
        }
        
        // Remove da fila após um tempo
        setTimeout(() => {
          this.messageQueue.delete(message.id);
        }, 60000); // Remove após 1 minuto
      }
    }
  }
  
  /**
   * Atualiza o status de uma mensagem no histórico de mensagens
   */
  private async updateMessageHistoryStatus(
    messageHistoryId: number, 
    status: string, 
    notes?: string
  ): Promise<void> {
    try {
      await storage.updateMessageHistoryStatus(messageHistoryId, status, notes);
    } catch (error) {
      log(`[MessageQueueManager] Erro ao atualizar status no histórico: ${error}`, 'message-queue');
    }
  }
  
  /**
   * Obtém estatísticas da fila
   */
  public getQueueStats(): {
    total: number,
    scheduled: number,
    processing: number,
    completed: number,
    failed: number
  } {
    let scheduled = 0, processing = 0, completed = 0, failed = 0;
    
    for (const message of this.messageQueue.values()) {
      switch (message.status) {
        case 'scheduled': scheduled++; break;
        case 'processing': processing++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
      }
    }
    
    return {
      total: this.messageQueue.size,
      scheduled,
      processing,
      completed,
      failed
    };
  }
  
  /**
   * Limpa todas as mensagens da fila
   */
  public clearQueue(): void {
    this.messageQueue.clear();
    log('[MessageQueueManager] Fila de mensagens limpa', 'message-queue');
  }
  
  /**
   * Obtém o estado atual da fila para monitoramento
   */
  public getQueueState(): QueuedMessage[] {
    return Array.from(this.messageQueue.values());
  }
}

// Exporta uma instância singleton do gerenciador de fila
export const messageQueueManager = new MessageQueueManager();