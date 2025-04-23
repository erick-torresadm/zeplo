import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WhatsAppContact, MessageFlow } from "@shared/schema";
import { useWhatsAppContext } from "@/context/whatsapp-context";
import ContactSelectionDialog from "@/components/mass-messaging/contact-selection-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Send, 
  Users, 
  Info, 
  AlertCircle, 
  MessagesSquare 
} from "lucide-react";

export default function MassMessagingSimplified() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<"simple" | "flow">("simple");
  const [instanceId, setInstanceId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [message, setMessage] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<WhatsAppContact[]>([]);
  const [selectedFlowDetails, setSelectedFlowDetails] = useState<MessageFlow | null>(null);

  // Usando o contexto global de WhatsApp para acessar as instâncias
  const { 
    connectedInstances, 
    instances,
    isLoading: isLoadingInstances, 
    hasConnectedInstances,
    setSelectedInstanceId,
    refetchInstances
  } = useWhatsAppContext();
  
  // Forçar a atualização das instâncias quando a página carrega
  useEffect(() => {
    console.log("Forçando atualização das instâncias na página de envio em massa");
    refetchInstances();
  }, []);
  
  // Log das instâncias disponíveis para debug
  useEffect(() => {
    if (instances.length > 0) {
      console.log("Instâncias disponíveis:", instances.map(i => ({
        id: i.id,
        nome: i.name,
        status: i.status,
        disponível: i.status === 'connected'
      })));
      console.log("Instâncias conectadas:", connectedInstances);
    }
  }, [instances, connectedInstances]);

  // Carregar fluxos de mensagens
  const { data: messageFlows = [], isLoading: isLoadingFlows } = useQuery<MessageFlow[]>({
    queryKey: ['/api/message-flows'],
    enabled: currentTab === 'flow'
  });

  // Quando o flowId mudar, buscar detalhes do fluxo
  useEffect(() => {
    if (flowId && messageFlows) {
      const flow = messageFlows.find((f: MessageFlow) => f.id === flowId);
      setSelectedFlowDetails(flow || null);
    } else {
      setSelectedFlowDetails(null);
    }
  }, [flowId, messageFlows]);

  // Hook para envio de mensagem simples em massa
  const sendSimpleMassMutation = useMutation({
    mutationFn: async (data: { instanceId: string, message: string, delayBetweenMessages: number, contacts: string[] }) => {
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
  const handleSendSimpleMessage = () => {
    if (!instanceId) {
      toast({
        title: "Instância não selecionada",
        description: "Selecione uma instância para enviar mensagens",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

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
      instanceId,
      message,
      delayBetweenMessages: delaySeconds,
      contacts: selectedContacts.map(contact => contact.phoneNumber)
    });
  };

  // Enviar fluxo para múltiplos contatos
  const handleSendFlowMessage = () => {
    if (!instanceId) {
      toast({
        title: "Instância não selecionada",
        description: "Selecione uma instância para enviar o fluxo",
        variant: "destructive",
      });
      return;
    }

    if (!flowId) {
      toast({
        title: "Fluxo não selecionado",
        description: "Selecione um fluxo para enviar",
        variant: "destructive",
      });
      return;
    }

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
      instanceId,
      flowId,
      delayBetweenContacts: delaySeconds,
      contacts: selectedContacts.map(contact => contact.phoneNumber)
    });
  };

  // Abrir diálogo de seleção de contatos
  const openContactSelection = () => {
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
    flow.instanceId === instanceId
  );

  // Verificar se há instâncias com fluxos configurados
  const hasFlowsForInstance = filteredFlows && filteredFlows.length > 0;

  // Mensagens em progresso?
  const isSending = sendSimpleMassMutation.isPending || sendFlowMassMutation.isPending;

  // Atualizar o hook de instância global quando o usuário selecionar uma instância
  const handleInstanceChange = (newInstanceId: string) => {
    setInstanceId(newInstanceId);
    setSelectedInstanceId(newInstanceId);
    // Limpar fluxo quando muda a instância
    if (currentTab === 'flow') {
      setFlowId("");
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">
        Envio de Mensagens em Massa
      </h1>

      {!hasConnectedInstances && !isLoadingInstances && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p className="font-bold">Atenção</p>
          </div>
          <p>Nenhuma instância conectada. Conecte uma instância do WhatsApp para enviar mensagens em massa.</p>
        </div>
      )}

      {/* Seletor de tabs simples */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setCurrentTab("simple")}
          className={`px-4 py-2 rounded-md font-medium ${
            currentTab === "simple"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Mensagem Simples
        </button>
        <button
          onClick={() => setCurrentTab("flow")}
          className={`px-4 py-2 rounded-md font-medium ${
            currentTab === "flow"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Fluxo de Mensagens
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel principal */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card rounded-lg border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">
              {currentTab === "simple" ? "Mensagem Simples" : "Fluxo de Mensagens"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {currentTab === "simple"
                ? "Envie uma mensagem de texto simples para múltiplos contatos"
                : "Envie um fluxo de mensagens pré-configurado para múltiplos contatos"}
            </p>

            <div className="space-y-4">
              {/* Seleção de instância */}
              <div>
                <label htmlFor="instance-select" className="block text-sm font-medium mb-1">
                  Instância do WhatsApp
                </label>
                <div className="flex space-x-2">
                  <select
                    id="instance-select"
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoadingInstances || isSending}
                    value={instanceId}
                    onChange={(e) => handleInstanceChange(e.target.value)}
                  >
                    <option value="">Selecione uma instância</option>
                    {connectedInstances?.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="h-10 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    onClick={() => refetchInstances()}
                    disabled={isLoadingInstances || isSending}
                  >
                    {isLoadingInstances ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 21h5v-5" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-muted-foreground">
                    Escolha a instância do WhatsApp
                  </p>
                  <p className="text-xs font-medium">
                    {hasConnectedInstances 
                      ? `${connectedInstances.length} ${connectedInstances.length === 1 ? 'instância' : 'instâncias'} disponível${connectedInstances.length === 1 ? '' : 'is'}`
                      : "Nenhuma instância conectada"}
                  </p>
                </div>
              </div>

              {currentTab === "simple" ? (
                /* Formulário de mensagem simples */
                <div>
                  <label htmlFor="message-textarea" className="block text-sm font-medium mb-1">
                    Mensagem
                  </label>
                  <textarea
                    id="message-textarea"
                    placeholder="Digite a mensagem que será enviada para todos os contatos selecionados"
                    className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSending}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A mesma mensagem será enviada para todos os contatos selecionados
                  </p>
                </div>
              ) : (
                /* Formulário de fluxo */
                <div>
                  <label htmlFor="flow-select" className="block text-sm font-medium mb-1">
                    Fluxo de Mensagens
                  </label>
                  <select
                    id="flow-select"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoadingFlows || isSending || !instanceId || !hasFlowsForInstance}
                    value={flowId}
                    onChange={(e) => setFlowId(e.target.value)}
                  >
                    <option value="">Selecione um fluxo</option>
                    {filteredFlows.map((flow: MessageFlow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {!instanceId
                      ? "Selecione uma instância primeiro"
                      : !hasFlowsForInstance
                      ? "Não há fluxos disponíveis para esta instância"
                      : "Escolha o fluxo de mensagens que será enviado para os contatos"}
                  </p>

                  {/* Detalhes do fluxo selecionado */}
                  {selectedFlowDetails && (
                    <div className="bg-muted/50 rounded-lg p-4 mt-4 space-y-2 border">
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
                </div>
              )}

              {/* Atraso entre mensagens */}
              <div>
                <label htmlFor="delay-input" className="block text-sm font-medium mb-1">
                  {currentTab === 'simple' 
                    ? 'Intervalo entre mensagens (segundos)' 
                    : 'Intervalo entre contatos (segundos)'}
                </label>
                <Input
                  id="delay-input"
                  type="number"
                  min={1}
                  max={60}
                  disabled={isSending}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 1)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {currentTab === 'simple'
                    ? 'Intervalo de espera entre cada mensagem (1-60 segundos)'
                    : 'Intervalo de espera entre o envio para cada contato (1-60 segundos)'}
                </p>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 my-4">
                <div className="flex">
                  <Info className="h-5 w-5 text-amber-600 mr-2" />
                  <div>
                    <h3 className="font-medium text-amber-800">Atenção</h3>
                    <p className="text-amber-700 text-sm">
                      {currentTab === 'simple'
                        ? 'O envio de mensagens em massa deve respeitar os limites do WhatsApp para evitar o bloqueio da sua conta.'
                        : 'O fluxo de mensagens completo será executado para cada contato selecionado. Tenha cuidado com o volume de envios para evitar bloqueios.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openContactSelection}
                  disabled={isSending || !instanceId}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Selecionar Contatos
                </Button>
                <Button
                  type="button"
                  onClick={currentTab === 'simple' ? handleSendSimpleMessage : handleSendFlowMessage}
                  disabled={
                    isSending ||
                    selectedContacts.length === 0 ||
                    !hasConnectedInstances ||
                    !instanceId ||
                    (currentTab === 'simple' ? !message : !flowId)
                  }
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      {currentTab === 'simple' ? (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar Mensagens
                        </>
                      ) : (
                        <>
                          <MessagesSquare className="mr-2 h-4 w-4" />
                          Enviar Fluxo
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Painel lateral de contatos */}
        <div className="lg:col-span-5">
          <div className="bg-card rounded-lg border shadow-sm p-6 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Contatos Selecionados</h2>
              <span className="text-sm text-muted-foreground">
                {selectedContacts.length === 0
                  ? "Nenhum contato selecionado"
                  : `${selectedContacts.length} contato(s) selecionado(s)`}
              </span>
            </div>
            
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

            {selectedContacts.length > 0 && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                {isSending && (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Processando envio...</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedContacts.length === 0 || isSending}
                  onClick={() => setSelectedContacts([])}
                  className={isSending ? "ml-auto" : ""}
                >
                  Limpar Seleção
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diálogo de seleção de contatos */}
      <ContactSelectionDialog
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
        onContactsSelected={handleContactsSelected}
        selectedContacts={selectedContacts}
        instanceId={instanceId}
      />
    </div>
  );
}