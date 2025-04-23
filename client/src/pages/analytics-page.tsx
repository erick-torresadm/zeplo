import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import MessageVolumeChart from "@/components/analytics/message-volume-chart";
import InstancesPerformanceChart from "@/components/analytics/instances-performance-chart";
import FlowsPerformanceChart from "@/components/analytics/flows-performance-chart";
import TopTriggersTable from "@/components/analytics/top-triggers-table";
import AnalyticsSummary from "@/components/analytics/analytics-summary";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>("7d");
  const [selectedInstance, setSelectedInstance] = useState<string>("all");

  const { data: instances = [], isLoading: isLoadingInstances } = useQuery<any[]>({
    queryKey: ["/api/instances"],
    enabled: !!user,
  });

  const periodOptions = [
    { value: "24h", label: "Últimas 24 horas" },
    { value: "7d", label: "Últimos 7 dias" },
    { value: "30d", label: "Últimos 30 dias" },
    { value: "90d", label: "Últimos 90 dias" },
    { value: "6m", label: "Últimos 6 meses" },
    { value: "1y", label: "Último ano" },
  ];

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Análise de desempenho das suas instâncias e fluxos de mensagens.
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {!isLoadingInstances &&
                instances?.map((instance: any) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo de métricas */}
      <AnalyticsSummary period={period} instanceId={selectedInstance} />

      {/* Gráficos e tabelas */}
      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages">Volume de Mensagens</TabsTrigger>
          <TabsTrigger value="instances">Performance das Instâncias</TabsTrigger>
          <TabsTrigger value="flows">Performance dos Fluxos</TabsTrigger>
          <TabsTrigger value="triggers">Palavras-chave Mais Acionadas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="messages" className="space-y-4">
          <MessageVolumeChart period={period} instanceId={selectedInstance} />
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <InstancesPerformanceChart period={period} />
        </TabsContent>

        <TabsContent value="flows" className="space-y-4">
          <FlowsPerformanceChart period={period} instanceId={selectedInstance} />
        </TabsContent>

        <TabsContent value="triggers" className="space-y-4">
          <TopTriggersTable period={period} instanceId={selectedInstance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}