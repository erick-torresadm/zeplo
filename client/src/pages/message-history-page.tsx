import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import MessageHistoryTable from "@/components/message-history/message-history-table";

export default function MessageHistoryPage() {
  const { user } = useAuth();
  const [selectedInstance, setSelectedInstance] = useState<string>("all");

  const { data: instances = [], isLoading: isLoadingInstances } = useQuery<any[]>({
    queryKey: ["/api/instances"],
    enabled: !!user,
  });

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Mensagens</h1>
          <p className="text-muted-foreground">
            Visualize todas as mensagens recebidas e as palavras-chave que acionaram os fluxos.
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione a instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {!isLoadingInstances &&
                instances.map((instance: any) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mensagens Recebidas</CardTitle>
          <CardDescription>
            Lista de mensagens recebidas nas suas instâncias de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessageHistoryTable instanceId={selectedInstance === "all" ? undefined : selectedInstance} />
        </CardContent>
      </Card>
    </div>
  );
}