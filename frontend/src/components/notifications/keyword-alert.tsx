import React, { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, MessageSquare } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import useSound from 'use-sound';

// URL do som de notificação
const NOTIFICATION_SOUND = '/sounds/notification.mp3';

interface FlowAlert {
  id: string;
  timestamp: number;
  message: string;
  instanceName: string;
  flowName: string;
  phoneNumber: string;
  keyword: string;
}

// Armazenamento global para alertas de fluxos
let flowAlerts: FlowAlert[] = [];
const MAX_ALERTS = 5; // Limite de alertas armazenados

// Função para adicionar um novo alerta
export function addFlowAlert(
  instanceName: string,
  flowName: string,
  phoneNumber: string, 
  keyword: string,
  isScheduled?: boolean
) {
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Detecta se é um fluxo agendado pelo texto do nome
  const isScheduledFlow = isScheduled || flowName.includes('(agendado)');
  
  // Mensagem personalizada com base no status
  const message = isScheduledFlow
    ? `Fluxo "${flowName.replace(' (agendado)', '')}" agendado para ${phoneNumber}`
    : `Fluxo "${flowName}" acionado para ${phoneNumber}`;
  
  const newAlert: FlowAlert = {
    id,
    timestamp: Date.now(),
    message,
    instanceName,
    flowName,
    phoneNumber,
    keyword
  };
  
  // Adiciona o novo alerta ao início da lista
  flowAlerts = [newAlert, ...flowAlerts.slice(0, MAX_ALERTS - 1)];
  
  // Notifica o componente de que há novos alertas
  window.dispatchEvent(new CustomEvent('flow-alert', { detail: newAlert }));
  
  // Exibe um toast com a notificação apropriada
  toast({
    title: isScheduledFlow ? 'Fluxo de mensagens agendado' : 'Fluxo de mensagens acionado',
    description: `Palavra-chave "${keyword}" detectada. ${
      isScheduledFlow 
        ? `Fluxo "${flowName.replace(' (agendado)', '')}" será enviado em breve para ${phoneNumber}`
        : `Fluxo "${flowName}" enviado para ${phoneNumber}`
    }`,
    variant: 'default',
  });
  
  return id;
}

// Componente para exibir alertas de fluxos no canto da tela
export default function KeywordAlertCorner() {
  const [alerts, setAlerts] = useState<FlowAlert[]>([]);
  const [visible, setVisible] = useState(true);
  
  // Hook de som para notificação
  const [playNotification] = useSound(NOTIFICATION_SOUND, { 
    volume: 0.5,
    interrupt: true 
  });
  
  useEffect(() => {
    // Carrega os alertas existentes
    setAlerts(flowAlerts);
    
    // Configura o listener para novos alertas
    const handleNewAlert = (event: CustomEvent<FlowAlert>) => {
      setAlerts(current => [event.detail, ...current.slice(0, 2)]); // Mostra no máximo 3 alertas
      
      // Forçar visibilidade quando um alerta é adicionado
      setVisible(true);
      
      // Reproduz o som de notificação
      playNotification();
    };
    
    // Escuta eventos customizados
    window.addEventListener('flow-alert', handleNewAlert as EventListener);
    
    // Função para verificar mensagens disparadas
    const checkForTriggeredMessages = () => {
      // Busca todas as queries do histórico de mensagens
      const queries = queryClient.getQueryCache().findAll({
        predicate: query => 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].includes('/api/message-history')
      });
      
      // Se não houver queries, não há como verificar
      if (queries.length === 0) return;
      
      // Verifica cada query de histórico
      queries.forEach(query => {
        const data = query.state.data as any[];
        
        if (!data || !Array.isArray(data)) return;
        
        // Procura por mensagens com status "triggered" ou "scheduled"
        const triggeredMessages = data.filter(msg => 
          (msg.status === 'triggered' || msg.status === 'scheduled') && 
          msg.flowId && 
          msg.triggeredKeyword
        );
        
        if (triggeredMessages.length === 0) return;
        
        // Adiciona alertas para mensagens recentes que ainda não foram notificadas
        const now = Date.now();
        triggeredMessages.forEach(msg => {
          const msgTimestamp = new Date(msg.timestamp).getTime();
          const isRecent = now - msgTimestamp < 30000; // Menos de 30 segundos atrás (mais ágil)
          
          // Chave única para localStorage
          const storageKey = `alerted-${msg.id}-${msg.flowId}`;
          const alreadyAlerted = localStorage.getItem(storageKey) === 'true';
          
          if (isRecent && !alreadyAlerted) {
            // Registra este alerta no localStorage para não mostrar novamente
            localStorage.setItem(storageKey, 'true');
            
            // Personaliza o alerta com base no status
            const isScheduled = msg.status === 'scheduled';
            
            // Adiciona o alerta visual com uma mensagem personalizada
            addFlowAlert(
              msg.instanceName || 'Instância',
              (msg.flowName || `Fluxo: ${msg.flowId.substring(0, 8)}`), 
              msg.sender,
              msg.triggeredKeyword,
              isScheduled
            );
            
            // Limpa a entrada após 5 minutos para liberar espaço
            setTimeout(() => {
              localStorage.removeItem(storageKey);
            }, 5 * 60 * 1000);
          }
        });
      });
    };
    
    // Verifica imediatamente
    checkForTriggeredMessages();
    
    // Configura intervalo para verificar a cada 2 segundos (mais frequente que o servidor)
    const checkInterval = setInterval(checkForTriggeredMessages, 2000);
    
    // Configura a atualização automática quando o histórico de mensagens for atualizado
    const unsubscribe = queryClient.getQueryCache().subscribe(checkForTriggeredMessages);
    
    return () => {
      window.removeEventListener('flow-alert', handleNewAlert as EventListener);
      clearInterval(checkInterval);
      unsubscribe();
    };
  }, [playNotification]);
  
  // Não renderizar se não houver alertas
  if (alerts.length === 0 || !visible) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[320px]">
      {alerts.map((alert, index) => (
        <div 
          key={alert.id}
          className={`
            bg-green-50 border-l-4 border-green-500 border border-green-200 
            rounded-lg shadow-lg p-3 animate-pulse
            flex items-start gap-2 text-sm animate-in slide-in-from-right
            ${index === 0 ? 'duration-300' : 'duration-150'}
          `}
          style={{ 
            opacity: Math.max(0.7, 1 - index * 0.1),
            transform: `translateY(${index * -8}px) scale(${1 - index * 0.05})`,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        >
          <div className="p-1 rounded-full bg-green-100 flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-green-800 text-sm">{alert.message}</div>
            <div className="text-xs text-green-700 mt-1 flex items-center">
              <span className="font-bold bg-green-100 px-1.5 py-0.5 rounded mr-1">
                {alert.keyword}
              </span>
              <span className="text-gray-500 text-[10px] ml-auto">
                agora
              </span>
            </div>
          </div>
        </div>
      ))}
      
      <button 
        onClick={() => setVisible(false)}
        className="text-xs bg-white/80 hover:bg-white shadow px-2 py-1 rounded text-slate-600 hover:text-slate-800 self-end mt-1 transition-colors"
      >
        Fechar alertas
      </button>
    </div>
  );
}