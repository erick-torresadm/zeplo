import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2, AlertTriangle, Terminal, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function DebugToolsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [testType, setTestType] = useState<string>("server");
  const [instanceId, setInstanceId] = useState<string>("");
  const [messageContent, setMessageContent] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("5511999999999");
  const [flowId, setFlowId] = useState<string>("");
  const [triggerType, setTriggerType] = useState<string>("both");

  const testErrorDetection = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const url = `/api/test/error-detection?type=${testType}`;
      console.log(`Fazendo requisição para: ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      });

      console.log(`Status da resposta: ${response.status}`);
      
      const data = await response.json();
      console.log("Dados da resposta:", data);
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${data.message || 'Erro desconhecido'}`);
      }
      
      setResponse(data);
      toast({
        title: "Teste concluído com sucesso",
        description: "Veja os detalhes abaixo",
      });
    } catch (err: any) {
      console.error("Erro durante o teste:", err);
      setError(err.message || "Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro no teste",
        description: err.message || "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  const testMessageProcessor = async () => {
    if (!instanceId || !messageContent) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "ID da instância e conteúdo da mensagem são obrigatórios",
      });
      return;
    }

    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/test/message-processor", {
        instanceId,
        messageContent,
        fromNumber: phoneNumber,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${data.message || 'Erro desconhecido'}`);
      }
      
      setResponse(data);
      toast({
        title: data.messageProcessed ? "Fluxo acionado com sucesso!" : "Mensagem processada",
        description: data.messageProcessed 
          ? "A mensagem acionou um fluxo de mensagens" 
          : "A mensagem foi processada, mas não acionou nenhum fluxo",
        variant: data.messageProcessed ? "default" : "destructive",
      });
    } catch (err: any) {
      console.error("Erro durante o teste:", err);
      setError(err.message || "Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro no teste",
        description: err.message || "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  const testFlowDirect = async () => {
    if (!flowId) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "ID do fluxo é obrigatório",
      });
      return;
    }

    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      console.log(`Testando fluxo ${flowId} para o número ${phoneNumber}`);
      
      const response = await apiRequest("POST", "/api/test-flow-direct", {
        flowId,
        phoneNumber,
      });

      const data = await response.json();
      console.log("Resposta do teste de fluxo:", data);
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${data.message || 'Erro desconhecido'}`);
      }
      
      setResponse(data);
      toast({
        title: data.success ? "Fluxo acionado com sucesso!" : "Falha ao acionar fluxo",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch (err: any) {
      console.error("Erro durante o teste:", err);
      setError(err.message || "Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro no teste",
        description: err.message || "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Ferramentas de Diagnóstico</h1>
        
        <Tabs defaultValue="webhook-flow-unified">
          <TabsList className="mb-4">
            <TabsTrigger value="webhook-flow-unified">Teste Unificado de Webhook</TabsTrigger>
            <TabsTrigger value="error-detection">Teste de Detecção de Erros</TabsTrigger>
            <TabsTrigger value="message-processor">Processador de Mensagens</TabsTrigger>
            <TabsTrigger value="flow-direct">Acionar Fluxo Diretamente</TabsTrigger>
          </TabsList>
          
          <TabsContent value="error-detection">
            <Card>
              <CardHeader>
                <CardTitle>Teste de Detecção de Erros no DevTools</CardTitle>
                <CardDescription>
                  Esta ferramenta simula diferentes tipos de erros para testar a detecção pelo DevTools do navegador.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-type">Tipo de erro</Label>
                    <Select 
                      value={testType}
                      onValueChange={setTestType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de erro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="server">Erro de Servidor (500)</SelectItem>
                        <SelectItem value="validation">Erro de Validação (400)</SelectItem>
                        <SelectItem value="auth">Erro de Autenticação (401)</SelectItem>
                        <SelectItem value="notfound">Recurso Não Encontrado (404)</SelectItem>
                        <SelectItem value="timeout">Timeout (30 segundos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setResponse(null);
                  setError(null);
                }}>
                  Limpar Resultados
                </Button>
                <Button onClick={testErrorDetection} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    "Iniciar Teste"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="message-processor">
            <Card>
              <CardHeader>
                <CardTitle>Teste do Processador de Mensagens</CardTitle>
                <CardDescription>
                  Esta ferramenta permite testar o processamento de mensagens e acionamento de fluxos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="instance-id">ID da Instância</Label>
                    <Input
                      id="instance-id"
                      placeholder="ID da instância (GUID)"
                      value={instanceId}
                      onChange={(e) => setInstanceId(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message-content">Conteúdo da Mensagem</Label>
                    <Textarea
                      id="message-content"
                      placeholder="Digite o conteúdo da mensagem aqui"
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Número de Telefone</Label>
                    <Input
                      id="phone-number"
                      placeholder="Número de telefone (padrão: 5511999999999)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setResponse(null);
                  setError(null);
                }}>
                  Limpar Resultados
                </Button>
                <Button onClick={testMessageProcessor} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Processar Mensagem"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="flow-direct">
            <Card>
              <CardHeader>
                <CardTitle>Acionar Fluxo Diretamente</CardTitle>
                <CardDescription>
                  Esta ferramenta permite acionar um fluxo de mensagens diretamente, sem a necessidade de receber uma mensagem com a palavra-chave.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="flow-id">ID do Fluxo</Label>
                    <Input
                      id="flow-id"
                      placeholder="ID do fluxo (GUID)"
                      value={flowId}
                      onChange={(e) => setFlowId(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone-number-flow">Número de Telefone</Label>
                    <Input
                      id="phone-number-flow"
                      placeholder="Número de telefone (padrão: 5511999999999)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setResponse(null);
                  setError(null);
                }}>
                  Limpar Resultados
                </Button>
                <Button onClick={testFlowDirect} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Acionando...
                    </>
                  ) : (
                    "Acionar Fluxo"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Exibe resultado ou erro */}
        {(response || error) && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-4">Resultado</h2>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            {response && (
              <div className="p-4 rounded-md border bg-card">
                <div className="flex items-center space-x-2 mb-2">
                  <Terminal className="h-5 w-5" />
                  <span className="font-semibold">Resposta do Servidor</span>
                </div>
                <pre className="bg-background p-4 rounded overflow-x-auto">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}