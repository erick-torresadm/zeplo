import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Instance } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const instanceSchema = z.object({
  name: z.string()
    .min(3, { message: "Nome da instância deve ter pelo menos 3 caracteres." })
    .regex(/^[a-z0-9]+$/, { 
      message: "Use apenas letras minúsculas e números, sem espaços ou caracteres especiais." 
    })
    .transform(val => val.toLowerCase()),
});

interface AddInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInstanceDialog({ open, onOpenChange }: AddInstanceDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [qrTimer, setQrTimer] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof instanceSchema>>({
    resolver: zodResolver(instanceSchema),
    defaultValues: {
      name: "",
    },
  });

  const createInstanceMutation = useMutation({
    mutationFn: async (values: z.infer<typeof instanceSchema>) => {
      const res = await apiRequest("POST", "/api/instances", values);
      return await res.json() as Instance;
    },
    onSuccess: (data) => {
      toast({
        title: "Instância criada",
        description: "Agora escaneie o QR code com seu WhatsApp.",
      });
      setInstanceId(data.id);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getQrCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("GET", `/api/instances/${id}/qrcode`);
      return await res.json();
    },
    onSuccess: (data) => {
      setQrCode(data.qrcode);
      // Start timer for QR code expiration
      setQrTimer(60);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao obter QR code",
        description: error.message,
        variant: "destructive",
      });
      setQrCode(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", `/api/instances/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
      toast({
        title: "Instância conectada",
        description: "Sua instância de WhatsApp está conectada.",
      });
      onOpenChange(false);
      resetState();
    },
  });

  useEffect(() => {
    if (instanceId && open) {
      // Dar um pequeno tempo para o backend terminar de criar a instância na Evolution API
      const timer = setTimeout(() => {
        getQrCodeMutation.mutate(instanceId);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [instanceId, open]);

  useEffect(() => {
    let interval: number | undefined;
    
    if (qrTimer && qrTimer > 0) {
      interval = window.setInterval(() => {
        setQrTimer((prev) => (prev ? prev - 1 : null));
      }, 1000);
    } else if (qrTimer === 0 && instanceId) {
      // Refresh QR code when timer expires
      getQrCodeMutation.mutate(instanceId);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrTimer, instanceId]);

  function onSubmit(values: z.infer<typeof instanceSchema>) {
    createInstanceMutation.mutate(values);
  }

  function resetState() {
    setQrCode(null);
    setInstanceId(null);
    setQrTimer(null);
    form.reset();
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  function simulateConnection() {
    if (instanceId) {
      updateStatusMutation.mutate({ id: instanceId, status: "connected" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {!instanceId ? "Nova Instância WhatsApp" : "Conectar WhatsApp"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {!instanceId 
              ? "Crie uma nova instância de WhatsApp e conecte-a escaneando o QR code."
              : "Escaneie este QR code com seu aplicativo WhatsApp para conectar."}
          </DialogDescription>
        </DialogHeader>

        {!instanceId ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 my-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Nome da Instância</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: loja, atendimento1" 
                        className="border-slate-300 focus-visible:ring-primary/70"
                        {...field} 
                      />
                    </FormControl>
                    <div className="bg-amber-50 p-3 rounded-md mt-2 border border-amber-200">
                      <p className="text-sm text-amber-800">
                        <strong>Importante:</strong> Use apenas letras minúsculas e números, sem espaços ou caracteres especiais.
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="border-slate-300"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createInstanceMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {createInstanceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>Gerar QR Code</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4 py-2">
            {getQrCodeMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-14 w-14 animate-spin text-primary mb-4" />
                <p className="text-slate-600">Gerando QR Code...</p>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="bg-white border-2 border-primary/20 p-4 rounded-xl shadow-md">
                  <img 
                    src={qrCode.startsWith('data:image/') ? qrCode : `data:image/png;base64,${qrCode}`} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64"
                  />
                </div>
                
                <div className="w-full bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">
                      QR code expira em:
                    </p>
                    <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium">
                      {qrTimer} segundos
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-600 mb-4">
                    <ol className="space-y-2 list-decimal list-inside">
                      <li>Abra o WhatsApp no seu celular</li>
                      <li>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></li>
                      <li>Toque em <strong>Aparelhos vinculados</strong></li>
                      <li>Aponte a câmera para este QR Code</li>
                    </ol>
                  </div>
                  
                  <div className="flex justify-between items-center gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => handleDialogClose(false)}
                      className="border-slate-300"
                    >
                      Cancelar
                    </Button>
                    
                    <Button 
                      onClick={simulateConnection}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2 fill-current" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                            QR Code Escaneado
                          </div>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 space-y-4">
                <div className="bg-red-50 p-4 rounded-lg w-full text-center">
                  <p className="text-red-600 font-medium">Falha ao carregar QR code. Por favor, tente novamente.</p>
                </div>
                <Button 
                  onClick={() => getQrCodeMutation.mutate(instanceId)}
                  variant="outline"
                  className="border-primary/30 bg-primary/5 hover:bg-primary/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
