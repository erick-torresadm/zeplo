import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Instance } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { 
  Smartphone, 
  Zap, 
  Settings, 
  Trash2,
  X,
  RefreshCcw,
  MessageCircle,
  MessageSquare,
  Webhook
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { TestKeywordWebhookDialog } from "@/components/whatsapp/test-keyword-webhook-dialog";
import { AutoChatResponseDialog } from "@/components/whatsapp/auto-chat-response-dialog";
import { TestWebhookCallbackDialog } from "@/components/whatsapp/test-webhook-callback-dialog";
import TestWebhookPayloadDialog from "@/components/whatsapp/test-webhook-payload-dialog";
import TestBrazilianTimestampDialog from "@/components/whatsapp/test-brazilian-timestamp-dialog";
import { TestDirectMessageProcessorDialog } from "./TestDirectMessageProcessorDialog";
import { TestWebhookReceiveDialog } from "./TestWebhookReceiveDialog";
import TestAutoResponderDialog from "@/components/TestAutoResponderDialog";

interface InstanceCardProps {
  instance: Instance;
  onQrCodeRequest: (instance: Instance) => void;
}

export function InstanceCard({ instance, onQrCodeRequest }: InstanceCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [autoResponderDialogOpen, setAutoResponderDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", `/api/instances/${id}/status`, { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
      
      // Definir variantes e mensagens baseadas no status que foi alterado
      let variant = "default";
      let icon = "🔄";
      
      if (variables.status === "connected") {
        variant = "default";
        icon = "✅";
      } else if (variables.status === "connecting") {
        variant = "warning";
        icon = "⏳";
      } else if (variables.status === "disconnected") {
        variant = "destructive";
        icon = "❌";
      }
      
      toast({
        title: `${icon} Status alterado`,
        description: `A instância "${instance.name}" foi ${variables.status === "connected" ? "conectada" : variables.status === "connecting" ? "colocada em conexão" : "desconectada"}.`,
        variant: variant as any,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const refreshStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/instances/${id}/connection-state`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to refresh connection state');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
      
      // Definir variantes e mensagens baseadas no status
      let variant = "default";
      let icon = "🔄";
      
      if (data.status === "connected") {
        variant = "default";
        icon = "✅";
      } else if (data.status === "connecting") {
        variant = "warning";
        icon = "⏳";
      } else if (data.status === "disconnected") {
        variant = "destructive";
        icon = "❌";
      }
      
      toast({
        title: `${icon} Status atualizado`,
        description: `A instância "${instance.name}" agora está ${data.status === "connected" ? "conectada" : data.status === "connecting" ? "conectando" : "desconectada"}.`,
        variant: variant as any,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/instances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
      toast({
        title: "🗑️ Instância excluída",
        description: `A instância "${instance.name}" foi removida com sucesso.`,
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteInstanceMutation.mutate(instance.id);
  };

  const handleDisconnect = () => {
    updateStatusMutation.mutate({ id: instance.id, status: "disconnected" });
  };

  const handleConnect = () => {
    onQrCodeRequest(instance);
  };
  
  const handleRefreshStatus = () => {
    refreshStatusMutation.mutate(instance.id);
  };

  const formattedDate = instance.lastConnection 
    ? new Date(instance.lastConnection).toLocaleString() 
    : "Nunca";

  return (
    <>
      <Card className="card-hover rounded-xl">
        <CardContent className="p-0">
          <div className="p-5 border-b border-slate-100">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-primary-50 to-green-100 rounded-xl shadow-sm flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-slate-800">{instance.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">ID: {instance.id.slice(0, 12)}</p>
                </div>
              </div>
              <div>
                {instance.status === "connected" ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 shadow-sm">
                    <span className="w-2 h-2 rounded-full mr-1.5 bg-green-500 animate-pulse"></span>
                    Conectado
                  </span>
                ) : instance.status === "connecting" ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                    <span className="w-2 h-2 rounded-full mr-1.5 bg-amber-500 animate-pulse"></span>
                    Conectando...
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 shadow-sm">
                    <span className="w-2 h-2 rounded-full mr-1.5 bg-red-500"></span>
                    Desconectado
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">
                  Última Conexão:
                </p>
                <p className="text-sm font-medium mt-1">
                  {formattedDate}
                </p>
              </div>
              
              <div className="flex space-x-1.5">
                <TooltipProvider>
                  {instance.status !== "connected" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-green-300 bg-green-50 hover:bg-green-100 text-green-700"
                          onClick={handleConnect}
                          disabled={updateStatusMutation.isPending}
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          Conectar
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Escanear QR Code para Conectar</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                          onClick={handleDisconnect}
                          disabled={updateStatusMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Desconectar
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Encerrar Conexão</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700"
                        onClick={handleRefreshStatus}
                        disabled={refreshStatusMutation.isPending}
                      >
                        <RefreshCcw className={`h-4 w-4 ${refreshStatusMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Atualizar Status</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="border-slate-300 bg-slate-50 hover:bg-slate-100"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={deleteInstanceMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-slate-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Excluir Instância</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá permanentemente a instância de WhatsApp "{instance.name}" e todos os seus fluxos de mensagens associados.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TestAutoResponderDialog
        open={autoResponderDialogOpen} 
        onOpenChange={setAutoResponderDialogOpen}
        instanceId={instance.id}
        instanceName={instance.name}
      />
    </>
  );
}
