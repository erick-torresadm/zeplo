import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Check, AlertCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

// Schema de validação do formulário
const testTimestampFormSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, 'O número de telefone deve ter pelo menos 10 dígitos')
    .refine((val) => /^\d+$/.test(val), {
      message: 'O número de telefone deve conter apenas dígitos',
    }),
  messageContent: z
    .string()
    .min(1, 'A mensagem não pode estar vazia')
    .max(1000, 'A mensagem deve ter no máximo 1000 caracteres'),
});

type TestTimestampFormValues = z.infer<typeof testTimestampFormSchema>;

interface TestBrazilianTimestampDialogProps {
  instanceId: string;
  instanceName: string;
}

export default function TestBrazilianTimestampDialog({ 
  instanceId, 
  instanceName 
}: TestBrazilianTimestampDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const form = useForm<TestTimestampFormValues>({
    resolver: zodResolver(testTimestampFormSchema),
    defaultValues: {
      phoneNumber: '5511999999999',
      messageContent: 'Mensagem de teste com timestamp brasileiro',
    },
  });

  async function handleSubmit(data: TestTimestampFormValues) {
    setIsSubmitting(true);
    setTestResult(null);

    try {
      // Faz a requisição para testar mensagem com timestamp brasileiro
      const response = await apiRequest('POST', '/api/test/message-brazilian-timestamp', {
        instanceId,
        phoneNumber: data.phoneNumber,
        messageContent: data.messageContent,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao testar mensagem com timestamp brasileiro');
      }

      const result = await response.json();
      setTestResult(result);

      toast({
        title: 'Teste realizado com sucesso',
        description: 'A mensagem com timestamp brasileiro foi processada',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Erro ao testar mensagem com timestamp brasileiro:', error);
      
      toast({
        title: 'Erro no teste',
        description: error.message || 'Não foi possível realizar o teste',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Clock className="mr-2 h-4 w-4" />
          Testar Timestamp BR
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Testar Mensagem com Timestamp Brasileiro</DialogTitle>
          <DialogDescription>
            Este teste simula uma mensagem recebida com formato de data brasileiro
            para a instância <strong>{instanceName}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de telefone</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="messageContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo da mensagem</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {testResult && (
              <Alert variant="default" className="mt-4">
                <Check className="h-4 w-4" />
                <AlertTitle>Teste concluído!</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="text-sm space-y-1">
                    <p><strong>Timestamp gerado:</strong> {testResult.timestamp}</p>
                    <p><strong>Timestamp convertido:</strong> {testResult.timestampIso}</p>
                    <p><strong>Palavra-chave acionada:</strong> {testResult.processed ? 'Sim' : 'Não'}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Testar Mensagem
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}