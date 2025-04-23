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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, BookOpen } from "lucide-react";

interface FlowsPerformanceChartProps {
  period: string;
  instanceId: string;
}

export default function FlowsPerformanceChart({ 
  period,
  instanceId,
}: FlowsPerformanceChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/flows-performance", period, instanceId],
    queryFn: () => 
      fetch(`/api/analytics/flows-performance?period=${period}&instanceId=${instanceId}`)
        .then(res => res.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance dos Fluxos</CardTitle>
          <CardDescription>Eficácia dos fluxos de mensagens</CardDescription>
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
          <CardTitle>Performance dos Fluxos</CardTitle>
          <CardDescription>Eficácia dos fluxos de mensagens</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-80 text-muted-foreground">
          <BookOpen className="h-10 w-10 opacity-30" />
          <p className="mt-2">Nenhum dado disponível para o período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  // Processamento dos dados para o gráfico
  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance dos Fluxos</CardTitle>
        <CardDescription>Eficácia dos fluxos de mensagens</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 10,
                right: 30,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ 
                  value: "Taxa de Sucesso (%)", 
                  angle: -90, 
                  position: "insideLeft",
                  style: { textAnchor: "middle", fontSize: 12 }
                }}
              />
              <Tooltip 
                formatter={(value) => [`${value}%`, "Taxa de Sucesso"]}
              />
              <Legend />
              {data[0] && 
                Object.keys(data[0])
                  .filter(key => key !== "date")
                  .map((flowName, index) => (
                    <Line
                      key={flowName}
                      type="monotone"
                      dataKey={flowName}
                      name={flowName}
                      stroke={colors[index % colors.length]}
                      activeDot={{ r: 8 }}
                    />
                  ))
              }
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}