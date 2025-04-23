import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Webhook } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

interface TestWebhookCallbackDialogProps {
  instanceId: string;
  instanceName: string;
}

export function TestWebhookCallbackDialog({ instanceId, instanceName }: TestWebhookCallbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("olá");
  const [phoneNumber, setPhoneNumber] = useState("5511999999999");
  const [message, setMessage] = useState("Olá, como vai?");
  const [flowId, setFlowId] = useState("12345");
  const [flowName, setFlowName] = useState("Teste");
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const { toast } = useToast();

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        instanceId,
        keyword,
        phoneNumber,
        message,
        flowId,
        flowName
      });
      
      const result = await apiRequest(
        "GET", 
        `/api/test-webhook-callback?${params.toString()}` 
      );
      return await result.json();
    },
    onSuccess: (data) => {
      setWebhookResponse(data);
      toast({
        title: "✅ Teste realizado com sucesso",
        description: "O webhook foi chamado com sucesso. Verifique os resultados na caixa de resposta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro no teste",
        description: `Falha ao testar webhook: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    testWebhookMutation.mutate();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
        onClick={() => setOpen(true)}
      >
        <Webhook className="h-4 w-4 mr-1" />
        Testar Webhook
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Testar Callback do Webhook</DialogTitle>
            <DialogDescription>
              Envie uma solicitação para o endpoint de webhook interno para verificar o processamento de palavras-chave e fluxos.
              <div className="mt-2 text-xs bg-slate-100 p-2 rounded-md">
                <span className="font-semibold">Instância:</span> {instanceName} ({instanceId})
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label htmlFor="keyword">Palavra-chave</Label>
                <Input
                  id="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Ex: olá, promoção, etc."
                />
              </div>
              
              <div>
                <Label htmlFor="phoneNumber">Número de Telefone</Label>
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: 5511999999999"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="message">Mensagem</Label>
                <Input
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conteúdo da mensagem"
                />
              </div>
              
              <div>
                <Label htmlFor="flowId">ID do Fluxo</Label>
                <Input
                  id="flowId"
                  value={flowId}
                  onChange={(e) => setFlowId(e.target.value)}
                  placeholder="ID do fluxo"
                />
              </div>
              
              <div>
                <Label htmlFor="flowName">Nome do Fluxo</Label>
                <Input
                  id="flowName"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Nome do fluxo"
                />
              </div>
            </div>

            {webhookResponse && (
              <Alert className="mb-4">
                <AlertTitle>Resposta do Webhook</AlertTitle>
                <AlertDescription>
                  <Textarea
                    className="mt-2 h-32 font-mono text-xs"
                    readOnly
                    value={JSON.stringify(webhookResponse, null, 2)}
                  />
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button 
                type="submit" 
                disabled={testWebhookMutation.isPending}
              >
                {testWebhookMutation.isPending ? "Enviando..." : "Testar Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}