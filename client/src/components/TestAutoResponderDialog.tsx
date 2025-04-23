import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

const testSchema = z.object({
  instanceId: z.string().min(1, 'ID da instância é obrigatório'),
  phoneNumber: z.string().min(8, 'Número de telefone deve ter pelo menos 8 caracteres'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
});

type TestFormValues = z.infer<typeof testSchema>;

interface TestAutoResponderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
}

export default function TestAutoResponderDialog({ 
  open, 
  onOpenChange, 
  instanceId,
  instanceName 
}: TestAutoResponderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      instanceId,
      phoneNumber: '5511999999999',
      message: 'Olá, gostaria de solicitar um orçamento',
    },
  });

  const onSubmit = async (data: TestFormValues) => {
    setLoading(true);
    setResult(null);
    
    try {
      // Test endpoint to simulate receiving a message
      const response = await apiRequest('POST', '/api/test/autoresponder', data);
      const responseData = await response.json();
      
      setResult(responseData);
      
      toast({
        title: responseData.success 
          ? 'Teste concluído com sucesso!' 
          : 'Teste falhou',
        description: responseData.message,
        variant: responseData.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao testar',
        description: error.message || 'Ocorreu um erro ao testar o sistema de resposta automática',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Testar Resposta Automática</DialogTitle>
          <DialogDescription>
            Simule o recebimento de uma mensagem na instância {instanceName} para testar o acionamento de fluxos.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de telefone (remetente)</FormLabel>
                  <FormControl>
                    <Input placeholder="5511999999999" {...field} />
                  </FormControl>
                  <FormDescription>
                    Número que estará enviando a mensagem
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Digite uma mensagem que contenha uma palavra-chave para testar..." 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Digite uma mensagem que contenha alguma palavra-chave configurada em um fluxo ativo
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando teste...
                  </>
                ) : (
                  'Testar auto-resposta'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        
        {result && (
          <div className="mt-4 p-4 border rounded-md bg-muted">
            <h3 className="text-sm font-medium mb-2">Resultado do teste:</h3>
            <pre className="text-xs overflow-auto max-h-[200px] p-2 bg-background rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}