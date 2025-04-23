import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Loader2, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Flow {
  id: string;
  name: string;
  keyword: string;
  messagesCount: number;
}

interface InstanceFlowsResponse {
  success: boolean;
  instanceId: string;
  instanceName: string;
  flows: Flow[];
}

interface TestFlowDialogProps {
  instanceId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function TestFlowDialog({ instanceId, trigger, onSuccess }: TestFlowDialogProps) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("5511");
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const { toast } = useToast();

  // Buscar fluxos disponíveis para a instância
  const { 
    data: flowsData, 
    isLoading: isLoadingFlows, 
    error: flowsError,
    refetch: refetchFlows,
    isError: isFlowsError
  } = useQuery<InstanceFlowsResponse>({
    queryKey: ['/api/instance-flows', instanceId],
    queryFn: async () => {
      if (!instanceId) throw new Error("ID da instância não fornecido");
      
      const response = await apiRequest("GET", `/api/instance-flows/${instanceId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Erro ao carregar fluxos");
      }
      return response.json();
    },
    enabled: open && !!instanceId,
    retry: 1,
    staleTime: 10000 // 10 segundos
  });

  // Resetar o fluxo selecionado quando a lista de fluxos mudar
  useEffect(() => {
    if (flowsData?.flows?.length) {
      // Selecionar automaticamente o primeiro fluxo quando carregado
      setSelectedFlowId(flowsData.flows[0].id);
    } else {
      setSelectedFlowId("");
    }
  }, [flowsData]);

  const testFlowMutation = useMutation({
    mutationFn: async (data: { instanceId: string, phoneNumber: string, flowId?: string }) => {
      const response = await apiRequest("POST", "/api/test-flow", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao criar fluxo de teste");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Fluxo de teste criado",
        description: `O fluxo "${data.flowName}" foi adicionado à fila para o número ${data.phoneNumber}`,
      });
      // Atualiza a lista de fluxos
      queryClient.invalidateQueries({ queryKey: ['/api/flow-queue/status'] });
      setOpen(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar fluxo de teste",
        description: error.message || "Ocorreu um erro ao criar o fluxo de teste",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Número de telefone inválido",
        description: "Por favor, insira um número de telefone válido com DDD.",
        variant: "destructive"
      });
      return;
    }
    
    testFlowMutation.mutate({
      instanceId,
      phoneNumber,
      flowId: selectedFlowId || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary text-white">
            <Play className="mr-2 h-4 w-4" />
            Criar Fluxo de Teste
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Criar Fluxo de Teste</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Configure um fluxo de teste com mensagens predefinidas para enviar a um número de sua escolha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="grid gap-6 py-4">
            <div className="grid sm:grid-cols-4 grid-cols-1 items-center gap-4">
              <Label htmlFor="flowSelect" className="sm:text-right text-left font-medium text-base">
                Fluxo
              </Label>
              <div className="sm:col-span-3 col-span-1">
                {isLoadingFlows ? (
                  <div className="flex items-center space-x-2 p-2 border rounded-md h-10">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-base">Carregando fluxos...</span>
                  </div>
                ) : flowsData?.flows && flowsData.flows.length > 0 ? (
                  <Select
                    value={selectedFlowId}
                    onValueChange={setSelectedFlowId}
                  >
                    <SelectTrigger id="flowSelect" className="w-full h-10 text-base">
                      <SelectValue placeholder="Selecione um fluxo" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {flowsData.flows.map((flow) => (
                        <SelectItem key={flow.id} value={flow.id} className="text-base">
                          {flow.name} ({flow.messagesCount} msgs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <div className="text-base text-muted-foreground p-2 border rounded-md">
                      {isFlowsError 
                        ? "Erro ao carregar fluxos." 
                        : flowsData?.flows?.length === 0
                          ? "Não há fluxos ativos disponíveis."
                          : "Dados de fluxo indisponíveis."}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => refetchFlows()}
                      className="w-full"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Tentar novamente
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid sm:grid-cols-4 grid-cols-1 items-center gap-4">
              <Label htmlFor="phoneNumber" className="sm:text-right text-left font-medium text-base">
                Número
              </Label>
              <Input
                id="phoneNumber"
                placeholder="Ex: 5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="sm:col-span-3 col-span-1 h-10 text-base"
              />
            </div>
            <div className="col-span-full px-4">
              <p className="text-sm text-muted-foreground">
                O número deve incluir código do país e DDD, sem espaços ou caracteres especiais. 
                Exemplo: 5511999999999 (Brasil, DDD 11)
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end justify-center mt-4">
            <Button 
              type="submit" 
              className="bg-primary text-white h-10 px-5 text-base"
              size="lg"
              disabled={testFlowMutation.isPending || isLoadingFlows || !selectedFlowId}
            >
              {testFlowMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Criar Fluxo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}