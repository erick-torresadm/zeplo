/**
 * Serviço para gerenciar a fila de fluxos de mensagens ativos
 * 
 * Este serviço mantém um registro em tempo real das filas de fluxos 
 * que estão sendo enviados, mostrando para quem está enviando mensagens, 
 * quantidade de mensagens e tempo estimado.
 */

import { EventEmitter } from 'events';
import { QueuedFlowMessage, FlowQueueStatus } from '@shared/types/flow-queue';

class FlowQueueService extends EventEmitter {
  private queuedFlows: Map<string, QueuedFlowMessage> = new Map();
  private lastProcessingTime: number = Date.now();
  private messagesProcessedLastMinute: number = 0;
  private processingSpeedHistory: number[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    
    // Inicia a limpeza automática a cada minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredFlows();
      this.updateProcessingSpeed();
      this.updateTimeEstimates();
    }, 60000);
  }

  /**
   * Adiciona um novo fluxo à fila ou atualiza um existente
   */
  addOrUpdateFlow(flowData: Omit<QueuedFlowMessage, 'id' | 'createdAt' | 'lastUpdated'>): QueuedFlowMessage {
    const now = Date.now();
    const existingFlow = Array.from(this.queuedFlows.values()).find(
      flow => flow.flowId === flowData.flowId && 
              flow.recipientNumber === flowData.recipientNumber &&
              flow.status !== 'sent' && 
              flow.status !== 'failed'
    );
    
    if (existingFlow) {
      const updatedFlow: QueuedFlowMessage = {
        ...existingFlow,
        ...flowData,
        lastUpdated: now
      };
      
      this.queuedFlows.set(existingFlow.id, updatedFlow);
      this.emit('flow-updated', updatedFlow);
      return updatedFlow;
    } else {
      const newFlow: QueuedFlowMessage = {
        id: `flow-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        createdAt: now,
        lastUpdated: now,
        ...flowData
      };
      
      this.queuedFlows.set(newFlow.id, newFlow);
      this.emit('flow-added', newFlow);
      return newFlow;
    }
  }

  /**
   * Atualiza o estado de um fluxo específico
   */
  updateFlowStatus(id: string, status: QueuedFlowMessage['status'], messageIndex?: number): QueuedFlowMessage | null {
    const flow = this.queuedFlows.get(id);
    if (!flow) return null;
    
    const updatedFlow: QueuedFlowMessage = {
      ...flow,
      status,
      messageIndex: messageIndex !== undefined ? messageIndex : flow.messageIndex,
      lastUpdated: Date.now()
    };
    
    this.queuedFlows.set(id, updatedFlow);
    
    if (status === 'sent' || status === 'failed') {
      // Se concluído ou falho, incrementa o contador de mensagens processadas
      this.messagesProcessedLastMinute += 1;
    }
    
    this.emit('flow-updated', updatedFlow);
    return updatedFlow;
  }

  /**
   * Remove um fluxo da fila
   */
  removeFlow(id: string): boolean {
    const exists = this.queuedFlows.has(id);
    if (exists) {
      this.queuedFlows.delete(id);
      this.emit('flow-removed', id);
    }
    return exists;
  }

  /**
   * Obtém o status atual da fila de fluxos
   */
  getQueueStatus(): FlowQueueStatus {
    const queuedFlows = Array.from(this.queuedFlows.values());
    
    // Conta apenas os fluxos pendentes e enviando
    const activeFlows = queuedFlows.filter(
      flow => flow.status === 'pending' || flow.status === 'sending'
    );
    
    // Obtém todas as instâncias únicas em uso
    const instancesInUse = new Set(
      activeFlows.map(flow => flow.instanceId)
    );
    
    // Calcula o total de mensagens na fila
    const totalMessagesQueued = activeFlows.reduce(
      (total, flow) => total + (flow.totalMessages - flow.messageIndex),
      0
    );
    
    return {
      activeQueues: activeFlows.length,
      totalMessagesQueued,
      processingSpeed: this.getAverageProcessingSpeed(),
      instancesInUse: instancesInUse.size,
      queuedFlows: queuedFlows.sort((a, b) => {
        // Prioriza ativos primeiro
        if ((a.status === 'pending' || a.status === 'sending') && 
            (b.status !== 'pending' && b.status !== 'sending')) {
          return -1;
        }
        if ((b.status === 'pending' || b.status === 'sending') && 
            (a.status !== 'pending' && a.status !== 'sending')) {
          return 1;
        }
        // Depois por última atualização (mais recente primeiro)
        return b.lastUpdated - a.lastUpdated;
      })
    };
  }

  /**
   * Atualiza estimativas de tempo para todas as mensagens na fila
   */
  updateTimeEstimates(): void {
    const processingSpeed = this.getAverageProcessingSpeed();
    if (processingSpeed <= 0) return; // Evita divisão por zero
    
    // Mensagens por segundo
    const messagesPerSecond = processingSpeed / 60;
    
    // Atualiza as estimativas para todos os fluxos ativos
    const activeFlows = Array.from(this.queuedFlows.entries())
      .filter(([_, flow]) => flow.status === 'pending' || flow.status === 'sending');
    
    // Rastreia o tempo estimado cumulativo
    let cumulativeTimeSeconds = 0;
    
    for (const [id, flow] of activeFlows) {
      // Mensagens restantes para este fluxo
      const remainingMessages = flow.totalMessages - flow.messageIndex;
      
      // Tempo estimado para este fluxo (em segundos)
      const flowTimeSeconds = cumulativeTimeSeconds + (remainingMessages / messagesPerSecond);
      
      // Atualiza o fluxo com nova estimativa
      const updatedFlow: QueuedFlowMessage = {
        ...flow,
        estimatedTimeRemaining: flowTimeSeconds,
        lastUpdated: Date.now()
      };
      
      this.queuedFlows.set(id, updatedFlow);
      
      // Adiciona tempo ao acumulado para o próximo fluxo
      cumulativeTimeSeconds += remainingMessages / messagesPerSecond;
    }
  }

  /**
   * Limpa fluxos concluídos ou expirados
   */
  private cleanupExpiredFlows(): void {
    const now = Date.now();
    const expirationTime = 1000 * 60 * 60; // 1 hora
    
    // Remover fluxos que foram concluídos (sent/failed) há mais de 1 hora
    for (const [id, flow] of this.queuedFlows.entries()) {
      if ((flow.status === 'sent' || flow.status === 'failed') && 
          (now - flow.lastUpdated > expirationTime)) {
        this.queuedFlows.delete(id);
        this.emit('flow-expired', id);
      }
    }
  }

  /**
   * Atualiza a velocidade de processamento
   */
  private updateProcessingSpeed(): void {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastProcessingTime) / (1000 * 60);
    
    if (elapsedMinutes >= 1) {
      // Calcula mensagens por minuto
      const messagesPerMinute = this.messagesProcessedLastMinute / elapsedMinutes;
      
      // Adiciona ao histórico
      this.processingSpeedHistory.push(messagesPerMinute);
      
      // Mantém apenas os últimos 10 registros
      if (this.processingSpeedHistory.length > 10) {
        this.processingSpeedHistory.shift();
      }
      
      // Reinicia contadores
      this.lastProcessingTime = now;
      this.messagesProcessedLastMinute = 0;
    }
  }

  /**
   * Obtém a velocidade média de processamento (mensagens por minuto)
   */
  private getAverageProcessingSpeed(): number {
    if (this.processingSpeedHistory.length === 0) {
      return 0;
    }
    
    const sum = this.processingSpeedHistory.reduce((total, speed) => total + speed, 0);
    return Math.round((sum / this.processingSpeedHistory.length) * 10) / 10; // 1 casa decimal
  }
}

export const flowQueueService = new FlowQueueService();