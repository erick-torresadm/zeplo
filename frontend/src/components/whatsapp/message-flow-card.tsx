import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageFlow } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { TestMessageFlowDialog } from "./test-message-flow-dialog";
import { EditMessageFlowDialog } from "./edit-message-flow-dialog";
import { TestFlowTriggerDialog } from "./TestFlowTriggerDialog";
import { 
  MessageSquare, 
  Copy, 
  Trash2,
  Edit,
  PlayCircle,
  Type,
  Image as ImageIcon,
  FileAudio,
  Video,
  FileText,
  Zap
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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface MessageFlowCardProps {
  flow: MessageFlow;
  instanceName: string;
}

export function MessageFlowCard({ flow, instanceName }: MessageFlowCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", `/api/message-flows/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-flows"] });
      toast({
        title: "Status do fluxo atualizado",
        description: `O fluxo de mensagens "${flow.name}" foi ${flow.status === "active" ? "desativado" : "ativado"}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status do fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFlowMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/message-flows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-flows"] });
      toast({
        title: "Fluxo excluído",
        description: `O fluxo de mensagens "${flow.name}" foi excluído.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateFlowMutation = useMutation({
    mutationFn: async (flowData: any) => {
      const response = await apiRequest("POST", "/api/message-flows", flowData);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-flows"] });
      toast({
        title: "Fluxo duplicado",
        description: `O fluxo de mensagens "${data.name}" foi criado com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao duplicar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteFlowMutation.mutate(flow.id);
  };
  
  const handleDuplicate = () => {
    // Criar um novo fluxo com base no atual
    const newFlow = {
      name: `${flow.name} (Cópia)`,
      keyword: flow.keyword,
      instanceId: flow.instanceId,
      messages: flow.messages,
      status: "inactive", // Começar como inativo por segurança
      triggerKeyword: flow.triggerKeyword || "",
      // Copiar os novos campos se existirem, ou usar valores padrão
      triggerType: flow.triggerType || "exact_match",
      activationDelay: flow.activationDelay || 0
    };
    
    duplicateFlowMutation.mutate(newFlow);
  };

  const handleStatusChange = (checked: boolean) => {
    updateStatusMutation.mutate({ 
      id: flow.id, 
      status: checked ? "active" : "inactive" 
    });
  };

  // Garante que messages seja sempre um array mesmo se vier como JSON string
  let messages = [];
  try {
    if (typeof flow.messages === 'string') {
      messages = JSON.parse(flow.messages);
    } else if (Array.isArray(flow.messages)) {
      messages = flow.messages;
    }
    
    // Verificação adicional para garantir que é um array
    if (!Array.isArray(messages)) {
      console.error('Mensagens em formato inválido:', flow.messages);
      messages = [];
    }
  } catch (error) {
    console.error('Erro ao processar mensagens:', error);
    messages = [];
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-slate-900">{flow.name}</h3>
                <div className="flex flex-wrap mt-1">
                  <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full">
                    {flow.keyword}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <span className="mr-2 text-sm text-slate-500">
                {flow.status === "active" ? "Ativo" : "Inativo"}
              </span>
              <Switch 
                checked={flow.status === "active"} 
                onCheckedChange={handleStatusChange}
                disabled={updateStatusMutation.isPending}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-slate-500">
              <span className="font-medium">Instância:</span> {instanceName}
            </p>
            <div className="flex flex-wrap gap-x-4 mt-1">
              <p className="text-sm text-slate-500">
                <span className="font-medium">Mensagens:</span> {messages.length}
              </p>
              <p className="text-sm text-slate-500">
                <span className="font-medium">Tipo de Gatilho:</span> {
                  flow.triggerType === "exact_match" ? "Correspondência exata" :
                  flow.triggerType === "contains" ? "Contém palavra/frase" :
                  flow.triggerType === "all_messages" ? "Todas as mensagens" : "Padrão"
                }
              </p>
              {flow.activationDelay > 0 && (
                <p className="text-sm text-slate-500">
                  <span className="font-medium">Atraso:</span> {flow.activationDelay}s
                </p>
              )}
            </div>
            
            {/* Prévia das mensagens */}
            {messages.length > 0 && (
              <div className="mt-3 bg-slate-50 p-2 rounded-md">
                <p className="text-xs text-slate-700 font-medium mb-1">
                  Prévia das mensagens:
                </p>
                <div className="max-h-24 overflow-y-auto">
                  {messages.map((msg, idx) => (
                    <div key={idx} className="text-xs text-slate-600 mb-1 border-l-2 border-primary-200 pl-2">
                      <span className="font-medium">#{idx+1}:</span> 
                      {msg.type === 'text' ? (
                        <span>
                          {msg.text 
                            ? (msg.text.length > 60 ? `${msg.text.substring(0, 60)}...` : msg.text) 
                            : 'Texto vazio'}
                        </span>
                      ) : msg.type === 'image' ? (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3 text-blue-500" />
                          <span>Imagem{msg.caption ? `: ${msg.caption.substring(0, 30)}${msg.caption.length > 30 ? '...' : ''}` : ''}</span>
                        </span>
                      ) : msg.type === 'audio' ? (
                        <span className="flex items-center gap-1">
                          <FileAudio className="h-3 w-3 text-purple-500" />
                          <span>Áudio{msg.ptt ? ' (Nota de voz)' : ''}</span>
                        </span>
                      ) : msg.type === 'video' ? (
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3 text-red-500" />
                          <span>Vídeo{msg.caption ? `: ${msg.caption.substring(0, 30)}${msg.caption.length > 30 ? '...' : ''}` : ''}</span>
                        </span>
                      ) : msg.type === 'document' ? (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-amber-500" />
                          <span>Documento: {msg.fileName || 'Sem nome'}</span>
                        </span>
                      ) : (
                        // Fallback para mensagens sem tipo ou com tipo desconhecido
                        <span>
                          {msg.text 
                            ? (msg.text.length > 60 ? `${msg.text.substring(0, 60)}...` : msg.text) 
                            : 'Conteúdo desconhecido'}
                        </span>
                      )}
                      {msg.delay > 0 && <span className="text-slate-400 ml-1">(Espera: {msg.delay}s)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <TestFlowTriggerDialog 
              flowId={flow.id} 
              flowName={flow.name} 
              keyword={flow.keyword || ""}
            />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setTestDialogOpen(true)}
                  >
                    <PlayCircle className="h-4 w-4 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Testar</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <Edit className="h-4 w-4 text-primary-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Editar</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleDuplicate}
                    disabled={duplicateFlowMutation.isPending}
                  >
                    <Copy className="h-4 w-4 text-slate-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Duplicar</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteFlowMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Excluir</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá permanentemente o fluxo de mensagens "{flow.name}".
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

      <TestMessageFlowDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        selectedFlow={flow}
      />

      <EditMessageFlowDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        selectedFlow={flow}
      />
    </>
  );
}
