import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, RefreshCcw, Server, MessageCircle, Activity, Search, 
  Filter, Filter as FilterIcon, AlertTriangle, Stethoscope, 
  Cpu, Activity as ActivityIcon, FolderTree
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

interface LogEntry {
  timestamp: string;
  message: string;
  category?: string;
  source?: string;
}

interface SystemLogFilter {
  showInstanceLogs: boolean;
  showWebhookLogs: boolean;
  showMessageLogs: boolean;
  showActivityLogs: boolean;
  showErrorLogs: boolean;
  instanceFilter: string;
  searchTerm: string;
}

export default function SystemLogsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<SystemLogFilter>({
    showInstanceLogs: true,
    showWebhookLogs: true,
    showMessageLogs: true,
    showActivityLogs: true,
    showErrorLogs: true,
    instanceFilter: "all",
    searchTerm: "",
  });
  const [activeTab, setActiveTab] = useState("logs");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [showDiagnosticOnly, setShowDiagnosticOnly] = useState(false);
  
  // Usar React Query para obter logs com refresh automático
  const {
    data: logs = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["/api/debug/recent-logs"],
    refetchInterval: autoRefresh ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  
  // Mutation para executar o diagnóstico do sistema
  const runDiagnosticMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/debug/run-diagnostic");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Diagnóstico iniciado",
        description: "O diagnóstico do sistema foi iniciado com sucesso. Os resultados aparecerão nos logs em breve.",
      });
      // Forçar atualização dos logs
      setTimeout(() => refetch(), 500);
      // Ativar a visualização dos logs
      setShowDiagnosticOnly(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar diagnóstico",
        description: `Não foi possível iniciar o diagnóstico: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para executar o diagnóstico do sistema de arquivos
  const runFilesystemDiagnosticMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/debug/run-filesystem-diagnostic");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Diagnóstico do sistema de arquivos iniciado",
        description: "O diagnóstico do sistema de arquivos foi iniciado com sucesso. Os resultados aparecerão nos logs em breve.",
      });
      // Forçar atualização dos logs
      setTimeout(() => refetch(), 500);
      // Ativar a visualização dos logs
      setShowDiagnosticOnly(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar diagnóstico do sistema de arquivos",
        description: `Não foi possível iniciar o diagnóstico: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Quando o usuário pressiona Enter no campo de busca
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter({...filter, searchTerm: searchInput});
  };
  
  // Filtrar logs com base nos critérios selecionados
  const filteredLogs = logs.filter((log: LogEntry) => {
    // Filtrar apenas logs de diagnóstico se a opção estiver ativada
    if (showDiagnosticOnly && 
        !log.message.toLowerCase().includes("diagnóstico") && 
        !log.message.toLowerCase().includes("diagnostic") &&
        !log.category?.toLowerCase().includes("diagnostic")) {
      return false;
    }
    
    // Filtrar pelo termo de busca
    if (filter.searchTerm && !log.message.toLowerCase().includes(filter.searchTerm.toLowerCase())) {
      return false;
    }
    
    // Filtrar por instância específica
    if (filter.instanceFilter !== "all") {
      if (filter.instanceFilter === "teste1" && !log.source?.includes("teste1") && !log.message.toLowerCase().includes("teste1")) {
        return false;
      }
    }
    
    // Filtrar por tipo de log
    if (log.category === "webhook" && !filter.showWebhookLogs) return false;
    if (log.category === "message" && !filter.showMessageLogs) return false;
    if (log.category === "activity" && !filter.showActivityLogs) return false;
    if (log.category === "instance" && !filter.showInstanceLogs) return false;
    if (log.category === "error" && !filter.showErrorLogs) return false;
    
    // Se não foi filtrado por nenhum critério acima, mostra o log
    return true;
  });
  
  // Extrair instâncias únicas de todos os logs
  const uniqueInstances = Array.from(
    new Set(
      logs
        .filter((log: LogEntry) => log.source || log.message.includes("teste1"))
        .map((log: LogEntry) => log.source || "teste1")
    )
  );
  
  // Utils para formatação e estilo
  const formatDate = (dateStr: string) => {
    try {
      // Formatação completa para a tabela
      return new Date(dateStr).toLocaleString("pt-BR", {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };
  
  const formatTime = (dateStr: string) => {
    try {
      // Formatação simples (apenas hora) para os logs em tempo real
      return new Date(dateStr).toLocaleTimeString("pt-BR", {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };
  
  const getBadgeForLog = (log: LogEntry) => {
    // Prioriza a categoria específica do log
    if (log.category) {
      switch (log.category) {
        case "webhook":
          return <Badge className="bg-blue-100 text-blue-800">WEBHOOK</Badge>;
        case "message":
          return <Badge className="bg-green-100 text-green-800">MENSAGEM</Badge>;
        case "activity":
          return <Badge className="bg-purple-100 text-purple-800">ATIVIDADE</Badge>;
        case "error":
          return <Badge variant="destructive">ERRO</Badge>;
        case "system":
          return <Badge className="bg-slate-100 text-slate-800">SISTEMA</Badge>;
        case "instance":
          if (log.source === "teste1") {
            return <Badge className="bg-amber-100 text-amber-800">TESTE1</Badge>;
          }
          return <Badge className="bg-slate-100 text-slate-800">INSTÂNCIA</Badge>;
      }
    }
    
    // Se não tiver categoria, analisa o conteúdo da mensagem
    if (log.message.includes("ERROR") || log.message.includes("erro") || log.message.includes("Erro")) 
      return <Badge variant="destructive">ERRO</Badge>;
    if (log.message.includes("WEBHOOK") || log.message.includes("webhook") || log.message.includes("recebida via webhook")) 
      return <Badge className="bg-blue-100 text-blue-800">WEBHOOK</Badge>;
    if (log.message.includes("MESSAGE") || log.message.includes("mensagem")) 
      return <Badge className="bg-green-100 text-green-800">MENSAGEM</Badge>;
    if (log.message.includes("ACTIVITY") || log.message.includes("atividade")) 
      return <Badge className="bg-purple-100 text-purple-800">ATIVIDADE</Badge>;
    if (log.message.includes("teste1")) 
      return <Badge className="bg-amber-100 text-amber-800">TESTE1</Badge>;
    
    return <Badge className="bg-slate-100 text-slate-800">INFO</Badge>;
  };
  
  // Identificar o tipo de log para agrupar visualmente
  const getLogType = (log: LogEntry) => {
    if (log.source === "teste1" || log.message.toLowerCase().includes("teste1")) return "teste1";
    if (log.category === "webhook" || log.message.toLowerCase().includes("webhook")) return "webhook";
    if (log.category === "message" || log.message.toLowerCase().includes("mensagem")) return "message";
    if (log.category === "activity" || log.message.toLowerCase().includes("atividade")) return "activity";
    if (log.category === "error" || log.message.toLowerCase().includes("erro")) return "error";
    return "other";
  };
  
  // Estilo condicional com base no tipo de log
  const getLogRowStyle = (log: LogEntry) => {
    const type = getLogType(log);
    switch (type) {
      case "teste1": return "border-l-4 border-amber-400";
      case "webhook": return "border-l-4 border-blue-400";
      case "message": return "border-l-4 border-green-400";
      case "activity": return "border-l-4 border-purple-400";
      case "error": return "border-l-4 border-red-400";
      default: return "";
    }
  };
  
  // Componente para exibição de logs com destaque para a instância teste1
  const LogRow = ({ log }: { log: LogEntry }) => (
    <div className={`py-2 px-3 mb-1 rounded bg-slate-800 ${getLogRowStyle(log)}`}>
      <div className="flex items-start">
        <span className="text-slate-400 mr-2 whitespace-nowrap">
          {formatTime(log.timestamp)}
        </span>
        <div>
          <div className="flex items-center mb-1">
            {getBadgeForLog(log)}
            {log.source === "teste1" && (
              <Badge className="bg-amber-100 text-amber-800 ml-2">teste1</Badge>
            )}
          </div>
          <span className="text-slate-100">{log.message}</span>
        </div>
      </div>
    </div>
  );
  
  // Se o error do query ocorrer, mostrar mensagem de erro
  if (error) {
    toast({
      title: "Erro ao carregar logs",
      description: "Não foi possível carregar os logs do sistema. Tente novamente mais tarde.",
      variant: "destructive",
    });
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Logs do Sistema</h1>
          <p className="text-slate-500 mt-1">
            Monitoramento em tempo real e histórico de eventos do sistema
          </p>
        </div>
        
        <div className="flex flex-wrap items-center mt-4 md:mt-0 gap-2">
          {/* Botão de Diagnóstico do Sistema */}
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => runDiagnosticMutation.mutate()}
            disabled={runDiagnosticMutation.isPending}
            className="flex items-center bg-purple-600 hover:bg-purple-700"
          >
            <Stethoscope className="h-4 w-4 mr-2" />
            {runDiagnosticMutation.isPending ? "Executando..." : "Diagnóstico Completo"}
          </Button>
          
          {/* Botão de Diagnóstico do Sistema de Arquivos */}
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => runFilesystemDiagnosticMutation.mutate()}
            disabled={runFilesystemDiagnosticMutation.isPending}
            className="flex items-center bg-teal-600 hover:bg-teal-700"
          >
            <FolderTree className="h-4 w-4 mr-2" />
            {runFilesystemDiagnosticMutation.isPending ? "Executando..." : "Diagnóstico de Arquivos"}
          </Button>
        
          {/* Botão de Atualização */}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          
          {/* Botão de Auto-Atualização */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center"
          >
            {autoRefresh ? "Auto-atualização Ativada" : "Auto-atualização Desativada"}
          </Button>
          
          {/* Toggle para exibir apenas logs de diagnóstico */}
          <Button
            variant={showDiagnosticOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDiagnosticOnly(!showDiagnosticOnly)}
            className={`flex items-center ${showDiagnosticOnly ? "bg-purple-600 hover:bg-purple-700" : ""}`}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {showDiagnosticOnly ? "Mostrando Diagnósticos" : "Todos os Logs"}
          </Button>
        </div>
      </div>
      
      {/* Barra de filtros e pesquisa */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <form onSubmit={handleSearchSubmit} className="flex w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Pesquisar nos logs..."
                className="pl-9 w-full"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" className="ml-2">Pesquisar</Button>
          </form>
        </div>
        
        <div className="flex gap-2">
          <Select 
            value={filter.instanceFilter} 
            onValueChange={(value) => setFilter({...filter, instanceFilter: value})}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              <SelectItem value="teste1">Instância teste1</SelectItem>
              {uniqueInstances.map((instance) => (
                instance !== "teste1" && (
                  <SelectItem key={instance} value={instance}>
                    Instância {instance}
                  </SelectItem>
                )
              ))}
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center">
                <FilterIcon className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Tipos de Log</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filter.showWebhookLogs}
                onCheckedChange={(checked) => setFilter({...filter, showWebhookLogs: checked})}
              >
                Webhooks
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.showInstanceLogs}
                onCheckedChange={(checked) => setFilter({...filter, showInstanceLogs: checked})}
              >
                Logs de Instâncias
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.showMessageLogs}
                onCheckedChange={(checked) => setFilter({...filter, showMessageLogs: checked})}
              >
                Mensagens
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.showActivityLogs}
                onCheckedChange={(checked) => setFilter({...filter, showActivityLogs: checked})}
              >
                Atividades
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.showErrorLogs}
                onCheckedChange={(checked) => setFilter({...filter, showErrorLogs: checked})}
              >
                Erros
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <Tabs defaultValue="logs" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="logs" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Logs em Tempo Real</span>
            <span className="inline md:hidden">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="instances" className="flex items-center">
            <Server className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Instância teste1</span>
            <span className="inline md:hidden">teste1</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Logs em Tempo Real</CardTitle>
              <CardDescription>
                Eventos e mensagens do sistema em ordem cronológica invertida (mais recentes primeiro)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full rounded-md border p-4 bg-slate-900 font-mono text-sm">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((log: LogEntry, index: number) => (
                        <LogRow key={index} log={log} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        {filter.searchTerm ? 
                          `Nenhum log encontrado para o termo "${filter.searchTerm}"` : 
                          "Nenhum log disponível com os filtros atuais"}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="instances" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Logs da Instância teste1</CardTitle>
              <CardDescription>
                Detalhes específicos da instância teste1 e suas mensagens recebidas via webhook
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full rounded-md border p-4 bg-slate-900 font-mono text-sm">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredLogs
                      .filter((log: LogEntry) => 
                        log.source === "teste1" || 
                        log.message.toLowerCase().includes("teste1"))
                      .length > 0 ? (
                        filteredLogs
                          .filter((log: LogEntry) => 
                            log.source === "teste1" || 
                            log.message.toLowerCase().includes("teste1"))
                          .map((log: LogEntry, index: number) => (
                            <LogRow key={index} log={log} />
                          ))
                      ) : (
                        <div className="text-center py-8 text-slate-400">
                          Nenhum log da instância teste1 disponível
                        </div>
                      )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* Tabela de estatísticas da instância teste1 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Estatísticas da Instância teste1</CardTitle>
              <CardDescription>
                Resumo das atividades e mensagens processadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-1">Webhooks</h3>
                      <p className="text-3xl font-bold text-blue-700">
                        {filteredLogs.filter((log: LogEntry) => 
                          (log.category === "webhook" || log.message.toLowerCase().includes("webhook")) &&
                          (log.source === "teste1" || log.message.toLowerCase().includes("teste1"))
                        ).length}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">Mensagens recebidas via webhook</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-1">Mensagens</h3>
                      <p className="text-3xl font-bold text-green-700">
                        {filteredLogs.filter((log: LogEntry) => 
                          (log.category === "message" || log.message.toLowerCase().includes("mensagem")) &&
                          (log.source === "teste1" || log.message.toLowerCase().includes("teste1"))
                        ).length}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">Mensagens processadas</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-1">Atividades</h3>
                      <p className="text-3xl font-bold text-amber-700">
                        {filteredLogs.filter((log: LogEntry) => 
                          (log.category === "activity" || log.message.toLowerCase().includes("atividade")) &&
                          (log.source === "teste1" || log.message.toLowerCase().includes("teste1"))
                        ).length}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">Ações e eventos registrados</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}