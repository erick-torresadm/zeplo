import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Terminal, Webhook } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface TestWebhookReceiveDialogProps {
  instanceId: string;
  instanceName: string;
}

export function TestWebhookReceiveDialog({
  instanceId,
  instanceName
}: TestWebhookReceiveDialogProps) {
  const [payloadJson, setPayloadJson] = useState(`{
  "instance": {
    "instanceName": "${instanceName}"
  },
  "messages": [
    {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "olá"
      },
      "messageTimestamp": ${Math.floor(Date.now() / 1000)}
    }
  ]
}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!payloadJson) {
      toast({
        title: "Payload obrigatório",
        description: "Por favor, digite um payload JSON para testar",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Valida se o JSON é válido
      const payload = JSON.parse(payloadJson);
      
      setIsSubmitting(true);
      
      const result = await apiRequest('POST', '/api/test-webhook-payload', {
        instanceId,
        payload
      });
      
      const data = await result.json();
      
      setTestResult(data);
      
      toast({
        title: data.success ? "Webhook testado" : "Erro no teste",
        description: data.message || "Teste de webhook executado",
        variant: data.success ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Erro ao testar webhook:", error);
      toast({
        title: "Erro no teste",
        description: error.message || "Não foi possível realizar o teste",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-2"
          onClick={() => setIsOpen(true)}
        >
          <Webhook className="mr-2 h-4 w-4" />
          Testar Webhook
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Testar Receptor de Webhook</DialogTitle>
          <DialogDescription>
            Teste o processamento de webhooks com formato personalizado para a instância <span className="font-bold">{instanceName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="payload">Payload JSON do Webhook</Label>
            <Textarea
              id="payload"
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              placeholder="Digite o payload JSON para testar"
              required
              className="w-full h-60 font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Digite o payload JSON completo que seria enviado pela Evolution API.
            </p>
          </div>
          
          {testResult && (
            <div className="mt-4 p-3 border rounded-md bg-muted">
              <h4 className="font-medium mb-2">Resultado do teste</h4>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Status:</span> {testResult.success ? 'Sucesso' : 'Erro'}</p>
                <p><span className="font-medium">Mensagem:</span> {testResult.message}</p>
                <p><span className="font-medium">Instância:</span> {testResult.instanceName}</p>
                {testResult.result && testResult.result.webhookTriggered && (
                  <p className="text-green-600 font-medium">Webhook foi acionado e mensagens processadas!</p>
                )}
                {testResult.extracted && (
                  <div className="mt-2">
                    <p className="font-medium">Mensagem extraída:</p>
                    <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto max-h-36">
                      {JSON.stringify(testResult.extracted, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processando..." : "Testar Webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}