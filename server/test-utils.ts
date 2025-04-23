import { evolutionApi } from './evolution-api';
import { log } from './vite';
import { storage } from './storage';

/**
 * Utilitário para testar o envio direto de mensagens via Evolution API
 * Útil para depuração sem depender dos fluxos de mensagens
 */
export async function testDirectMessageSend(
  instanceId: string,
  phoneNumber: string,
  message: string,
  forceProcess: boolean = true
): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    log(`[TestUtils] Iniciando teste direto de envio de mensagem para instância ${instanceId}`, 'test');
    
    // Buscar a instância
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      log(`[TestUtils] Instância não encontrada: ${instanceId}`, 'test');
      return {
        success: false,
        message: 'Instância não encontrada'
      };
    }
    
    log(`[TestUtils] Instância encontrada: ${instance.name}, status: ${instance.status}`, 'test');
    
    // Verifica se a instância está conectada
    if (instance.status !== "connected" && !forceProcess) {
      return {
        success: false,
        message: "A instância não está conectada. Conecte-a primeiro ou use a opção de forçar processamento."
      };
    }
    
    if (instance.status !== "connected" && forceProcess) {
      log(`[TestUtils] Instância não está conectada, mas forceProcess=true. Continuando mesmo assim...`, 'test');
    }
    
    // Normaliza o número de telefone
    let formattedPhone = phoneNumber.replace(/[+@]/g, '').trim();
    if (formattedPhone.includes('@')) {
      formattedPhone = formattedPhone.split('@')[0];
    }
    
    // Certifica-se que números brasileiros têm o código do país
    if (!formattedPhone.startsWith('55') && formattedPhone.length <= 11) {
      formattedPhone = `55${formattedPhone}`;
      log(`[TestUtils] Número formatado para padrão Brasil: ${formattedPhone}`, 'test');
    }
    
    // Enviar a mensagem diretamente
    log(`[TestUtils] Tentando enviar mensagem diretamente via Evolution API: "${message}" para ${formattedPhone} usando instância ${instance.name}`, 'test');
    
    // Log detalhado do payload para debug
    log(`[TestUtils] Detalhes do envio:
    - Nome da instância: ${instance.name}
    - Número destino: ${formattedPhone}
    - Mensagem: ${message}`, 'test');
    
    const response = await evolutionApi.sendMessage(
      instance.name,
      formattedPhone,
      message
    );
    
    // Log detalhado da resposta
    log(`[TestUtils] Resposta da API de envio: ${JSON.stringify(response)}`, 'test');
    
    if (!response.status) {
      return {
        success: false,
        message: `Erro ao enviar mensagem: ${response.message}`,
        details: response
      };
    }
    
    // Registrar atividade (opcional, se userId for fornecido)
    log(`[TestUtils] Mensagem enviada com sucesso para ${formattedPhone}`, 'test');
    
    return {
      success: true,
      message: 'Mensagem enviada com sucesso',
      details: response
    };
  } catch (error: any) {
    log(`[TestUtils] Erro ao enviar mensagem: ${error.message}`, 'test');
    console.error('[TestUtils] Erro completo:', error);
    
    return {
      success: false,
      message: `Erro inesperado ao enviar mensagem: ${error.message}`
    };
  }
}