import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MessageSquareOff, SendIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Definição personalizada para variante de badges
type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

// Estendendo a interface para incluir a variante "success"
const badgeVariants = {
  success: "bg-green-500 hover:bg-green-600 text-white",
} as const;

// Interface para os objetos de fluxo e instância
interface FlowData {
  id?: string;
  name?: string;
  userId?: number;
  instanceId?: string;
  keyword?: string;
  status?: string;
}

interface InstanceData {
  id?: string;
  name?: string;
  userId?: number;
  status?: string;
}

// Este componente é automaticamente acionado quando uma palavra-chave é detectada
// Ele utiliza a mesma lógica do teste de fluxo, mas preenche automaticamente
export function AutoResponseComponent({ 
  instanceId,
  flowId,
  phoneNumber,
  keyword,
  onClose
}: { 
  instanceId: string;
  flowId: string;
  phoneNumber: string;
  keyword: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [responseData, setResponseData] = useState<any>(null);
  const { toast } = useToast();

  // Consulta para obter detalhes do fluxo
  const { data: flowData, isLoading: isLoadingFlow } = useQuery({
    queryKey: [`/api/message-flows/${flowId}`],
    enabled: !!flowId
  });

  // Consulta para obter detalhes da instância
  const { data: instanceData, isLoading: isLoadingInstance } = useQuery({
    queryKey: [`/api/instances/${instanceId}`],
    enabled: !!instanceId
  });
  
  // Garantir que flowData e instanceData são objetos do tipo correto para evitar erros
  const flowDataObject = flowData && typeof flowData === 'object' ? flowData as FlowData : {} as FlowData;
  const instanceDataObject = instanceData && typeof instanceData === 'object' ? instanceData as InstanceData : {} as InstanceData;

  // Mutação para ativar o fluxo
  const testFlowMutation = useMutation({
    mutationFn: async (data: { flowId: string; phoneNumber: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/message-flows/${data.flowId}/test`,
        { phoneNumber: data.phoneNumber }
      );
      return await response.json();
    },
    onSuccess: (data) => {
      setStatus('success');
      setResponseData(data);
      
      toast({
        title: "Fluxo acionado automaticamente com sucesso",
        description: `Resposta enviada para ${phoneNumber} usando a palavra-chave "${keyword}"`,
      });
    },
    onError: (error: Error) => {
      setStatus('error');
      
      toast({
        title: "Erro ao acionar fluxo automaticamente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Ativa o fluxo automaticamente assim que o componente é montado
  // Usando ref para garantir que só é executado uma vez
  const hasRunEffect = useRef(false);
  
  useEffect(() => {
    if (flowId && phoneNumber && !hasRunEffect.current) {
      hasRunEffect.current = true;
      setStatus('loading');
      
      // Formata o número de telefone - remove caracteres não numéricos
      let formattedNumber = phoneNumber.replace(/\D/g, "");
      
      // Adiciona o código do país se não estiver presente
      if (!formattedNumber.startsWith("55") && formattedNumber.length <= 11) {
        formattedNumber = `55${formattedNumber}`;
      }

      // Informativo para o usuário
      toast({
        title: "Acionando fluxo automaticamente",
        description: `Detectada palavra-chave "${keyword}" de ${formattedNumber}. Enviando resposta e notificando webhook externo...`,
      });

      // Inicia a mutação
      testFlowMutation.mutate({
        flowId: flowId,
        phoneNumber: formattedNumber,
      });
    }
  }, []);

  // Formatação do objeto de resposta para exibição
  const formatResponseData = () => {
    if (!responseData) return null;
    
    try {
      return JSON.stringify(responseData, null, 2);
    } catch (e) {
      return String(responseData);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Resposta Automática Ativada</CardTitle>
            <CardDescription>
              Palavra-chave detectada: "{keyword}"
            </CardDescription>
          </div>
          <Badge 
            className={status === 'success' ? badgeVariants.success : undefined}
            variant={status === 'error' ? "destructive" : 
                   status === 'loading' ? "secondary" : "outline"}
          >
            {status === 'success' ? "Enviado" : 
             status === 'error' ? "Erro" : 
             status === 'loading' ? "Enviando..." : "Preparando"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Informações da Ativação */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="min-w-24">Número:</Label>
            <span className="text-sm font-medium">{phoneNumber}</span>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="min-w-24">Fluxo:</Label>
            <span className="text-sm font-medium">
              {isLoadingFlow ? "Carregando..." : flowDataObject.name || "Não disponível"}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="min-w-24">Instância:</Label>
            <span className="text-sm font-medium">
              {isLoadingInstance ? "Carregando..." : instanceDataObject.name || "Não disponível"}
            </span>
          </div>
        </div>
        
        <Separator />
        
        {/* Status atual */}
        {status === 'loading' && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Enviando mensagens...</span>
          </div>
        )}
        
        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Falha ao enviar resposta</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao tentar acionar o fluxo de respostas.
            </AlertDescription>
          </Alert>
        )}
        
        {status === 'success' && (
          <div className="space-y-2">
            <div className="flex items-center text-green-600">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              <span className="font-medium">Resposta enviada com sucesso</span>
            </div>
            
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTitle className="text-blue-800 font-medium text-sm">Notificação enviada para webhook externo</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                Os dados foram enviados para https://editor.membropro.com.br/webhook-test/receber
              </AlertDescription>
            </Alert>
            
            {responseData?.conversation && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-1">Mensagens Enviadas:</h4>
                <div className="bg-slate-50 rounded-md p-3 text-xs">
                  <ul className="space-y-1">
                    {responseData.conversation.map((msg: any, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-slate-500 mr-2">•</span>
                        <span>
                          {msg.type === 'text' ? msg.content : 
                           `[${msg.type}] ${msg.caption || msg.fileName || ''}`}
                          {msg.delay > 0 && <span className="text-slate-400 text-xs ml-1">(atraso: {msg.delay}s)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            <div className="mt-2">
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700 py-1">
                  Mostrar resposta completa (JSON)
                </summary>
                <pre className="bg-slate-800 text-slate-200 p-2 rounded-md mt-1 overflow-auto max-h-48 text-[10px]">
                  {formatResponseData()}
                </pre>
              </details>
            </div>
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={status === 'loading'}
          >
            Fechar
          </Button>
          
          {status === 'error' && (
            <Button
              onClick={() => {
                if (flowId && phoneNumber) {
                  setStatus('loading');
                  
                  let formattedNumber = phoneNumber.replace(/\D/g, "");
                  if (!formattedNumber.startsWith("55") && formattedNumber.length <= 11) {
                    formattedNumber = `55${formattedNumber}`;
                  }
                  
                  testFlowMutation.mutate({
                    flowId,
                    phoneNumber: formattedNumber,
                  });
                }
              }}
            >
              Tentar Novamente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}