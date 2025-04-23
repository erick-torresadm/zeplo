/**
 * Tipos para a fila de fluxos ativos
 */

export interface QueuedFlowMessage {
  id: string;
  flowId: string;
  flowName: string;
  instanceId: string;
  instanceName: string;
  recipientNumber: string;
  recipientName?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  scheduledTime: number; // timestamp
  messageIndex: number; // índice da mensagem atual no fluxo
  totalMessages: number; // total de mensagens no fluxo
  createdAt: number; // timestamp
  lastUpdated: number; // timestamp
  estimatedTimeRemaining?: number; // tempo estimado em segundos
  triggerKeyword?: string; // palavra-chave que acionou o fluxo
  triggerMessage?: string; // mensagem que acionou o fluxo
}

export interface FlowQueueStatus {
  activeQueues: number;
  totalMessagesQueued: number;
  processingSpeed: number; // mensagens por minuto
  instancesInUse: number;
  queuedFlows: QueuedFlowMessage[];
}