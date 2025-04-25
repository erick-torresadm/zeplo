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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Send, Zap } from "lucide-react";
import axios from "axios";

interface TestFlowTriggerDialogProps {
  flowId: string;
  flowName: string;
  keyword: string;
}

export function TestFlowTriggerDialog({ flowId, flowName, keyword }: TestFlowTriggerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("5511999999999");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    flowDetails?: any;
  } | null>(null);
  
  const { toast } = useToast();

  const handleTest = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await axios.post("/api/test-flow-direct", {
        flowId,
        phoneNumber
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: "Fluxo acionado com sucesso!",
          description: `Fluxo "${flowName}" acionado para ${phoneNumber}`,
          variant: "default",
        });
      } else {
        toast({
          title: "Erro ao acionar fluxo",
          description: response.data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar fluxo:", error);
      setResult({
        success: false,
        message: error.response?.data?.message || error.message || "Erro ao testar fluxo"
      });
      
      toast({
        title: "Erro ao testar fluxo",
        description: error.response?.data?.message || error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Zap className="h-4 w-4 mr-1" /> 
          Testar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Testar Acionamento de Fluxo</DialogTitle>
          <DialogDescription>
            Teste o acionamento direto do fluxo "{flowName}" com a palavra-chave "{keyword}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de telefone para teste</Label>
            <Input
              id="phoneNumber"
              placeholder="55119XXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Número no formato internacional, sem traços, pontos ou parênteses
            </p>
          </div>
          
          {result && (
            <div className={`p-3 rounded-md ${result.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
              <div className="flex items-center">
                {result.success ? (
                  <MessageSquare className="w-5 h-5 mr-2" />
                ) : (
                  <Zap className="w-5 h-5 mr-2" />
                )}
                <span className="font-medium">{result.message}</span>
              </div>
              
              {result.success && result.flowDetails && (
                <div className="mt-2 text-sm">
                  <p>O fluxo "{result.flowDetails.name}" foi acionado com sucesso.</p>
                  <p>As mensagens estão sendo enviadas para {phoneNumber}.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
          <Button onClick={handleTest} disabled={isLoading} className="gap-1">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" />
            Testar Acionamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}