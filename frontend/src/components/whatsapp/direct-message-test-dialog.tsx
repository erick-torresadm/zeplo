import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Instance } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Info, Send } from "lucide-react";

// Schema para validação dos dados do formulário
const directMessageTestSchema = z.object({
  instanceId: z.string().min(1, "Selecione uma instância"),
  phoneNumber: z.string().min(8, "O número de telefone deve ter pelo menos 8 dígitos"),
  message: z.string().min(1, "A mensagem não pode estar vazia"),
  forceProcess: z.boolean().default(true),
});

type DirectMessageTestData = z.infer<typeof directMessageTestSchema>;

interface DirectMessageTestResult {
  success: boolean;
  message: string;
  details?: any;
}

interface DirectMessageTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DirectMessageTestDialog({ open, onOpenChange }: DirectMessageTestDialogProps) {
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<DirectMessageTestResult | null>(null);

  const form = useForm<DirectMessageTestData>({
    resolver: zodResolver(directMessageTestSchema),
    defaultValues: {
      instanceId: "",
      phoneNumber: "",
      message: "",
      forceProcess: true,
    },
  });

  const { data: instances, isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ["/api/instances"],
    enabled: open, // Só carrega quando o modal está aberto
  });

  const testMutation = useMutation({
    mutationFn: async (data: DirectMessageTestData) => {
      const response = await apiRequest("POST", "/api/test/send-message", data);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast({
          title: "Mensagem enviada com sucesso",
          description: data.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Erro ao enviar mensagem",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setTestResult(null);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DirectMessageTestData) => {
    setTestResult(null);
    testMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">Teste de Envio Direto</DialogTitle>
          <DialogDescription className="text-base">
            Envie uma mensagem de teste diretamente através da Evolution API sem utilizar os fluxos automáticos.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1 mb-4">
          <div className="flex items-start space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-800">
              <p><strong>Importante:</strong> Normalmente a instância precisa estar conectada para processar a mensagem.</p>
              <p className="mt-1">A opção "Forçar processamento" está ativada, permitindo enviar mesmo que a instância esteja desconectada (ideal para testes).</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="instanceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">Instância WhatsApp</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={testMutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger className="border-slate-300 focus-visible:ring-primary/70">
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingInstances ? (
                        <div className="flex justify-center p-3">
                          <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
                        </div>
                      ) : instances && instances.length > 0 ? (
                        instances.map((instance) => (
                          <SelectItem 
                            key={instance.id} 
                            value={instance.id}
                            className="flex items-center py-2.5"
                          >
                            <div className="flex items-center">
                              <span className="font-medium">{instance.name}</span>
                              {instance.status === "connected" ? (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                  <span className="w-1.5 h-1.5 rounded-full mr-1 bg-green-500 animate-pulse"></span>
                                  Conectada
                                </span>
                              ) : instance.status === "connecting" ? (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full mr-1 bg-amber-500 animate-pulse"></span>
                                  Conectando
                                </span>
                              ) : (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                  <span className="w-1.5 h-1.5 rounded-full mr-1 bg-red-500"></span>
                                  Desconectada
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-3 text-center">
                          <p className="text-slate-500">Nenhuma instância disponível</p>
                          <p className="text-xs text-slate-400 mt-1">Crie uma instância primeiro</p>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Número de Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: 5511987654321" 
                        className="border-slate-300 focus-visible:ring-primary/70"
                        {...field} 
                        disabled={testMutation.isPending}
                      />
                    </FormControl>
                    <p className="text-xs text-slate-500 mt-1">
                      Inclua o código do país (Ex: 55 para Brasil)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Mensagem de Texto</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite a mensagem a ser enviada" 
                        className="border-slate-300 focus-visible:ring-primary/70"
                        {...field} 
                        disabled={testMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="forceProcess"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-slate-50">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={testMutation.isPending}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-base font-medium">
                      Forçar processamento
                    </FormLabel>
                    <p className="text-xs text-slate-500">
                      Permite enviar mensagens mesmo se a instância estiver desconectada (ideal para testes)
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {testResult && (
              <Alert
                className={`${testResult.success 
                  ? "bg-green-50 border-green-200 text-green-800" 
                  : "bg-red-50 border-red-200 text-red-800"}`}
              >
                <div className="flex items-start space-x-3">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <AlertDescription className="text-sm font-medium">
                      {testResult.message}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            <Alert className="bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <AlertDescription className="text-sm text-blue-800">
                  <p className="font-medium">Sobre o teste direto:</p>
                  <ul className="list-disc list-inside text-blue-700 space-y-1 mt-1">
                    <li>Envia uma mensagem real através da Evolution API</li>
                    <li>Não afeta os fluxos automáticos cadastrados</li>
                    <li>Útil para testar a conexão da instância</li>
                    <li>O número deve incluir o código do país e DDD</li>
                  </ul>
                </AlertDescription>
              </div>
            </Alert>

            <div className="flex justify-between items-center pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={testMutation.isPending}
                className="border-slate-300"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={testMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {testMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}