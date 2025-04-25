import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageFlow } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, SendIcon, Loader2, Bug, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TestMessageFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFlow?: MessageFlow;
}

export function TestMessageFlowDialog({ open, onOpenChange, selectedFlow }: TestMessageFlowDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  // Iniciar sempre com o modo debug desativado para garantir que todas as mensagens sejam enviadas
  const [useDebugMode, setUseDebugMode] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Teste de fluxo normal
  const testFlowMutation = useMutation({
    mutationFn: async (data: { flowId: string; phoneNumber: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/message-flows/${data.flowId}/test`,
        { 
          phoneNumber: data.phoneNumber,
          sendToWebhook: true // Ativa o envio para webhook externo durante o teste
        }
      );
      return await response.json();
    },
    onSuccess: (data) => {
      // Mostrar os detalhes completos da resposta, incluindo o campo conversation
      setDebugMessage(JSON.stringify(data, null, 2));
      
      toast({
        title: "Fluxo de mensagens testado com sucesso",
        description: `As mensagens foram enviadas para ${data.phoneNumber} e o webhook externo foi notificado`,
      });
      
      // Não fechamos mais o diálogo automaticamente para que o usuário possa ver o resultado
      setPhoneNumber("");
      setError("");
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Erro ao testar fluxo de mensagens",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Teste de fluxo com debug avançado
  const debugTestMutation = useMutation({
    mutationFn: async (data: { instanceId: string; phoneNumber: string; message: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/debug-message-send/${data.instanceId}`,
        { 
          phoneNumber: data.phoneNumber,
          message: data.message 
        }
      );
      return await response.json();
    },
    onSuccess: (data) => {
      setDebugMessage(JSON.stringify(data, null, 2));
      
      toast({
        title: "Mensagem de teste enviada com sucesso (modo debug)",
        description: "Confira os detalhes da resposta no formulário",
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Erro ao testar envio (modo debug)",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Pegar a primeira mensagem do fluxo para testes
  const getFirstFlowMessage = (): string => {
    if (!selectedFlow) return "";
    
    try {
      const messages = Array.isArray(selectedFlow.messages) 
        ? selectedFlow.messages 
        : (typeof selectedFlow.messages === 'string' 
          ? JSON.parse(selectedFlow.messages) 
          : []);
          
      if (messages.length > 0) {
        return messages[0].text || "Mensagem de teste";
      }
    } catch (err) {}
    
    return "Mensagem de teste";
  };

  const handleTest = () => {
    if (!phoneNumber) {
      setError("O número de telefone é obrigatório");
      return;
    }
    
    if (!selectedFlow) {
      setError("Nenhum fluxo selecionado para teste");
      return;
    }

    setError("");
    setDebugMessage(null);
    
    // Formata o número de telefone - remove caracteres não numéricos
    let formattedNumber = phoneNumber.replace(/\D/g, "");
    
    // Adiciona o código do país se não estiver presente
    if (!formattedNumber.startsWith("55") && formattedNumber.length <= 11) {
      formattedNumber = `55${formattedNumber}`;
    }

    // Informação para o usuário sobre o formato da resposta esperada
    toast({
      title: "Iniciando teste do fluxo de mensagens",
      description: "A resposta incluirá o campo 'conversation' com todas as mensagens configuradas e será enviada ao webhook externo.",
    });

    // Sempre usar o fluxo normal para garantir que todas as mensagens sejam enviadas
    testFlowMutation.mutate({
      flowId: selectedFlow.id,
      phoneNumber: formattedNumber,
    });
  };

  // Se não tiver um fluxo selecionado, não exibe o conteúdo do diálogo
  if (!selectedFlow) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Testar fluxo de mensagens</DialogTitle>
            <DialogDescription>
              Nenhum fluxo de mensagens selecionado para teste.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Testar fluxo de mensagens</DialogTitle>
          <DialogDescription>
            Digite o número de telefone para onde enviar o fluxo "{selectedFlow.name}".
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="bg-slate-50 p-3 rounded-md mb-1">
            <h3 className="text-sm font-medium mb-1">Informações do Fluxo</h3>
            <div className="text-xs text-slate-600">
              <p>
                <span className="font-medium">Palavra-chave:</span> {selectedFlow.keyword}
              </p>
              <p>
                <span className="font-medium">Tipo de gatilho:</span> {
                  selectedFlow.triggerType === "exact_match" ? "Correspondência exata" :
                  selectedFlow.triggerType === "contains" ? "Contém palavra/frase" :
                  selectedFlow.triggerType === "all_messages" ? "Todas as mensagens" : "Padrão"
                }
              </p>
              {selectedFlow.activationDelay > 0 && (
                <p>
                  <span className="font-medium">Atraso na ativação:</span> {selectedFlow.activationDelay}s
                </p>
              )}
              <p>
                <span className="font-medium">Total de mensagens:</span> {
                  Array.isArray(selectedFlow.messages) 
                    ? selectedFlow.messages.length 
                    : (typeof selectedFlow.messages === 'string' 
                      ? JSON.parse(selectedFlow.messages).length 
                      : 0)
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Telefone
            </Label>
            <Input
              id="phone"
              type="text"
              placeholder="Ex: 5511912345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="col-span-3"
            />
          </div>
          
          <div className="text-xs text-slate-500 col-start-2 col-span-3 mb-2">
            <p>O número deve estar no formato internacional com código do país.</p>
            <p>Exemplo: 5511912345678 (Brasil)</p>
          </div>
          
          {/* Removemos o seletor de modo debug para evitar problemas */}
          
          {debugMessage && (
            <div className="col-span-4 mt-2">
              <div className="mb-2">
                <h3 className="text-sm font-medium">Resposta do Fluxo (JSON)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Esta é a resposta completa do fluxo, incluindo o campo "conversation" que contém todas as mensagens.
                </p>
              </div>
              <div className="bg-slate-800 p-3 rounded text-xs text-white font-mono overflow-auto max-h-[300px]">
                <pre>{debugMessage}</pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={testFlowMutation.isPending}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleTest}
            disabled={
              (testFlowMutation.isPending || debugTestMutation.isPending) || 
              !phoneNumber
            }
            variant={useDebugMode ? "destructive" : "default"}
          >
            {testFlowMutation.isPending || debugTestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : useDebugMode ? (
              <>
                <Bug className="mr-2 h-4 w-4" />
                Testar (Debug)
              </>
            ) : (
              <>
                <SendIcon className="mr-2 h-4 w-4" />
                Testar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}