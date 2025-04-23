import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Instance, messageTypeEnum } from "@shared/schema";
import { SortableMessageList } from "./sortable-message-list";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Esquema para os diferentes tipos de mensagens
// Texto
const textMessageSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1, { message: "O texto da mensagem é obrigatório" }),
  delay: z.number().min(0).default(0),
});

// Imagem
const imageMessageSchema = z.object({
  type: z.literal("image"),
  mediaUrl: z.string().min(1, { message: "A URL da imagem é obrigatória" }),
  caption: z.string().optional().default(""),
  fileName: z.string().optional(),
  delay: z.number().min(0).default(0),
});

// Áudio
const audioMessageSchema = z.object({
  type: z.literal("audio"),
  mediaUrl: z.string().min(1, { message: "A URL do áudio é obrigatória" }),
  fileName: z.string().optional(),
  ptt: z.boolean().optional().default(false),
  delay: z.number().min(0).default(0),
});

// Vídeo
const videoMessageSchema = z.object({
  type: z.literal("video"),
  mediaUrl: z.string().min(1, { message: "A URL do vídeo é obrigatória" }),
  caption: z.string().optional().default(""),
  fileName: z.string().optional(),
  delay: z.number().min(0).default(0),
});

// Documento
const documentMessageSchema = z.object({
  type: z.literal("document"),
  mediaUrl: z.string().min(1, { message: "A URL do documento é obrigatória" }),
  fileName: z.string().min(1, { message: "O nome do arquivo é obrigatório" }),
  delay: z.number().min(0).default(0),
});

// Usa o discriminated union para diferenciar os tipos de mensagem
const messageSchema = z.discriminatedUnion("type", [
  textMessageSchema,
  imageMessageSchema,
  audioMessageSchema,
  videoMessageSchema,
  documentMessageSchema,
]);

const messageFlowSchema = z.object({
  name: z.string().min(3, {
    message: "O nome do fluxo deve ter pelo menos 3 caracteres.",
  }),
  keyword: z.string().min(1, {
    message: "A palavra-chave de acionamento é obrigatória.",
  }),
  instanceId: z.string({
    required_error: "Por favor, selecione uma instância.",
  }),
  messages: z.array(messageSchema).min(1, {
    message: "Pelo menos uma mensagem é obrigatória.",
  }),
  triggerType: z.enum(["exact_match", "contains", "all_messages"], {
    required_error: "Selecione o tipo de gatilho",
  }).default("exact_match"),
  activationDelay: z.number().int().min(0).default(0),
});

type MessageFlowFormValues = z.infer<typeof messageFlowSchema>;

interface AddMessageFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMessageFlowDialog({ open, onOpenChange }: AddMessageFlowDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: instances, isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ["/api/instances"],
    enabled: open,
  });

  const form = useForm<MessageFlowFormValues>({
    resolver: zodResolver(messageFlowSchema),
    defaultValues: {
      name: "",
      keyword: "",
      instanceId: "",
      messages: [
        { type: "text", text: "", delay: 3 }
      ],
      triggerType: "exact_match",
      activationDelay: 0
    },
  });

  const createMessageFlowMutation = useMutation({
    mutationFn: async (values: MessageFlowFormValues) => {
      const res = await apiRequest("POST", "/api/message-flows", values);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-flows"] });
      toast({
        title: "Fluxo de mensagens criado",
        description: "Seu novo fluxo de mensagens foi criado com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar fluxo de mensagens",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: MessageFlowFormValues) {
    createMessageFlowMutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Fluxo de Mensagens</DialogTitle>
          <DialogDescription>
            Configure respostas automáticas acionadas por uma palavra-chave específica.
            Organize as mensagens na ordem desejada arrastando-as.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Fluxo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex.: Fluxo de Boas-vindas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="keyword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Palavra-chave de Disparo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex.: olá" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="instanceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instância WhatsApp</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={isLoadingInstances}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {instances?.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.name} {instance.status === "connected" ? "(Conectado)" : "(Desconectado)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs text-amber-600 mt-1">
                    <AlertCircle className="h-3 w-3 inline-block mr-1" />
                    Nota: A instância precisa estar conectada para que as mensagens sejam enviadas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="triggerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Gatilho</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de gatilho" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="exact_match">Correspondência exata</SelectItem>
                        <SelectItem value="contains">Contém palavra/frase</SelectItem>
                        <SelectItem value="all_messages">Todas as mensagens</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Como as palavras-chave devem ser identificadas nas mensagens recebidas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="activationDelay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atraso na Ativação (segundos)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        placeholder="0" 
                        {...field}
                        onChange={e => field.onChange(e.target.valueAsNumber || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Tempo de espera antes de enviar as mensagens (0 = envio imediato).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Lista de mensagens arrastável */}
            <SortableMessageList control={form.control} name="messages" />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMessageFlowMutation.isPending}>
                {createMessageFlowMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar Fluxo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
