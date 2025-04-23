/**
 * Serviço para enviar dados para webhooks externos
 * 
 * Este serviço envia dados para endpoints externos quando palavras-chave
 * são detectadas no processamento de mensagens.
 * Usa curl para requisições HTTP para garantir que a requisição seja realizada
 * mesmo que o axios tenha problemas.
 */

import axios from 'axios';
import { log } from './vite';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// URL do webhook externo que foi configurado
// IMPORTANTE: Mudamos para método GET conforme verificação de disponibilidade
// Observação: Foi verificado que o endpoint retorna 404, mas continuaremos enviando
// conforme especificado pelo cliente. Em ambiente de produção, isso deve ser validado.
// Vamos usar um endpoint local para testes
const EXTERNAL_WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:5000/api/webhook-callback';

/**
 * Envia dados para o webhook externo quando uma palavra-chave é detectada,
 * usando explicitamente curl para garantir que a requisição seja feita
 * 
 * @param flowData Os dados do fluxo que foi acionado
 * @param messageData Os dados da mensagem recebida
 * @param instanceData Dados da instância que processou a mensagem
 */
export async function sendToExternalWebhook(
  flowData: any,
  messageData: { 
    phoneNumber: string;
    messageContent: string;
    messageId?: string;
    timestamp?: number;
  },
  instanceData: {
    id: string;
    name: string;
    status: string;
  }
): Promise<any> {
  try {
    // Log destacado com emoji para fácil visualização
    log(`[External Webhook] 🚀 Enviando dados para webhook externo via CURL`, 'webhook');
    
    // Formata os dados no formato específico solicitado
    const payload = {
      // Formato específico solicitado
      instanceId: instanceData.id,
      instanceName: instanceData.name,
      status: instanceData.status,
      keyword: flowData.keyword,
      numero: messageData.phoneNumber,
      mensagem: messageData.messageContent,
      
      // Inclui a seção conversation conforme solicitado
      conversation: {
        flowId: flowData.id || '',
        flowName: flowData.name || '',
        keyword: flowData.keyword,
        text: typeof flowData.messages === 'string' 
          ? flowData.messages 
          : Array.isArray(flowData.messages) 
            ? flowData.messages.map((m: any) => typeof m === 'string' ? m : m.text || m.caption || '').join(' ') 
            : JSON.stringify(flowData.messages)
      }
    };
    
    log(`[External Webhook] Payload: ${JSON.stringify(payload)}`, 'webhook');
    
    // Convertemos o payload para parâmetros de query string
    const queryParams = new URLSearchParams();
    // Adicionamos versão simplificada dos dados principais como parâmetros
    queryParams.append('instanceId', instanceData.id);
    queryParams.append('keyword', flowData.keyword || '');
    queryParams.append('numero', messageData.phoneNumber);
    queryParams.append('mensagem', messageData.messageContent);
    // Adicionamos a conversa como JSON encoded para manter a estrutura
    queryParams.append('conversation', JSON.stringify(payload.conversation));
    
    // Adicionamos detalhes adicionais para melhorar diagnóstico
    queryParams.append('flowId', flowData.id || '');
    queryParams.append('flowName', flowData.name || '');
    queryParams.append('timestamp', String(new Date().getTime()));
    
    // URL com query parameters
    const fullUrl = `${EXTERNAL_WEBHOOK_URL}?${queryParams.toString()}`;
    log(`[External Webhook] Enviando CURL GET para URL: ${fullUrl}`, 'webhook');
    
    // NOVA IMPLEMENTAÇÃO: Use curl explicitamente
    try {
      // Log de destaque para CURL
      log(`[External Webhook] 🔄 Executando CURL: curl -s "${fullUrl}"`, 'webhook');
      
      // Execute curl com um timeout de 5 segundos
      const { stdout, stderr } = await execAsync(`curl -s -m 5 "${fullUrl}"`);
      
      // Registra o resultado da chamada CURL
      if (stdout) {
        log(`[External Webhook] ✅ Resposta CURL: ${stdout}`, 'webhook');
        console.log(`[FLUXO SUCCESS] ✓ Webhook enviado com sucesso para palavra-chave "${flowData.keyword}"!`);
      }
      if (stderr) {
        log(`[External Webhook] ⚠️ Erro CURL: ${stderr}`, 'webhook');
      }
      
      return {
        success: true,
        method: 'curl',
        data: stdout,
        error: stderr
      };
    } catch (curlError: any) {
      log(`[External Webhook] ❌ Erro ao executar CURL: ${curlError.message}`, 'webhook');
      
      // Tentativa de fallback com axios
      log(`[External Webhook] Tentando fallback com axios...`, 'webhook');
    }
    
    // Fallback para axios se curl falhar
    const response = await axios.get(fullUrl, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 5000 // Timeout de 5 segundos
    });
    
    log(`[External Webhook] Resposta axios: ${response.status} ${JSON.stringify(response.data)}`, 'webhook');
    console.log(`[FLUXO SUCCESS] ✓ Webhook enviado com sucesso para palavra-chave "${flowData.keyword}"!`);
    
    return {
      success: true,
      method: 'axios',
      statusCode: response.status,
      data: response.data
    };
  } catch (error: any) {
    const errorMessage = error.response 
      ? `${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.message || 'Erro desconhecido';
    
    log(`[External Webhook] Erro ao enviar para webhook externo: ${errorMessage}`, 'webhook');
    console.log(`[FLUXO ERROR] ❌ Falha ao enviar webhook para palavra-chave "${flowData.keyword}": ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}