import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Instance } from "@shared/schema";
import { InstanceCard } from "@/components/whatsapp/instance-card";
import { AddInstanceDialog } from "@/components/whatsapp/add-instance-dialog";
import { DirectMessageTestDialog } from "@/components/whatsapp/direct-message-test-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, MessageSquare, Users, Globe } from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function InstancesPage() {
  // Estado para controlar os diálogos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showQrDialogOpen, setShowQrDialogOpen] = useState(false);
  const [testMessageDialogOpen, setTestMessageDialogOpen] = useState(false);
  const [qrExpiryTime, setQrExpiryTime] = useState<number | null>(null);
  const [qrRefreshInterval, setQrRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const { data: instances, isLoading } = useQuery<Instance[]>({
    queryKey: ["/api/instances"],
  });
  
  // Função para verificar o estado de todas as instâncias 
  const checkAllInstancesState = useCallback(async () => {
    if (!instances || instances.length === 0) return;
    
    const connectingInstances = instances.filter(inst => inst.status === "connecting");
    
    // Se não há instâncias no estado "connecting", não precisamos verificar
    if (connectingInstances.length === 0) return;
    
    // Verificar cada instância que está no estado "connecting"
    for (const instance of connectingInstances) {
      try {
        const response = await fetch(`/api/instances/${instance.id}/connection-state`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          // Se a resposta for bem-sucedida, apenas invalidamos a consulta para atualizar a lista
          queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
        }
      } catch (error) {
        console.error(`Error checking state for instance ${instance.id}:`, error);
      }
    }
  }, [instances, queryClient]);
  
  // Efeito para verificar o estado das instâncias periodicamente
  useEffect(() => {
    // Verificar imediatamente ao carregar ou quando a lista de instâncias mudar
    checkAllInstancesState();
    
    // Configurar verificação periódica a cada 10 segundos
    const intervalId = setInterval(checkAllInstancesState, 10000);
    
    // Limpar o intervalo ao desmontar o componente
    return () => clearInterval(intervalId);
  }, [checkAllInstancesState]);

  const handleAddInstance = () => {
    setDialogOpen(true);
  };

  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Função para verificar se a instância selecionada está conectada
  const checkInstanceConnection = useCallback(async () => {
    if (!selectedInstance) return;
    
    try {
      const response = await fetch(`/api/instances/${selectedInstance.id}/connection-state`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        // Se a instância estiver conectada, fechar o diálogo
        if (data.status === "connected") {
          setShowQrDialogOpen(false);
          toast({
            title: "✅ Conexão bem-sucedida",
            description: `A instância ${selectedInstance.name} foi conectada com sucesso.`,
          });
          // Limpar o temporizador
          if (qrRefreshInterval) {
            clearInterval(qrRefreshInterval);
            setQrRefreshInterval(null);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
        }
        
        return data.status;
      }
    } catch (error) {
      console.error('Error checking connection state:', error);
    }
    
    return null;
  }, [selectedInstance, qrRefreshInterval, queryClient, toast]);
  
  // Função para gerar novo QR code quando expirar
  const refreshQrCode = useCallback(async () => {
    if (!selectedInstance) return;
    
    setIsLoadingQr(true);
    try {
      const response = await fetch(`/api/instances/${selectedInstance.id}/qrcode`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh QR code');
      }
      
      const data = await response.json();
      
      if (data && data.qrcode) {
        let qrCode = data.qrcode;
        if (!qrCode.startsWith('data:image/')) {
          qrCode = `data:image/png;base64,${qrCode}`;
        }
        setQrCodeData(qrCode);
        // Resetar o temporizador
        setQrExpiryTime(60);
      }
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      toast({
        title: "Erro ao atualizar QR code",
        description: "Não foi possível gerar um novo QR code. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQr(false);
    }
  }, [selectedInstance, toast]);
  
  // Efeito para gerenciar o temporizador do QR code
  useEffect(() => {
    if (!showQrDialogOpen) {
      // Limpar o temporizador quando o diálogo é fechado
      if (qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
        setQrRefreshInterval(null);
      }
      setQrExpiryTime(null);
      return;
    }
    
    // Iniciar o temporizador quando o diálogo é aberto
    if (showQrDialogOpen && qrCodeData && !qrExpiryTime && !qrRefreshInterval) {
      setQrExpiryTime(60); // 60 segundos para expirar
      
      // Verificar a conexão a cada 5 segundos
      const intervalId = setInterval(() => {
        // Verificar se a instância conectou
        checkInstanceConnection();
        
        // Decrementar o temporizador
        setQrExpiryTime(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            // QR Code expirou, gerar um novo
            refreshQrCode();
            return 60; // Reiniciar o temporizador
          }
          return prev - 1;
        });
      }, 1000);
      
      setQrRefreshInterval(intervalId);
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [showQrDialogOpen, qrCodeData, qrExpiryTime, qrRefreshInterval, checkInstanceConnection, refreshQrCode]);

  const handleQrCodeRequest = async (instance: Instance) => {
    try {
      setSelectedInstance(instance);
      setIsLoadingQr(true);
      
      // Solicitar o QR code da API
      const response = await fetch(`/api/instances/${instance.id}/qrcode`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR code');
      }
      
      const data = await response.json();
      
      // Verificar se o QR code está presente e no formato correto
      if (data && data.qrcode) {
        // Se o QR code não começar com "data:image/", adicionamos o prefixo
        let qrCode = data.qrcode;
        if (!qrCode.startsWith('data:image/')) {
          qrCode = `data:image/png;base64,${qrCode}`;
        }
        setQrCodeData(qrCode);
        setShowQrDialogOpen(true);
        // Inicia o contador de expiração
        setQrExpiryTime(60);
      } else {
        throw new Error('QR code not available');
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
      toast({
        title: "Erro ao obter QR code",
        description: "Não foi possível carregar o QR code. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQr(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen">
      <div className="page-container">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Instâncias WhatsApp</h1>
            <p className="text-slate-500 mt-2">Gerencie suas instâncias do WhatsApp conectadas à API</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleAddInstance} 
              variant="default"
              className="shadow-sm bg-primary hover:bg-primary/90"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nova Instância
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary/70" />
            <p className="text-slate-500">Carregando instâncias...</p>
          </div>
        ) : instances && instances.length > 0 ? (
          <div className="dashboard-grid">
            {instances.map((instance) => (
              <InstanceCard 
                key={instance.id} 
                instance={instance}
                onQrCodeRequest={handleQrCodeRequest}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-10 text-center max-w-md mx-auto">
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl flex items-center justify-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Nenhuma Instância Encontrada</h3>
            <p className="text-slate-600 mb-6">
              Crie sua primeira instância do WhatsApp para começar a automatizar mensagens.
            </p>
            <Button 
              onClick={handleAddInstance} 
              size="lg"
              className="shadow-sm bg-primary hover:bg-primary/90"
            >
              <Plus className="h-5 w-5 mr-2" />
              Criar Instância
            </Button>
          </div>
        )}
      </div>

      <AddInstanceDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
      />

      {/* QR Code Dialog */}
      <Dialog open={showQrDialogOpen} onOpenChange={setShowQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-base">
              Escaneie este QR code com o aplicativo WhatsApp no seu celular para conectar a instância.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-6 py-4">
            {isLoadingQr ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-14 w-14 animate-spin text-primary mb-4" />
                <p className="text-slate-600">Gerando QR Code...</p>
              </div>
            ) : qrCodeData ? (
              <div className="relative">
                <div className="bg-white border-2 border-primary/20 p-4 rounded-xl shadow-md">
                  <img 
                    src={qrCodeData} 
                    alt="WhatsApp QR Code" 
                    className="w-72 h-72"
                  />
                  
                  {qrExpiryTime !== null && (
                    <div className="absolute top-0 right-0 bg-slate-800 text-white rounded-full w-10 h-10 -mt-3 -mr-3 flex items-center justify-center shadow-lg border-2 border-white">
                      <span className="text-sm font-bold">{qrExpiryTime}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 text-center">
                  <p className="text-sm text-slate-500">
                    {qrExpiryTime !== null 
                      ? `QR Code expira em ${qrExpiryTime} segundos. Será renovado automaticamente.` 
                      : 'QR Code pronto para escaneamento.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-red-50 rounded-lg p-4 w-full">
                <p className="text-red-600 font-medium">Não foi possível carregar o QR code. Tente novamente.</p>
              </div>
            )}
            
            <div className="bg-slate-50 rounded-lg p-4 w-full">
              <div className="text-sm text-slate-600 mb-4">
                <ol className="space-y-2 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></li>
                  <li>Toque em <strong>Aparelhos vinculados</strong></li>
                  <li>Aponte a câmera para este QR Code</li>
                </ol>
              </div>
              
              <div className="flex justify-between items-center">
                <Button 
                  variant="outline"
                  onClick={() => setShowQrDialogOpen(false)}
                >
                  Cancelar
                </Button>
                
                <Button 
                  onClick={() => {
                    if (selectedInstance) {
                      const doneConnect = async () => {
                        try {
                          await fetch(`/api/instances/${selectedInstance.id}/status`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ status: 'connecting' }),
                            credentials: 'include',
                          });
                          // Fechar o diálogo e atualizar as instâncias
                          setShowQrDialogOpen(false);
                          // Notificar usuário
                          console.log('Connection started, verifying connection status...');
                          // Aguarde 1 segundo para permitir que o backend atualize o status
                          setTimeout(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
                          }, 1000);
                        } catch (error) {
                          console.error('Error connecting instance:', error);
                        }
                      };
                      doneConnect();
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <div className="flex items-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    QR Code Escaneado
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Direct Message Dialog */}
      <DirectMessageTestDialog
        open={testMessageDialogOpen}
        onOpenChange={setTestMessageDialogOpen}
      />
    </div>
  );
}