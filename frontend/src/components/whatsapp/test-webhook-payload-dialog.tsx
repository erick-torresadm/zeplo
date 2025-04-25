import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { Loader2, MessageSquare } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface TestWebhookPayloadDialogProps {
  instanceId: string;
  instanceName: string;
}

const TestWebhookPayloadDialog: React.FC<TestWebhookPayloadDialogProps> = ({
  instanceId,
  instanceName,
}) => {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<string>(`{
  "event": "messages.upsert", 
  "data": {
    "messages": [
      {
        "key": {
          "remoteJid": "5511999999999@s.whatsapp.net",
          "fromMe": false,
          "id": "test-${Date.now()}"
        },
        "message": {
          "conversation": "chat"
        },
        "messageTimestamp": ${Math.floor(Date.now() / 1000)}
      }
    ]
  }
}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleTest = async () => {
    try {
      setLoading(true);
      
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (error) {
        toast({
          title: "Payload inválido",
          description: "O JSON está mal formatado. Verifique a sintaxe.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const response = await axios.post("/api/test-webhook-payload", {
        instanceId,
        payload: parsedPayload
      });

      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: "Teste enviado com sucesso",
          description: `Mensagem processada ${response.data.webhookTriggered ? 'com' : 'sem'} acionamento de fluxo`,
          variant: "default"
        });
      } else {
        toast({
          title: "Erro no processamento",
          description: response.data.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar webhook:", error);
      toast({
        title: "Erro ao testar webhook",
        description: error.response?.data?.message || error.message,
        variant: "destructive"
      });
      setResult({
        success: false,
        error: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <MessageSquare className="h-4 w-4 mr-2" />
          Testar Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Testar Webhook da Evolution API</DialogTitle>
          <DialogDescription>
            Envie um payload JSON de teste simulando uma mensagem recebida da Evolution API para
            a instância <span className="font-semibold">{instanceName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h3 className="font-medium">Payload JSON</h3>
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="font-mono text-sm h-[300px]"
              placeholder={`{
  "event": "messages.upsert", 
  "data": {
    "messages": [
      {
        "key": {
          "remoteJid": "5511999999999@s.whatsapp.net",
          "fromMe": false
        },
        "message": {
          "conversation": "chat"
        }
      }
    ]
  }
}`}
            />
            <p className="text-xs text-muted-foreground">
              Coloque um payload JSON válido simulando uma mensagem recebida. A instância será
              adicionada automaticamente.
            </p>
          </div>

          {result && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="result">
                <AccordionTrigger>
                  Resultado do Processamento
                </AccordionTrigger>
                <AccordionContent>
                  <div className="font-mono text-xs bg-secondary p-4 rounded-md whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" onClick={handleTest} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Processando..." : "Testar Webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestWebhookPayloadDialog;