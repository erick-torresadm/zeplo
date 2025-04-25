import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { WhatsAppContact, MessageFlow } from "@shared/schema";
import { useWhatsAppContext } from "@/context/whatsapp-context";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Users, MessageSquare, GitBranch, Info, AlertCircle, MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ContactSelectionDialog from "@/components/mass-messaging/contact-selection-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// Schema para validação do formulário de mensagem simples
const simpleMessageFormSchema = z.object({
  instanceId: z.string().min(1, "Selecione uma instância"),
  message: z.string().min(1, "Digite uma mensagem para enviar"),
  delayBetweenMessages: z.number().min(1, "Defina um intervalo mínimo de 1 segundo").max(60, "Intervalo máximo de 60 segundos")
});

// Schema para validação do formulário de fluxo
const flowMessageFormSchema = z.object({
  instanceId: z.string().min(1, "Selecione uma instância"),
  flowId: z.string().min(1, "Selecione um fluxo de mensagens"),
  delayBetweenContacts: z.number().min(1, "Defina um intervalo mínimo de 1 segundo").max(60, "Intervalo máximo de 60 segundos")
});

// Tipos inferidos dos schemas
type SimpleMessageFormValues = z.infer<typeof simpleMessageFormSchema>;
type FlowMessageFormValues = z.infer<typeof flowMessageFormSchema>;

export default function MassMessagingPageNew() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("simple");
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<WhatsAppContact[]>([]);
  const [selectedFlowDetails, setSelectedFlowDetails] = useState<MessageFlow | null>(null);

  // Usando o contexto global de WhatsApp para acessar as instâncias
  const { 
    connectedInstances, 
    isLoading: isLoadingInstances, 
    hasConnectedInstances,
    selectedInstanceId,
    setSelectedInstanceId
  } = useWhatsAppContext();

  // Carregar fluxos de mensagens
  const { data: messageFlows = [], isLoading: isLoadingFlows } = useQuery<MessageFlow[]>({
    queryKey: ['/api/message-flows'],
    enabled: activeTab === 'flow'
  });

  // Formulário para mensagem simples
  const simpleMessageForm = useForm<SimpleMessageFormValues>({
    resolver: zodResolver(simpleMessageFormSchema),
    defaultValues: {
      instanceId: selectedInstanceId || "",
      message: "",
      delayBetweenMessages: 2 // Padrão 2 segundos entre mensagens
    }
  });
  
  // Formulário para fluxo
  const flowMessageForm = useForm<FlowMessageFormValues>({
    resolver: zodResolver(flowMessageFormSchema),
    defaultValues: {
      instanceId: selectedInstanceId || "",
      flowId: "",
      delayBetweenContacts: 5 // Padrão 5 segundos entre contatos
    }
  });
  
  // Efeito para atualizar os formulários quando a instância selecionada no contexto mudar
  useEffect(() => {
    if (selectedInstanceId) {
      simpleMessageForm.setValue("instanceId", selectedInstanceId);
      flowMessageForm.setValue("instanceId", selectedInstanceId);
    }
  }, [selectedInstanceId, simpleMessageForm, flowMessageForm]);

  // Quando o flowId mudar, buscar detalhes do fluxo
  useEffect(() => {
    const flowId = flowMessageForm.watch("flowId");
    if (flowId && messageFlows) {
      const flow = messageFlows.find((f: MessageFlow) => f.id === flowId);
      setSelectedFlowDetails(flow || null);
    } else {
      setSelectedFlowDetails(null);
    }
  }, [flowMessageForm.watch("flowId"), messageFlows]);

  // Hook para envio de mensagem simples em massa
  const sendSimpleMassMutation = useMutation({
    mutationFn: async (data: SimpleMessageFormValues & { contacts: string[] }) => {
      const res = await apiRequest("POST", "/api/send-mass-message", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Mensagens enviadas com sucesso!",
        description: `${data.successCount} mensagens enviadas para ${data.totalCount} contatos.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagens",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Hook para envio de fluxo em massa
  const sendFlowMassMutation = useMutation({
    mutationFn: async (data: { instanceId: string, flowId: string, contacts: string[], delayBetweenContacts: number }) => {
      const res = await apiRequest("POST", "/api/send-flow-mass", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Fluxo enviado com sucesso!",
        description: `O fluxo foi iniciado para ${data.totalCount} contatos.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Enviar mensagem simples
  const onSubmitSimpleMessage = (values: SimpleMessageFormValues) => {
    if (selectedContacts.length === 0) {
      toast({
        title: "Nenhum contato selecionado",
        description: "Selecione pelo menos um contato para enviar mensagens",
        variant: "destructive",
      });
      return;
    }
    
    // Confirmação para muitas mensagens
    if (selectedContacts.length > 10) {
      if (!confirm(`Você está prestes a enviar mensagens para ${selectedContacts.length} contatos. Deseja continuar?`)) {
        return;
      }
    }

    sendSimpleMassMutation.mutate({
      ...values,
      contacts: selectedContacts.map(contact => contact.phoneNumber)
    });
  };

  // Enviar fluxo para múltiplos contatos
  const onSubmitFlowMessage = (values: FlowMessageFormValues) => {
    if (selectedContacts.length === 0) {
      toast({
        title: "Nenhum contato selecionado",
        description: "Selecione pelo menos um contato para enviar o fluxo",
        variant: "destructive",
      });
      return;
    }
    
    // Confirmação para muitas mensagens
    if (selectedContacts.length > 10) {
      if (!confirm(`Você está prestes a enviar um fluxo para ${selectedContacts.length} contatos. Deseja continuar?`)) {
        return;
      }
    }

    sendFlowMassMutation.mutate({
      ...values,
      contacts: selectedContacts.map(contact => contact.phoneNumber)
    });
  };

  // Abrir diálogo de seleção de contatos
  const openContactSelection = () => {
    const instanceId = activeTab === 'simple' 
      ? simpleMessageForm.getValues().instanceId 
      : flowMessageForm.getValues().instanceId;
    
    if (!instanceId) {
      toast({
        title: "Selecione uma instância",
        description: "Você precisa selecionar uma instância antes de escolher contatos",
        variant: "destructive",
      });
      return;
    }

    setIsContactDialogOpen(true);
  };

  // Receber contatos selecionados do diálogo
  const handleContactsSelected = (contacts: WhatsAppContact[]) => {
    setSelectedContacts(contacts);
    setIsContactDialogOpen(false);
  };

  // Remover um contato da seleção
  const removeContact = (phoneNumber: string) => {
    setSelectedContacts(selectedContacts.filter(
      contact => contact.phoneNumber !== phoneNumber
    ));
  };

  // Instâncias conectadas filtradas pelo ID da instância atual
  const filteredFlows = messageFlows.filter((flow: MessageFlow) => 
    activeTab === 'flow' && 
    flowMessageForm.getValues().instanceId && 
    flow.instanceId === flowMessageForm.getValues().instanceId
  );

  // Verificar se há instâncias com fluxos configurados
  const hasFlowsForInstance = filteredFlows && filteredFlows.length > 0;

  // Mensagens em progresso?
  const isSending = sendSimpleMassMutation.isPending || sendFlowMassMutation.isPending;

  // Selecionar instância (usado para ambos os formulários)
  const handleInstanceSelect = (value: string) => {
    if (activeTab === 'simple') {
      simpleMessageForm.setValue("instanceId", value);
    } else {
      flowMessageForm.setValue("instanceId", value);
      // Limpar a seleção de fluxo quando a instância muda
      flowMessageForm.setValue("flowId", "");
    }
    setSelectedInstanceId(value);
  };

  // Selecionar fluxo
  const handleFlowSelect = (value: string) => {
    flowMessageForm.setValue("flowId", value);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">
        Envio de Mensagens em Massa
      </h1>

      {!hasConnectedInstances && !isLoadingInstances && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nenhuma instância conectada</AlertTitle>
          <AlertDescription>
            Conecte uma instância do WhatsApp para enviar mensagens em massa.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="simple" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="simple" className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            Mensagem Simples
          </TabsTrigger>
          <TabsTrigger value="flow" className="flex items-center">
            <GitBranch className="h-4 w-4 mr-2" />
            Fluxo de Mensagens
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Formulário */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === 'simple' ? 'Mensagem Simples' : 'Fluxo de Mensagens'}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'simple' 
                    ? 'Envie uma mensagem de texto simples para múltiplos contatos' 
                    : 'Envie um fluxo de mensagens pré-configurado para múltiplos contatos'}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <TabsContent value="simple" className="mt-0 space-y-4">
                  <Form {...simpleMessageForm}>
                    <form
                      onSubmit={simpleMessageForm.handleSubmit(onSubmitSimpleMessage)}
                      className="space-y-6"
                    >
                      {/* Seleção de instância */}
                      <FormField
                        control={simpleMessageForm.control}
                        name="instanceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Instância do WhatsApp</FormLabel>
                            <FormControl>
                              <select 
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isLoadingInstances || !hasConnectedInstances || isSending}
                                value={field.value}
                                onChange={(e) => handleInstanceSelect(e.target.value)}
                              >
                                <option value="">Selecione uma instância</option>
                                {connectedInstances?.map((instance) => (
                                  <option key={instance.id} value={instance.id}>
                                    {instance.name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormDescription>
                              Escolha a instância que enviará as mensagens
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Mensagem a ser enviada */}
                      <FormField
                        control={simpleMessageForm.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mensagem</FormLabel>
                            <FormControl>
                              <textarea
                                placeholder="Digite a mensagem que será enviada para todos os contatos selecionados"
                                className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSending}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              A mesma mensagem será enviada para todos os contatos selecionados
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Atraso entre mensagens */}
                      <FormField
                        control={simpleMessageForm.control}
                        name="delayBetweenMessages"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intervalo entre mensagens (segundos)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={60}
                                disabled={isSending}
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Intervalo de espera entre cada mensagem (1-60 segundos)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Alert variant="default" className="bg-amber-50 border-amber-200">
                        <Info className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Atenção</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          O envio de mensagens em massa deve respeitar os limites do WhatsApp 
                          para evitar o bloqueio da sua conta.
                        </AlertDescription>
                      </Alert>

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openContactSelection}
                          disabled={isSending || !simpleMessageForm.getValues().instanceId}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Selecionar Contatos
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            isSending ||
                            selectedContacts.length === 0 ||
                            !hasConnectedInstances
                          }
                        >
                          {sendSimpleMassMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Enviar Mensagens
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="flow" className="mt-0 space-y-4">
                  <Form {...flowMessageForm}>
                    <form
                      onSubmit={flowMessageForm.handleSubmit(onSubmitFlowMessage)}
                      className="space-y-6"
                    >
                      {/* Seleção de instância */}
                      <FormField
                        control={flowMessageForm.control}
                        name="instanceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Instância do WhatsApp</FormLabel>
                            <FormControl>
                              <select 
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isLoadingInstances || !hasConnectedInstances || isSending}
                                value={field.value}
                                onChange={(e) => handleInstanceSelect(e.target.value)}
                              >
                                <option value="">Selecione uma instância</option>
                                {connectedInstances?.map((instance) => (
                                  <option key={instance.id} value={instance.id}>
                                    {instance.name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormDescription>
                              Escolha a instância do WhatsApp
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Seleção de fluxo de mensagens */}
                      <FormField
                        control={flowMessageForm.control}
                        name="flowId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fluxo de Mensagens</FormLabel>
                            <FormControl>
                              <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isLoadingFlows || isSending || !flowMessageForm.getValues().instanceId || !hasFlowsForInstance}
                                value={field.value}
                                onChange={(e) => handleFlowSelect(e.target.value)}
                              >
                                <option value="">Selecione um fluxo</option>
                                {filteredFlows.map((flow: MessageFlow) => (
                                  <option key={flow.id} value={flow.id}>
                                    {flow.name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormDescription>
                              {!flowMessageForm.getValues().instanceId
                                ? "Selecione uma instância primeiro"
                                : !hasFlowsForInstance
                                ? "Não há fluxos disponíveis para esta instância"
                                : "Escolha o fluxo de mensagens que será enviado para os contatos"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Detalhes do fluxo selecionado */}
                      {selectedFlowDetails && (
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2 border">
                          <h4 className="font-medium text-sm">Detalhes do fluxo selecionado:</h4>
                          <div className="text-sm space-y-1">
                            <p><span className="font-medium">Nome:</span> {selectedFlowDetails.name}</p>
                            <p><span className="font-medium">Palavra-chave:</span> {selectedFlowDetails.keyword}</p>
                            <p><span className="font-medium">Tipo de gatilho:</span> {
                              selectedFlowDetails.triggerType === 'exact_match' ? 'Correspondência exata' : 
                              selectedFlowDetails.triggerType === 'contains' ? 'Contém palavra' : 'Todas mensagens'
                            }</p>
                            <p><span className="font-medium">Mensagens no fluxo:</span> {selectedFlowDetails.messages.length}</p>
                          </div>
                        </div>
                      )}

                      {/* Atraso entre contatos */}
                      <FormField
                        control={flowMessageForm.control}
                        name="delayBetweenContacts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intervalo entre contatos (segundos)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={60}
                                disabled={isSending}
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Intervalo de espera entre o envio para cada contato (1-60 segundos)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Alert variant="default" className="bg-amber-50 border-amber-200">
                        <Info className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Atenção</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          O fluxo de mensagens completo será executado para cada contato selecionado.
                          Tenha cuidado com o volume de envios para evitar bloqueios.
                        </AlertDescription>
                      </Alert>

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openContactSelection}
                          disabled={isSending || !flowMessageForm.getValues().instanceId}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Selecionar Contatos
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            isSending ||
                            selectedContacts.length === 0 ||
                            !hasConnectedInstances ||
                            !flowMessageForm.getValues().flowId
                          }
                        >
                          {sendFlowMassMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <MessagesSquare className="mr-2 h-4 w-4" />
                              Enviar Fluxo
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </CardContent>
            </Card>
          </div>

          {/* Painel lateral de contatos */}
          <div className="lg:col-span-5">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Contatos Selecionados</CardTitle>
                <CardDescription>
                  {selectedContacts.length === 0
                    ? "Nenhum contato selecionado"
                    : `${selectedContacts.length} contato(s) selecionado(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-30" />
                    <p>Clique em "Selecionar Contatos" para escolher os destinatários</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {selectedContacts.map((contact) => (
                          <Badge
                            key={contact.phoneNumber}
                            variant="secondary"
                            className="px-3 py-1 flex items-center gap-1"
                          >
                            <span>
                              {contact.name || contact.phoneNumber}
                            </span>
                            <button
                              onClick={() => removeContact(contact.phoneNumber)}
                              className="ml-1 text-xs hover:text-destructive"
                              disabled={isSending}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  {isSending && (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Processando envio...</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedContacts.length === 0 || isSending}
                  onClick={() => setSelectedContacts([])}
                >
                  Limpar Seleção
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </Tabs>

      {/* Diálogo de seleção de contatos */}
      <ContactSelectionDialog
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
        onContactsSelected={handleContactsSelected}
        selectedContacts={selectedContacts}
        instanceId={activeTab === 'simple' 
          ? simpleMessageForm.getValues().instanceId 
          : flowMessageForm.getValues().instanceId}
      />
    </div>
  );
}