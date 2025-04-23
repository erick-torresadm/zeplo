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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Smartphone } from "lucide-react";

interface InstancesPerformanceChartProps {
  period: string;
}

export default function InstancesPerformanceChart({ 
  period,
}: InstancesPerformanceChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/instances-performance", period],
    queryFn: () => 
      fetch(`/api/analytics/instances-performance?period=${period}`)
        .then(res => res.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance das Instâncias</CardTitle>
          <CardDescription>Comparação de desempenho entre instâncias</CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle>Performance das Instâncias</CardTitle>
          <CardDescription>Comparação de desempenho entre instâncias</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-80 text-muted-foreground">
          <Smartphone className="h-10 w-10 opacity-30" />
          <p className="mt-2">Nenhum dado disponível para o período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance das Instâncias</CardTitle>
        <CardDescription>Comparação de desempenho entre instâncias</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 10,
                right: 30,
                left: 10,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="instanceName" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => {
                  const labels = {
                    messageCount: ["Mensagens", "Mensagens"],
                    successRate: ["Taxa de Sucesso", "%"],
                    responseTime: ["Tempo de Resposta", "ms"]
                  };
                  const [label, unit] = labels[name as keyof typeof labels] || [name, ""];
                  return [`${value} ${unit}`, label];
                }}
              />
              <Legend />
              <Bar 
                dataKey="messageCount" 
                name="Mensagens" 
                fill="#8884d8" 
              />
              <Bar 
                dataKey="successRate" 
                name="Taxa de Sucesso" 
                fill="#82ca9d" 
              />
              <Bar 
                dataKey="responseTime" 
                name="Tempo de Resposta" 
                fill="#ffc658" 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}