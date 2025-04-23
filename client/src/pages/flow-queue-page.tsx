import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, RefreshCcw, Clock, CheckCircle, XCircle, MessageCircle, Send, Play, ArrowLeft, Home } from "lucide-react";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import KeywordAlertCorner from "@/components/notifications/keyword-alert";
import { QueuedFlowMessage, FlowQueueStatus } from "@shared/types/flow-queue";
import { useWhatsAppContext } from "@/context/whatsapp-context";
import { TestFlowDialog } from "@/components/message-flows/test-flow-dialog";

// Função para formatar timestamp como data e hora
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Função para formatar tempo restante
function formatTimeRemaining(seconds?: number): string {
  if (seconds === undefined || seconds < 0) return 'Calculando...';
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Componente para renderizar uma mensagem de fluxo na fila
function QueuedFlowItem({ flow }: { flow: QueuedFlowMessage }) {
  let statusColor = '';
  let statusText = '';
  
  switch (flow.status) {
    case 'pending':
      statusColor = 'bg-yellow-400 hover:bg-yellow-500';
      statusText = 'Aguardando';
      break;
    case 'sending':
      statusColor = 'bg-blue-500 hover:bg-blue-600';
      statusText = 'Enviando';
      break;
    case 'sent':
      statusColor = 'bg-green-500 hover:bg-green-600';
      statusText = 'Enviado';
      break;
    case 'failed':
      statusColor = 'bg-red-500 hover:bg-red-600';
      statusText = 'Falhou';
      break;
    default:
      statusColor = 'bg-gray-500 hover:bg-gray-600';
      statusText = 'Desconhecido';
  }
  
  // Calcula o progresso como porcentagem
  const progress = (flow.messageIndex / flow.totalMessages) * 100;
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold flex items-center">
            <MessageCircle className="mr-2 h-5 w-5" />
            {flow.flowName}
          </CardTitle>
          <Badge className={statusColor}>{statusText}</Badge>
        </div>
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div>ID: {flow.id.substring(0, 8)}...</div>
          <div>
            {flow.status !== 'sent' && flow.status !== 'failed' && (
              <span className="flex items-center">
                <Clock className="mr-1 h-4 w-4" />
                {formatTimeRemaining(flow.estimatedTimeRemaining)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Instância: <span className="font-medium">{flow.instanceName}</span></span>
            <span>
              Progresso: <span className="font-medium">{flow.messageIndex}/{flow.totalMessages}</span>
            </span>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="mt-2 text-sm">
            <div>
              <span className="font-semibold">Destinatário:</span> {flow.recipientName || 'N/A'} ({flow.recipientNumber})
            </div>
            {flow.triggerKeyword && (
              <div>
                <span className="font-semibold">Palavra-chave:</span> {flow.triggerKeyword}
              </div>
            )}
            {flow.triggerMessage && (
              <div>
                <span className="font-semibold">Mensagem:</span> "{flow.triggerMessage.length > 30 
                  ? flow.triggerMessage.substring(0, 30) + '...' 
                  : flow.triggerMessage}"
              </div>
            )}
            <div>
              <span className="font-semibold">Agendado para:</span> {formatDateTime(flow.scheduledTime)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente principal da página
export default function FlowQueuePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('active');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Busca dados da fila de fluxos
  const { 
    data: queueStatus, 
    isLoading, 
    error, 
    refetch,
    isRefetching
  } = useQuery<FlowQueueStatus>({
    queryKey: ['/api/flow-queue/status'],
    refetchInterval: 3000, // Atualiza a cada 3 segundos para maior responsividade
  });
  
  // Separa fluxos ativos (pending, sending) de concluídos (sent, failed)
  const activeFlows = queueStatus?.queuedFlows.filter(
    flow => flow.status === 'pending' || flow.status === 'sending'
  ) || [];
  
  const completedFlows = queueStatus?.queuedFlows.filter(
    flow => flow.status === 'sent' || flow.status === 'failed'
  ) || [];
  
  // Manipulador para atualizar manualmente
  const handleRefresh = () => {
    refetch();
    toast({
      title: "Atualizando fila",
      description: "Buscando as informações mais recentes...",
    });
  };
  
  // Hook para acessar as instâncias conectadas
  const { instances } = useWhatsAppContext();
  
  // Mutação para sincronizar todas as instâncias
  const syncInstancesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/instances/sync-all");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Instâncias sincronizadas",
        description: data.message || "Todas as instâncias foram sincronizadas com sucesso",
      });
      // Atualiza o contexto global de instâncias
      queryClient.invalidateQueries({ queryKey: ['/api/instances'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar instâncias",
        description: error.message || "Ocorreu um erro ao sincronizar as instâncias",
        variant: "destructive"
      });
    }
  });

  // Manipulador para sincronizar instâncias
  const handleSyncInstances = () => {
    syncInstancesMutation.mutate();
  };
  
  // A mutação para criar fluxo de teste está agora no componente TestFlowDialog
  
  // Obtém a primeira instância conectada para criar um fluxo de teste
  const getFirstConnectedInstance = () => {
    // Considera instâncias com status 'connected' ou 'open' como conectadas
    const connectedInstances = instances.filter(
      inst => {
        const status = inst.status as string;
        return status === 'connected' || status === 'open';
      }
    );
    
    if (connectedInstances.length === 0) {
      toast({
        title: "Nenhuma instância conectada",
        description: "Conecte uma instância primeiro para criar um fluxo de teste",
        variant: "destructive"
      });
      return null;
    }
    
    // Retorna a primeira instância conectada
    return connectedInstances[0];
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 bg-slate-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight flex items-center">
                  <MessageCircle className="mr-2 h-6 w-6 text-primary" />
                  Fila de Fluxos
                </h1>
                <p className="text-muted-foreground">
                  Monitore os fluxos de mensagens que estão sendo enviados em tempo real
                </p>
                <div className="flex space-x-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    asChild
                  >
                    <a href="/">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar ao Menu Inicial
                    </a>
                  </Button>
                </div>
              </div>
              {/* Componente de dialog para criar fluxo de teste com número personalizado */}
              {(() => {
                const instance = getFirstConnectedInstance();
                if (!instance) {
                  return (
                    <Button 
                      onClick={() => {
                        toast({
                          title: "Nenhuma instância conectada",
                          description: "Conecte uma instância primeiro para criar um fluxo de teste",
                          variant: "destructive"
                        });
                      }} 
                      className="bg-primary text-white"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Criar Fluxo de Teste
                    </Button>
                  );
                }
                return (
                  <TestFlowDialog 
                    instanceId={instance.id} 
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/flow-queue/status'] });
                    }}
                  />
                );
              })()}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
              {/* Painel de estatísticas */}
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Estatísticas</CardTitle>
                    <CardDescription>Resumo da fila de mensagens</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : error ? (
                      <div className="text-center py-8 text-red-500">
                        Erro ao carregar estatísticas
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Filas ativas</div>
                          <div className="text-2xl font-bold">{queueStatus?.activeQueues || 0}</div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Mensagens na fila</div>
                          <div className="text-2xl font-bold">{queueStatus?.totalMessagesQueued || 0}</div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Velocidade (msg/min)</div>
                          <div className="text-2xl font-bold">{queueStatus?.processingSpeed || 0}</div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Instâncias em uso</div>
                          <div className="text-2xl font-bold">{queueStatus?.instancesInUse || 0}</div>
                        </div>
                        <div className="mt-6 space-y-2">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleRefresh}
                            disabled={isRefetching}
                          >
                            {isRefetching ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="mr-2 h-4 w-4" />
                            )}
                            Atualizar
                          </Button>
                          <Button
                            variant="default"
                            className="w-full bg-primary text-white"
                            onClick={handleSyncInstances}
                            disabled={syncInstancesMutation.isPending}
                          >
                            {syncInstancesMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="mr-2 h-4 w-4" />
                            )}
                            Sincronizar Instâncias
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Lista de fluxos */}
              <div className="md:col-span-3">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Fluxos de Mensagens</span>
                      <div className="flex items-center text-sm font-normal">
                        {isRefetching ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <span className="flex items-center">
                            <Clock className="mr-1 h-4 w-4" />
                            Atualizando a cada 3 segundos
                          </span>
                        )}
                      </div>
                    </CardTitle>
                    <Tabs
                      value={activeTab}
                      onValueChange={setActiveTab}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="active" className="relative">
                          Ativos
                          {activeFlows.length > 0 && (
                            <Badge className="ml-2 bg-primary">{activeFlows.length}</Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="completed">
                          Concluídos
                          {completedFlows.length > 0 && (
                            <Badge className="ml-2">{completedFlows.length}</Badge>
                          )}
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="active" className="mt-4">
                        {isLoading ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : activeFlows.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Send className="h-12 w-12 mb-4 opacity-20" />
                            <p>Não há fluxos ativos no momento.</p>
                            <p className="text-sm">Os fluxos aparecerão aqui quando estiverem em processamento.</p>
                          </div>
                        ) : (
                          <ScrollArea className="h-[500px] pr-4">
                            {activeFlows.map(flow => (
                              <QueuedFlowItem key={flow.id} flow={flow} />
                            ))}
                          </ScrollArea>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="completed" className="mt-4">
                        {isLoading ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : completedFlows.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>Não há fluxos concluídos para exibir.</p>
                            <p className="text-sm">Os fluxos concluídos aparecerão aqui após o processamento.</p>
                          </div>
                        ) : (
                          <ScrollArea className="h-[500px] pr-4">
                            {completedFlows.map(flow => (
                              <QueuedFlowItem key={flow.id} flow={flow} />
                            ))}
                          </ScrollArea>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
      <KeywordAlertCorner />
    </div>
  );
}