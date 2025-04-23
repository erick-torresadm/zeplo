import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  MessageSquare, 
  Loader2, 
  Clock, 
  User,
  Search,
  RefreshCw,
  DownloadCloud,
  AlertCircle,
  MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { addFlowAlert } from "@/components/notifications/keyword-alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AutoResponseComponent } from "@/components/whatsapp/auto-response-component";

interface MessageHistoryTableProps {
  instanceId?: string;
}

interface WhatsAppMessage {
  id: string;
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  pushName: string;
  messageType: string;
  message: any;
  messageTimestamp: number;
}

export default function MessageHistoryTable({
  instanceId
}: MessageHistoryTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoProcess, setAutoProcess] = useState(true);
  
  // Estado para controlar o componente de autoresposta
  const [autoResponseOpen, setAutoResponseOpen] = useState(false);
  const [autoResponseData, setAutoResponseData] = useState<{
    instanceId: string;
    flowId: string;
    phoneNumber: string;
    keyword: string;
  } | null>(null);
  
  // Primeiro, tenta buscar o histórico em nosso banco de dados local
  const { 
    data: localData, 
    isLoading: localLoading 
  } = useQuery({
    queryKey: ["/api/message-history", instanceId],
    queryFn: () =>
      fetch(`/api/message-history${instanceId ? `/instance/${instanceId}` : ''}`)
        .then((res) => res.json()),
  });
  
  // Carregar os fluxos de mensagem para conseguir detectar palavras-chave
  const { 
    data: flowsData,
    isLoading: flowsLoading 
  } = useQuery({
    queryKey: ["/api/message-flows"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/message-flows");
        if (!response.ok) {
          throw new Error("Erro ao buscar fluxos de mensagens");
        }
        return response.json();
      } catch (error) {
        console.error("Erro ao buscar fluxos:", error);
        return [];
      }
    },
  });
  
  // Se temos uma instância específica, busque também da Evolution API
  const {
    data: evolutionData,
    isLoading: evolutionLoading,
    refetch: refetchEvolutionData
  } = useQuery({
    queryKey: ["/api/instance/messages", instanceId, currentPage],
    queryFn: async () => {
      if (!instanceId) return null;
      
      try {
        const response = await fetch(
          `/api/instance/${instanceId}/messages?page=${currentPage}&limit=50`
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Erro ao buscar mensagens da Evolution API");
        }
        
        const data = await response.json();
        
        // Atualiza o total de páginas se disponível na resposta
        if (data.messages?.messages?.pages) {
          setTotalPages(data.messages.messages.pages);
        }
        
        return data;
      } catch (error: any) {
        console.error("Erro ao buscar mensagens da Evolution API:", error);
        toast({
          title: "Erro ao buscar mensagens",
          description: error.message,
          variant: "destructive"
        });
        return null;
      }
    },
    enabled: !!instanceId, // Só executa se tivermos um instanceId
  });
  
  // Função para atualizar dados da Evolution API (usando useCallback para poder usar no useEffect)
  const handleRefreshEvolutionData = useCallback(() => {
    if (instanceId) {
      refetchEvolutionData();
    }
  }, [instanceId, refetchEvolutionData]);

  // Função para processar mensagens (para ser usado no processamento automático)
  const processMessages = useCallback(async () => {
    if (!instanceId) return;
    
    try {
      const response = await fetch(`/api/instance/${instanceId}/process-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sendToWebhook: true // Adiciona flag para enviar ao webhook mesmo para mensagens do histórico
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.processedCount > 0) {
        toast({
          title: "Mensagens processadas automaticamente",
          description: `${data.processedCount} mensagens processadas de ${data.totalMessages}`,
        });
        
        // Atualiza os dados após o processamento
        refetchEvolutionData();
      }
    } catch (error) {
      console.error("Erro ao processar mensagens automaticamente:", error);
    }
  }, [instanceId, refetchEvolutionData, toast]);

  // Configuração do intervalo de atualização automática (500ms - meio segundo)
  useEffect(() => {
    if (!autoRefresh) return;
    
    // Mesmo sem instanceId específico, podemos atualizar o local data
    const intervalId = setInterval(() => {
      // Se tiver instanceId, atualiza os dados da Evolution API
      if (instanceId) {
        handleRefreshEvolutionData();
        
        // Se o processamento automático estiver ativado, processa as mensagens
        if (autoProcess) {
          processMessages();
        }
      }
      
      // Força um refetch dos dados locais para atualizar a tabela com novos dados
      // Esta parte é importante para manter todos os dados sincronizados
      queryClient.invalidateQueries({ queryKey: ["/api/message-history"] });
    }, 500); // Meio segundo para atualização mais rápida
    
    return () => clearInterval(intervalId);
  }, [autoRefresh, autoProcess, instanceId, handleRefreshEvolutionData, processMessages]);
  
  // Efeito para monitorar mensagens acionadas e exibir alertas
  useEffect(() => {
    if (!localData || !instanceId) return;
    
    // Pega dados de fluxos e instâncias para mostrar informações corretas nos alertas
    const flows = queryClient.getQueryData<any[]>(["/api/message-flows"]) || [];
    const instances = queryClient.getQueryData<any[]>(["/api/instances"]) || [];
    
    // Encontrar a instância atual para mostrar o nome correto
    const currentInstance = instances.find(inst => inst.id === instanceId);
    const instanceName = currentInstance?.name || "Instância";
    
    // Verifica se há mensagens que acionaram fluxos recentemente (últimos 30 segundos)
    const now = Date.now();
    const triggeredMessages = localData.filter((msg: any) => {
      if (msg.status !== "triggered" || !msg.triggeredKeyword || !msg.flowId) return false;
      
      // Só dispara alertas para mensagens recentes (criadas nos últimos 30 segundos)
      const msgTime = new Date(msg.timestamp).getTime();
      return (now - msgTime < 30000);
    });
    
    // Para cada mensagem que acionou um fluxo, exibe um alerta
    triggeredMessages.forEach((msg: any) => {
      // Encontra o fluxo correspondente para mostrar informações detalhadas
      const flow = flows.find(f => f.id === msg.flowId);
      const flowName = flow?.name || `Fluxo ID: ${msg.flowId.substring(0, 8)}`;
      
      // Usa localStorage para verificar se essa mensagem/fluxo já foi notificada
      const notificationKey = `notified-${msg.id}`;
      const alreadyNotified = localStorage.getItem(notificationKey);
      
      if (!alreadyNotified) {
        // Adiciona o alerta visual
        addFlowAlert(
          instanceName,
          flowName,
          msg.sender,
          msg.triggeredKeyword
        );
        
        // Marca como notificada para não exibir novamente
        localStorage.setItem(notificationKey, "true");
        
        // Limpa a entrada após 1 hora para liberar espaço
        setTimeout(() => {
          localStorage.removeItem(notificationKey);
        }, 60 * 60 * 1000);
      }
    });
  }, [localData, instanceId]);
  
  const isLoading = localLoading || (instanceId && evolutionLoading);

  // Função para ativar o componente de autoresposta para uma mensagem e fluxo específico
  const handleTriggerAutoResponse = useCallback((message: any) => {
    // Verifica se a mensagem tem uma palavra-chave e um fluxo correspondente
    if (!message || !message.flowId || !message.triggeredKeyword) {
      toast({
        title: "Não é possível ativar a resposta automática",
        description: "Esta mensagem não tem uma palavra-chave ou fluxo associado.",
        variant: "destructive"
      });
      return;
    }
    
    // Configurar dados para o componente de autoresposta
    setAutoResponseData({
      instanceId: message.instanceId || instanceId || '',
      flowId: message.flowId,
      phoneNumber: message.sender || message.phoneNumber || '',
      keyword: message.triggeredKeyword
    });
    
    // Abrir o diálogo
    setAutoResponseOpen(true);
  }, [instanceId, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Preparar dados para exibição, priorizando dados da Evolution API se disponíveis
  let displayData: any[] = [];
  let hasEvolutionData = false;
  
  // Se tivermos dados da Evolution API, transforme-os para o formato correto
  if (instanceId && evolutionData?.messages?.messages?.records) {
    hasEvolutionData = true;
    
    // Transformar os dados da Evolution API para o formato que esperamos
    displayData = evolutionData.messages.messages.records.map((msg: WhatsAppMessage) => {
      // Extrair o conteúdo da mensagem
      let messageContent = "";
      if (msg.message) {
        if (msg.message.conversation) {
          messageContent = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
          messageContent = msg.message.extendedTextMessage.text;
        } else if (typeof msg.message === 'object') {
          // Tenta extrair texto de qualquer propriedade que pareça ser um texto
          Object.entries(msg.message).forEach(([key, value]) => {
            if (
              typeof value === 'string' && 
              !messageContent && 
              key !== 'messageContextInfo' && 
              key !== 'deviceListMetadata'
            ) {
              messageContent = value;
            } else if (
              typeof value === 'object' && 
              value !== null && 
              'text' in value && 
              typeof value.text === 'string'
            ) {
              messageContent = value.text;
            }
          });
        }
      }
      
      // Formatar número de telefone
      const formattedSender = msg.key.remoteJid.split('@')[0];
      
      // Buscar se há alguma palavra-chave nos fluxos existentes que corresponde a esta mensagem
      // Esta lógica vai fazer a verificação no lado do cliente, mas já ajuda a visualizar
      let detectedKeyword = "";
      
      // Obtém todos os fluxos da cache do React Query
      const allFlows = queryClient.getQueryData<any[]>(["/api/message-flows"]);
      
      if (allFlows && messageContent) {
        const normalizedMessage = messageContent.toLowerCase().trim();
        
        // Tenta encontrar correspondência de palavras-chave nos fluxos
        for (const flow of allFlows) {
          if (flow.instanceId === instanceId) {
            const keyword = flow.keyword.toLowerCase().trim();
            
            // Tenta diversos modos de correspondência
            const isExactMatch = normalizedMessage === keyword;
            const isStartMatch = normalizedMessage.startsWith(keyword);
            const isContainedMatch = normalizedMessage.includes(keyword);
            const isWordMatch = normalizedMessage.split(/\s+/).includes(keyword);
            
            if (isExactMatch || isStartMatch || isContainedMatch || isWordMatch) {
              detectedKeyword = flow.keyword;
              break;
            }
          }
        }
      }
      
      return {
        // Usar formato similar ao nosso modelo interno
        id: msg.id || msg.key.id,
        timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
        instanceName: evolutionData.instance,
        sender: msg.pushName || formattedSender,
        phoneNumber: formattedSender,
        messageContent: messageContent || "(Conteúdo não textual)",
        triggeredKeyword: detectedKeyword, // Tentamos detectar localmente
        status: "evolution_api", // Marca como vindo diretamente da Evolution API
        remoteJid: msg.key.remoteJid,
        fromMe: msg.key.fromMe
      };
    });
  } else if (localData && localData.length > 0) {
    // Se não temos dados da Evolution API ou não temos um instanceId específico,
    // use os dados do nosso banco local
    displayData = localData;
  }

  if (displayData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p>Nenhuma mensagem encontrada</p>
        {instanceId && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshEvolutionData}
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> 
            Buscar mensagens da API
          </Button>
        )}
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "triggered":
        return <Badge className="bg-green-500">Acionado</Badge>;
      case "scheduled":
        return <Badge className="bg-purple-500 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Agendado
        </Badge>;
      case "no_match":
        return <Badge className="bg-amber-500">Sem correspondência</Badge>;
      case "error":
        return <Badge className="bg-red-500">Erro</Badge>;
      case "evolution_api":
        return <Badge className="bg-blue-500">API WhatsApp</Badge>;
      default:
        return <Badge className="bg-blue-500">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch (error) {
      return dateString;
    }
  };

  const highlightKeyword = (message: string, keyword: string) => {
    if (!keyword || !message) return message || "";
    
    // Tentar extrair o texto da mensagem caso seja JSON
    let messageText = message;
    try {
      // Verificar se a mensagem está em formato JSON
      if (message.startsWith('{') && message.includes('"text"')) {
        const messageObj = JSON.parse(message);
        if (messageObj.text) {
          messageText = messageObj.text;
        }
      }
    } catch (e) {
      // Se falhar o parse, continua com a mensagem original
      console.log("Não foi possível fazer parse JSON da mensagem");
    }
    
    // Usar regex para destacar a palavra-chave de forma case-insensitive
    try {
      // Escapa caracteres especiais de regex no keyword antes de usá-lo
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Regex para detectar a palavra-chave de forma mais flexível
      const regex = new RegExp(`(${escapedKeyword})`, 'gi');
      const parts = messageText.split(regex);
      
      return (
        <>
          {parts.map((part, i) => 
            regex.test(part) ? (
              <span key={i} className="bg-yellow-200 dark:bg-yellow-700 text-black dark:text-white px-1 rounded font-medium">
                {part}
              </span>
            ) : part
          )}
        </>
      );
    } catch (error) {
      console.error("Erro ao destacar palavra-chave:", error);
      // Em caso de erro na regex, apenas retorne a mensagem original
      return messageText;
    }
  };

  return (
    <div>
      {instanceId && (
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            {hasEvolutionData && evolutionData?.messages?.messages?.total && (
              <span>
                Mostrando {displayData.length} de {evolutionData.messages.messages.total} mensagens
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                Atualização automática
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-process"
                checked={autoProcess}
                onCheckedChange={setAutoProcess}
              />
              <Label htmlFor="auto-process" className="text-sm cursor-pointer">
                Processamento automático
              </Label>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshEvolutionData}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> 
                Atualizar
              </Button>
              
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  if (!instanceId) return;
                  toast({
                    title: "Processando mensagens",
                    description: "Buscando e processando mensagens não lidas..."
                  });
                  
                  fetch(`/api/instance/${instanceId}/process-messages`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      sendToWebhook: true // Adiciona flag para enviar ao webhook mesmo para mensagens do histórico
                    })
                  })
                  .then(res => res.json())
                  .then(data => {
                    if (data.success) {
                      toast({
                        title: "Mensagens processadas",
                        description: `Processadas ${data.processedCount} mensagens de ${data.totalMessages}`
                      });
                      // Atualiza os dados após o processamento
                      refetchEvolutionData();
                    } else {
                      toast({
                        title: "Erro ao processar mensagens",
                        description: data.message || "Ocorreu um erro ao processar as mensagens",
                        variant: "destructive"
                      });
                    }
                  })
                  .catch(err => {
                    toast({
                      title: "Erro ao processar mensagens",
                      description: err.message || "Ocorreu um erro ao processar as mensagens",
                      variant: "destructive"
                    });
                  });
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" /> 
                Processar Mensagens
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Data/Hora</TableHead>
              <TableHead className="w-[150px]">Instância</TableHead>
              <TableHead className="w-[150px]">Remetente</TableHead>
              <TableHead>Mensagem Recebida</TableHead>
              <TableHead className="w-[120px]">Palavra-chave</TableHead>
              <TableHead className="w-[100px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((message: any, index: number) => (
              <TableRow key={index} className={message.fromMe ? "bg-muted/30" : ""}>
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDateTime(message.timestamp)}
                  </div>
                </TableCell>
                <TableCell>
                  {message.instanceName}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {message.sender}
                    {message.fromMe && <Badge variant="outline" className="ml-1 text-xs">Enviada</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {highlightKeyword(message.messageContent, message.triggeredKeyword)}
                </TableCell>
                <TableCell>
                  {message.triggeredKeyword ? (
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {message.triggeredKeyword}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {message.flowId && message.triggeredKeyword && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleTriggerAutoResponse(message)}
                        title="Ativar resposta automática"
                      >
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    {getStatusBadge(message.status)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Paginação para dados da Evolution API */}
      {hasEvolutionData && totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Mostrar páginas próximas da atual
              let pageToShow;
              if (totalPages <= 5) {
                pageToShow = i + 1;
              } else if (currentPage <= 3) {
                pageToShow = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageToShow = totalPages - 4 + i;
              } else {
                pageToShow = currentPage - 2 + i;
              }
              
              return (
                <PaginationItem key={i}>
                  <PaginationLink
                    isActive={currentPage === pageToShow}
                    onClick={() => setCurrentPage(pageToShow)}
                    className="cursor-pointer"
                  >
                    {pageToShow}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      
      {/* Diálogo de Autoresposta */}
      <Dialog open={autoResponseOpen} onOpenChange={setAutoResponseOpen}>
        <DialogContent className="max-w-2xl">
          {autoResponseData && (
            <AutoResponseComponent 
              instanceId={autoResponseData.instanceId}
              flowId={autoResponseData.flowId}
              phoneNumber={autoResponseData.phoneNumber}
              keyword={autoResponseData.keyword}
              onClose={() => setAutoResponseOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}