import React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, MessageSquare } from "lucide-react";

interface MessageVolumeChartProps {
  period: string;
  instanceId: string;
}

// Função auxiliar para formatar datas
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  
  // Formatar de acordo com o período (supondo que diário/semanal/mensal)
  const options: Intl.DateTimeFormatOptions = { 
    day: '2-digit',
    month: 'short', 
  };
  
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
};

export default function MessageVolumeChart({ 
  period,
  instanceId,
}: MessageVolumeChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/message-volume", period, instanceId],
    queryFn: () => 
      fetch(`/api/analytics/message-volume?period=${period}&instanceId=${instanceId}`)
        .then(res => res.json()),
  });

  if (isLoading) {
    return (
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Volume de Mensagens</CardTitle>
          <CardDescription>Total de mensagens ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-80">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Se não houver dados, exibir mensagem
  if (!data || data.length === 0) {
    return (
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Volume de Mensagens</CardTitle>
          <CardDescription>Total de mensagens ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-80 text-muted-foreground">
          <MessageSquare className="h-10 w-10 opacity-30" />
          <p className="mt-2">Nenhum dado disponível para o período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  // Processar os dados para o gráfico
  const chartData = data.map((item: any) => ({
    ...item,
    date: formatDate(item.date)
  }));

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Volume de Mensagens</CardTitle>
        <CardDescription>Total de mensagens ao longo do tempo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(value) => [`${value} mensagens`, "Volume"]} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorVolume)"
                name="Volume"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}