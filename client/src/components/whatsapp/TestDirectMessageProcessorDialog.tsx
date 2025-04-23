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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Terminal } from 'lucide-react';

interface TestDirectMessageProcessorDialogProps {
  instanceId: string;
  instanceName: string;
}

export function TestDirectMessageProcessorDialog({
  instanceId,
  instanceName
}: TestDirectMessageProcessorDialogProps) {
  const [messageContent, setMessageContent] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('5511999999999');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageContent) {
      toast({
        title: "Mensagem obrigatória",
        description: "Por favor, digite uma mensagem para testar",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const result = await apiRequest('POST', '/api/test/message-processor', {
        instanceId,
        messageContent,
        fromNumber: phoneNumber,
      });
      
      const data = await result.json();
      
      setTestResult(data);
      
      toast({
        title: data.success ? "Teste concluído" : "Erro no teste",
        description: data.message || "Teste de processamento de mensagem executado",
        variant: data.success ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Erro ao testar processador de mensagens:", error);
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
          <Terminal className="mr-2 h-4 w-4" />
          Testar Processador
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Testar Processador de Mensagens</DialogTitle>
          <DialogDescription>
            Teste o processamento direto de mensagens com análise de palavras-chave para a instância <span className="font-bold">{instanceName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="message">Mensagem para testar</Label>
            <Input
              id="message"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Digite uma mensagem ou palavra-chave"
              required
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Digite a mensagem que deseja testar. A mensagem será processada para detectar palavras-chave.
            </p>
          </div>
          
          <div className="grid w-full gap-1.5">
            <Label htmlFor="phone">Número de telefone (opcional)</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Número de telefone que "enviará" a mensagem (padrão: 5511999999999)
            </p>
          </div>
          
          {testResult && (
            <div className="mt-4 p-3 border rounded-md bg-muted">
              <h4 className="font-medium mb-2">Resultado do teste</h4>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Status:</span> {testResult.success ? 'Sucesso' : 'Erro'}</p>
                <p><span className="font-medium">Mensagem processada:</span> {testResult.messageProcessed ? 'Sim (fluxo acionado)' : 'Não (nenhum fluxo acionado)'}</p>
                <p><span className="font-medium">Instância:</span> {testResult.instanceName}</p>
                <p><span className="font-medium">De:</span> {testResult.fromNumber}</p>
                <p><span className="font-medium">Mensagem:</span> {testResult.messageContent}</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processando..." : "Testar Mensagem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}