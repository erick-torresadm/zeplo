import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Instance, MessageFlow } from "@shared/schema";
import { MessageFlowCard } from "@/components/whatsapp/message-flow-card";
import { AddMessageFlowDialog } from "@/components/whatsapp/add-message-flow-dialog";
import { TestMessageFlowDialog } from "@/components/whatsapp/test-message-flow-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, PlayCircle, MessageSquare, AlertCircle, RefreshCw, ZapOff, Zap } from "lucide-react";
import MessageHistoryTable from "@/components/message-history/message-history-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
  category: string;
}

export default function MessageFlowsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("fluxos");
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [selectedFlow, setSelectedFlow] = useState<MessageFlow | undefined>(undefined);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const { user } = useAuth();

  const { data: instances, isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ["/api/instances"],
  });

  const { data: flows, isLoading: isLoadingFlows } = useQuery<MessageFlow[]>({
    queryKey: ["/api/message-flows"],
  });
  
  // Selecionar automaticamente a primeira instância conectada
  useEffect(() => {
    if (instances && instances.length > 0 && !selectedInstance) {
      const connectedInstance = instances.find(i => i.status === 'connected');
      if (connectedInstance) {
        setSelectedInstance(connectedInstance.id);
      } else if (instances.length > 0) {
        setSelectedInstance(instances[0].id);
      }
    }
  }, [instances, selectedInstance]);
  
  // Buscar logs recentes
  useEffect(() => {
    if (activeTab === "logs") {
      const fetchLogs = async () => {
        try {
          setIsLoadingLogs(true);
          const response = await fetch('/api/debug/recent-logs?category=flow_activity');
          if (response.ok) {
            const data = await response.json();
            setLogs(data.map((log: any) => ({
              timestamp: new Date(log.timestamp).toLocaleString(),
              level: log.level || 'info',
              message: log.message,
              details: log.details,
              category: log.category
            })));
          }
        } catch (error) {
          console.error('Erro ao buscar logs:', error);
        } finally {
          setIsLoadingLogs(false);
        }
      };
      
      fetchLogs();
      
      // Atualizar logs a cada 2 segundos
      const intervalId = setInterval(fetchLogs, 2000);
      return () => clearInterval(intervalId);
    }
  }, [activeTab]);

  const handleAddFlow = () => {
    setDialogOpen(true);
  };
  
  const handleTestMessage = () => {
    if (flows && flows.length > 0) {
      // Seleciona o primeiro fluxo ativo como padrão
      const activeFlow = flows.find(flow => flow.status === 'active');
      setSelectedFlow(activeFlow || flows[0]);
      setTestDialogOpen(true);
    } else {
      // Sem fluxos disponíveis
      alert('Nenhum fluxo disponível para teste. Crie um fluxo primeiro.');
    }
  };

  // Create a map of instance IDs to names for easier lookup
  const instanceMap = new Map<string, string>();
  if (instances) {
    instances.forEach((instance) => {
      instanceMap.set(instance.id, instance.name);
    });
  }

  const isLoading = isLoadingInstances || isLoadingFlows;

  return (
    <div className="flex-1 min-h-screen">
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Fluxos de Mensagens</h1>
          
          <div className="flex space-x-3">
            <Button 
              onClick={handleTestMessage} 
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-50 text-black"
            >
              <PlayCircle className="h-5 w-5 mr-2" />
              <span className="text-black">Testar Mensagem</span>
            </Button>
            
            <Button onClick={handleAddFlow} className="bg-primary-600 hover:bg-primary-700 text-black">
              <Plus className="h-5 w-5 mr-2" />
              <span className="text-black font-medium">Novo Fluxo</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="fluxos">Fluxos Configurados</TabsTrigger>
              <TabsTrigger value="historico">Histórico de Mensagens</TabsTrigger>
              <TabsTrigger value="logs">Logs de Atividade</TabsTrigger>
            </TabsList>

            {activeTab === "historico" && instances && (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="fluxos">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : flows && flows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {flows.map((flow) => (
                  <MessageFlowCard 
                    key={flow.id} 
                    flow={flow} 
                    instanceName={instanceMap.get(flow.instanceId) || "Instância Desconhecida"}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Nenhum Fluxo de Mensagem Ainda</h3>
                <p className="text-slate-600 mb-6">
                  Crie seu primeiro fluxo de mensagens para começar a automatizar suas respostas do WhatsApp.
                </p>
                <Button onClick={handleAddFlow} className="bg-primary-600 hover:bg-primary-700 text-black">
                  <Plus className="h-5 w-5 mr-2" />
                  <span className="text-black font-medium">Criar Fluxo</span>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Histórico de Mensagens
                </CardTitle>
                <CardDescription>
                  Visualize as mensagens recebidas e os gatilhos acionados para a instância selecionada
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedInstance ? (
                  <MessageHistoryTable instanceId={selectedInstance} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <MessageSquare className="h-10 w-10 opacity-30" />
                    <p>Selecione uma instância para ver o histórico de mensagens</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5" />
                    Logs de Atividade de Fluxos
                  </CardTitle>
                  <CardDescription>
                    Monitoramento em tempo real das atividades dos fluxos de mensagens e detecção de palavras-chave
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setLogs([])}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Limpar Logs
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingLogs && logs.length === 0 ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : logs.length > 0 ? (
                  <ScrollArea className="h-[500px] rounded border p-4">
                    <div className="space-y-4">
                      {logs.map((log, index) => {
                        let icon;
                        let alertVariant: 'default' | 'destructive' | undefined;
                        
                        switch (log.level) {
                          case 'error':
                            icon = <ZapOff className="h-5 w-5 text-red-500" />;
                            alertVariant = 'destructive';
                            break;
                          case 'warning':
                            icon = <AlertCircle className="h-5 w-5 text-yellow-500" />;
                            break;
                          case 'success':
                            icon = <Zap className="h-5 w-5 text-green-500" />;
                            break;
                          default:
                            icon = <MessageSquare className="h-5 w-5 text-primary" />;
                        }
                        
                        return (
                          <Alert key={index} variant={alertVariant}>
                            <div className="flex items-start">
                              <div className="mr-2">{icon}</div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <AlertTitle className="text-sm font-medium">
                                    {log.message}
                                  </AlertTitle>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {log.timestamp}
                                  </Badge>
                                </div>
                                {log.details && (
                                  <AlertDescription className="mt-1 text-xs">
                                    <pre className="mt-2 whitespace-pre-wrap text-sm">
                                      {typeof log.details === 'object' 
                                        ? JSON.stringify(log.details, null, 2) 
                                        : log.details}
                                    </pre>
                                  </AlertDescription>
                                )}
                              </div>
                            </div>
                          </Alert>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <MessageSquare className="h-10 w-10 opacity-30" />
                    <p>Nenhum log de atividade de fluxo disponível no momento</p>
                    <p className="text-xs text-center max-w-md mt-2">
                      Os logs aparecerão aqui quando houver atividade nos fluxos de mensagens, 
                      como recebimento de mensagens ou detecção de palavras-chave
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddMessageFlowDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
      />
      
      <TestMessageFlowDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        selectedFlow={selectedFlow}
      />
    </div>
  );
}