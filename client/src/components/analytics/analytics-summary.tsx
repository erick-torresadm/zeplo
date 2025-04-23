import React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  ArrowUpCircle, 
  MessageSquare, 
  Smartphone, 
  BarChart3, 
  Activity,
  Loader2
} from "lucide-react";

interface AnalyticsSummaryProps {
  period: string;
  instanceId: string;
}

export default function AnalyticsSummary({ 
  period, 
  instanceId 
}: AnalyticsSummaryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/summary", period, instanceId],
    queryFn: () => 
      fetch(`/api/analytics/summary?period=${period}&instanceId=${instanceId}`)
        .then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="w-24 h-5 bg-muted rounded"/>
            </CardHeader>
            <CardContent>
              <div className="w-12 h-10 bg-muted rounded mb-2"/>
              <div className="w-32 h-4 bg-muted rounded"/>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const summary = data || {
    totalMessages: 0,
    activeInstances: 0,
    activeFlows: 0,
    successRate: 0
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Mensagens Processadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{summary.totalMessages}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total no período selecionado
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Instâncias Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{summary.activeInstances}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Conectadas e recebendo mensagens
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Fluxos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{summary.activeFlows}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Respondendo a palavras-chave
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Taxa de Sucesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{summary.successRate}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mensagens entregues com sucesso
          </p>
        </CardContent>
      </Card>
    </div>
  );
}