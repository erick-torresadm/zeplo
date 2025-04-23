import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AutoChatResponseDialogProps {
  instanceId: string;
  instanceName: string;
}

export function AutoChatResponseDialog({ instanceId, instanceName }: AutoChatResponseDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("5511999999999"); // Número padrão para testes
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleTest = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número de telefone obrigatório",
        description: "Por favor, insira um número de telefone para testar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Chama o endpoint para testar a resposta automática a "chat"
      const response = await apiRequest("POST", "/api/test-auto-response", {
        instanceId,
        phoneNumber,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast({
          title: "Teste realizado com sucesso",
          description: "A resposta automática à palavra-chave 'chat' foi processada com sucesso",
          variant: "default",
        });
      } else {
        toast({
          title: "Resposta automática não disponível",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar resposta automática a 'chat':", error);
      setResult({
        success: false,
        message: `Erro: ${error.message || "Falha ao conectar com o servidor"}`,
      });
      toast({
        title: "Erro no teste",
        description: `Não foi possível testar a resposta automática: ${error.message}`,
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
          className="ml-2 border-green-300 bg-green-50 hover:bg-green-100 text-green-700"
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          Testar Auto-Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Testar Resposta Automática a "chat"</DialogTitle>
          <DialogDescription>
            Teste a resposta automática à palavra-chave "chat" na instância {instanceName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <div className="bg-blue-50 text-blue-700 border border-blue-200 p-4 rounded-md">
              <h4 className="font-medium mb-1">Como funciona</h4>
              <p className="text-sm">
                Este teste simula o recebimento da mensagem <span className="font-semibold">"chat"</span> e 
                verifica se o sistema responde automaticamente sem intervenção manual.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número simulado</Label>
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
                  <AlertTitle>{result.success ? "Sucesso" : "Falha"}</AlertTitle>
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
            {loading ? "Testando..." : "Testar Resposta Automática"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}