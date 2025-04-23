import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2 } from "lucide-react";

interface TopTriggersTableProps {
  period: string;
  instanceId: string;
}

export default function TopTriggersTable({
  period,
  instanceId,
}: TopTriggersTableProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/top-triggers", period, instanceId],
    queryFn: () =>
      fetch(`/api/analytics/top-triggers?period=${period}&instanceId=${instanceId}`)
        .then((res) => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p>Nenhum dado disponível para o período selecionado</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Sucesso</Badge>;
      case "pending":
        return <Badge className="bg-amber-500">Pendente</Badge>;
      case "failed":
        return <Badge className="bg-red-500">Falha</Badge>;
      default:
        return <Badge className="bg-blue-500">{status}</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeader>Palavra-chave</TableHeader>
            <TableHeader>Fluxo</TableHeader>
            <TableHeader className="text-right">Acionamentos</TableHeader>
            <TableHeader className="text-right">Status</TableHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((trigger: any, index: number) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {trigger.keyword}
              </TableCell>
              <TableCell>{trigger.flowName}</TableCell>
              <TableCell className="text-right">{trigger.count}</TableCell>
              <TableCell className="text-right">
                {getStatusBadge(trigger.status)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}