import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TestKeywordWebhookDialogProps {
  instanceId: string;
  instanceName: string;
}

export function TestKeywordWebhookDialog({ instanceId, instanceName }: TestKeywordWebhookDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("5511999999999"); // Número padrão para testes
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleTest = async () => {
    if (!keyword) {
      toast({
        title: "Palavra-chave obrigatória",
        description: "Por favor, insira uma palavra-chave para testar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Chama o novo endpoint que testa diretamente a palavra-chave e envia para o webhook
      const response = await apiRequest("POST", `/api/webhook/test-direct/${instanceId}`, {
        message: keyword,
        phoneNumber,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast({
          title: "Teste realizado com sucesso",
          description: `A palavra-chave "${keyword}" foi processada e enviada para o webhook externo`,
          variant: "default",
        });
      } else {
        toast({
          title: "Palavra-chave não detectada",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar palavra-chave:", error);
      setResult({
        success: false,
        message: `Erro: ${error.message || "Falha ao conectar com o servidor"}`,
      });
      toast({
        title: "Erro no teste",
        description: `Não foi possível testar a palavra-chave: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="ml-2 border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700"
        >
          <Globe className="h-4 w-4 mr-1" />
          Testar Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Testar Detecção de Palavra-chave e Webhook</DialogTitle>
          <DialogDescription>
            Teste diretamente se uma palavra-chave aciona o webhook externo na instância {instanceName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="keyword">Palavra-chave para testar</Label>
            <Input
              id="keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Digite a palavra-chave para testar"
            />
            <p className="text-sm text-muted-foreground">
              Digite exatamente a palavra-chave configurada em algum fluxo ativo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número simulado (opcional)</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Exemplo: 5511999999999"
            />
            <p className="text-sm text-muted-foreground">
              Número que será usado para simular o recebimento da mensagem.
            </p>
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start space-x-2">
                {result.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                <div>
                  <AlertTitle>{result.success ? "Sucesso" : "Erro"}</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTest} disabled={loading}>
            {loading ? "Testando..." : "Testar Palavra-chave"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}