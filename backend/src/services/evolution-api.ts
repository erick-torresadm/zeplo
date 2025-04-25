import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { log } from './vite';

// Configuração da API
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

// Configurar axios com cabeçalhos padrão
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'apikey': API_KEY
  },
  validateStatus: () => true, // Não lance erros para respostas não 2xx
});


// Interface para resposta genérica da API
interface ApiResponse {
  status: boolean;
  message: string;
  [key: string]: any;
}

// Interface para os detalhes da instância na API
interface EvolutionInstance {
  instance: {
    instanceName: string;
    owner: string;
    profileName: string;
    profilePictureUrl: string;
    serverUrl: string;
    status: string;
    apikey?: string;
    tokenjwt?: string;
  };
}

/**
 * Funções para comunicação com a Evolution API
 */
export const evolutionApi = {
  /**
   * Retorna a instância configurada do axios para acesso direto à API
   */
  getApi(): typeof api {
    return api;
  },
  /**
   * Obtém todas as instâncias disponíveis na Evolution API
   */
  async getAllInstances(): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Buscando todas as instâncias`, 'evolution-api');
      // Conforme a documentação, usamos fetchInstances
      const response = await api.get('/instance/fetchInstances');
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao buscar instâncias: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || 'Erro ao buscar instâncias',
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Instâncias encontradas com sucesso',
        instances: Array.isArray(response.data) ? response.data : [] // A resposta é uma array de instâncias
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao buscar instâncias: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao buscar instâncias',
        error
      };
    }
  },

  /**
   * Obtém informações sobre uma instância específica
   */
  async getInstance(instanceName: string): Promise<ApiResponse> {
    try {
      // Garante que o nome da instância está em minúsculas para compatibilidade com a API
      const formattedInstanceName = instanceName.toLowerCase();
      log(`[Evolution API] Buscando instância: ${formattedInstanceName}`, 'evolution-api');
      // Na nova API, verificar o status da instância
      const response = await api.get(`/instance/connectionState/${formattedInstanceName}`);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao buscar instância ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || `Erro ao buscar instância ${instanceName}`,
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Instância encontrada com sucesso',
        instance: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao buscar instância ${instanceName}: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || `Erro ao buscar instância ${instanceName}`,
        error
      };
    }
  },

  /**
   * Cria uma nova instância na Evolution API
   */
  async createInstance(instanceName: string): Promise<ApiResponse> {
    try {
      // Garante que o nome da instância está em minúsculas para compatibilidade com a API
      const formattedInstanceName = instanceName.toLowerCase();
      log(`[Evolution API] Criando nova instância: ${formattedInstanceName}`, 'evolution-api');
      
      // Payload para criação da instância conforme nova API
      const payload = {
        instanceName,
        integration: "WHATSAPP-BAILEYS"
      };
      
      const response = await api.post('/instance/create', payload);
      
      if (response.status !== 201) {
        // Se retornar 403, pode ser porque a instância já existe
        if (response.status === 403 && response.data?.response?.message?.[0]?.includes("already in use")) {
          log(`[Evolution API] Instância ${instanceName} já existe`, 'evolution-api');
          return {
            status: true,
            message: 'Instância já existente',
            instance: { instanceName }
          };
        }
        
        log(`[Evolution API] Erro ao criar instância: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message?.[0] || 'Erro ao criar instância',
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Instância criada com sucesso',
        instance: response.data.instance
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao criar instância: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao criar instância',
        error
      };
    }
  },

  /**
   * Conecta uma instância existente gerando um QR code
   */
  async connectInstance(instanceName: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Conectando instância: ${instanceName}`, 'evolution-api');
      
      // De acordo com a documentação, precisamos usar GET para conectar e receber o QR code
      const response = await api.get(`/instance/connect/${instanceName}`);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao conectar instância ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || `Erro ao conectar instância ${instanceName}`,
          error: response.data
        };
      }
      
      // Se a resposta incluir o base64 do QR code, vamos retorná-lo diretamente
      if (response.data && response.data.base64) {
        return {
          status: true,
          message: 'QR code obtido com sucesso',
          qrcode: response.data.base64,
          instance: response.data
        };
      }
      
      return {
        status: true,
        message: 'Instância conectada com sucesso',
        instance: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao conectar instância ${instanceName}: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || `Erro ao conectar instância ${instanceName}`,
        error
      };
    }
  },

  /**
   * Obtém o QR Code para uma instância
   */
  async getQrCode(instanceName: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Obtendo QR Code para instância: ${instanceName}`, 'evolution-api');
      
      // Na nova API, isso retorna o QR code
      const response = await api.get(`/instance/qrcode/${instanceName}?type=base64`);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao obter QR code para ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || `Erro ao obter QR code para ${instanceName}`,
          error: response.data
        };
      }
      
      // Verifica se o QR code foi obtido no formato correto da nova API
      if (response.data && response.data.qrcode) {
        return {
          status: true,
          message: 'QR code obtido com sucesso',
          qrcode: response.data.qrcode
        };
      } else {
        log(`[Evolution API] QR code não encontrado na resposta: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: 'QR code não disponível',
          error: response.data
        };
      }
    } catch (error: any) {
      log(`[Evolution API] Erro ao obter QR code para ${instanceName}: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || `Erro ao obter QR code para ${instanceName}`,
        error
      };
    }
  },

  /**
   * Desconecta uma instância
   */
  async disconnectInstance(instanceName: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Desconectando instância: ${instanceName}`, 'evolution-api');
      
      // De acordo com a documentação, usamos DELETE para fazer logout
      const response = await api.delete(`/instance/logout/${instanceName}`);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao desconectar instância ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || `Erro ao desconectar instância ${instanceName}`,
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Instância desconectada com sucesso',
        instance: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao desconectar instância ${instanceName}: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || `Erro ao desconectar instância ${instanceName}`,
        error
      };
    }
  },

  /**
   * Verifica o estado de conexão da instância
   */
  async checkConnectionState(instanceName: string): Promise<ApiResponse> {
    try {
      //log(`[Evolution API] Verificando estado de conexão da instância: ${instanceName}`, 'evolution-api');
      
      // De acordo com a documentação, usamos GET para verificar o estado
      const response = await api.get(`/instance/connectionState/${instanceName}`);
      
      // Log detalhado da resposta para debug
      //log(`[Evolution API] Resposta da verificação de estado para ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao verificar estado da instância ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || `Erro ao verificar estado da instância ${instanceName}`,
          error: response.data
        };
      }
      
      // A estrutura da resposta pode variar, então verificamos todos os locais possíveis
      let state = 'disconnected';
      
      // Verifica todos os possíveis locais onde o estado pode estar na resposta
      if (response.data?.instance?.state) {
        state = response.data.instance.state;
      } else if (response.data?.state) {
        state = response.data.state;
      } else if (response.data?.status) {
        state = response.data.status;
      }
      
      // Na API Evolution v2, 'open' significa que a instância está conectada
      // Também tratar valores booleanos 'true' (string ou boolean) como conectado
      if (state === 'open' || state === true || state === 'true') {
        state = 'connected';
      }
      
      //log(`[Evolution API] Estado detectado para ${instanceName}: ${state}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Estado da instância verificado com sucesso',
        state: state,
        instance: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao verificar estado da instância ${instanceName}: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || `Erro ao verificar estado da instância ${instanceName}`,
        error,
        state: 'disconnected'
      };
    }
  },

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceName: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Deletando instância: ${instanceName}`, 'evolution-api');
      
      // Na nova API, ainda usamos DELETE para remover a instância
      const response = await api.delete(`/instance/delete/${instanceName}`);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao deletar instância ${instanceName}: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || `Erro ao deletar instância ${instanceName}`,
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Instância deletada com sucesso',
        instance: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao deletar instância ${instanceName}: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || `Erro ao deletar instância ${instanceName}`,
        error
      };
    }
  },

  /**
   * Envia uma mensagem de texto através de uma instância
   * Atualizado para Evolution API v2 conforme a documentação: https://doc.evolution-api.com/v2/api-reference/send-messages/send-text
   */
  async sendMessage(
    instanceName: string, 
    phoneNumber: string, 
    message: string, 
    options?: {
      quoted?: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
        participant?: string;
        message?: { conversation: string };
      };
      linkPreview?: boolean;
      mentionsEveryOne?: boolean;
      mentioned?: string[];
      delay?: number;
    }
  ): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Enviando mensagem para ${phoneNumber} via instância ${instanceName}`, 'evolution-api');
      console.log(`[Evolution API] Enviando mensagem para ${phoneNumber} via instância ${instanceName}`);
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Verifica se o número já possui código de país
      // Trata diversos formatos: números internacionais ou brasileiros com ou sem código do país
      if (!formattedPhone.match(/^\d{10,15}$/)) {
        log(`[Evolution API] Formato de número inválido: ${formattedPhone}`, 'evolution-api');
        console.log(`[Evolution API] ATENÇÃO: Formato de número inválido: ${formattedPhone}`);
      } else if (!formattedPhone.match(/^[1-9]\d{1,3}\d{8,11}$/)) {
        // Provavelmente é um número sem código de país, assumimos Brasil (55) por padrão
        if (formattedPhone.length >= 8 && formattedPhone.length <= 11) {
          log(`[Evolution API] Adicionando código do Brasil (55) ao número: ${formattedPhone}`, 'evolution-api');
          formattedPhone = `55${formattedPhone}`;
        }
      }
      
      // Formatação conforme a documentação da API v2 (atualizada)
      // https://doc.evolution-api.com/v2/api-reference/send-messages/send-text
      
      // Garantimos que o texto é enviado exatamente como foi recebido,
      // sem modificações ou formatações, para preservar o texto exato digitado pelo usuário
      // incluindo espaçamentos, quebras de linha, etc.
      // Este texto será exibido no campo "conversation" para o destinatário
      const textoExato = message;
      log(`[Evolution API] Texto exato a ser enviado: "${textoExato}"`, 'evolution-api');
      
      const payload: any = {
        number: formattedPhone,
        text: textoExato, // Usamos o texto exatamente como foi recebido
        options: {
          delay: options?.delay || 1200, // Delay em milissegundos
          presence: "composing" // Status de "digitando..." antes de enviar
        }
      };
      
      // Adiciona as opções avançadas se fornecidas
      if (options?.quoted) {
        payload.options.quoted = options.quoted;
      }
      
      if (options?.linkPreview !== undefined) {
        payload.options.linkPreview = options.linkPreview;
      }
      
      if (options?.mentionsEveryOne !== undefined) {
        payload.options.mentionsEveryOne = options.mentionsEveryOne;
      }
      
      if (options?.mentioned && options.mentioned.length > 0) {
        payload.options.mentioned = options.mentioned;
      }
      
      log(`[Evolution API] Enviando mensagem com payload: ${JSON.stringify(payload)}`, 'evolution-api');
      console.log(`[Evolution API] PAYLOAD: ${JSON.stringify(payload, null, 2)}`);
      
      // Endpoint atualizado conforme documentação v2
      const response = await api.post(`/message/sendText/${instanceName}`, payload);
      
      if (response.status !== 201 && response.status !== 200) {
        log(`[Evolution API] Erro ao enviar mensagem: ${JSON.stringify(response.data)}`, 'evolution-api');
        console.error(`[Evolution API] ERRO ao enviar mensagem:`, response.data);
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao enviar mensagem',
          error: response.data
        };
      }
      
      log(`[Evolution API] Resposta ao enviar mensagem: ${JSON.stringify(response.data)}`, 'evolution-api');
      console.log(`[Evolution API] SUCESSO ao enviar mensagem:`, response.data);
      
      // Gera um ID único para a mensagem
      const messageId = uuidv4().replace(/-/g, '').toUpperCase();
      
      // Timestamp atual em segundos
      const messageTimestamp = Math.floor(Date.now() / 1000);
      
      // Formato específico de resposta solicitado
      const responseFormat = {
        success: true,
        statusCode: 201,
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: messageId
          },
          pushName: "",
          status: "PENDING",
          message: {
            conversation: textoExato // Garantimos que o texto exato do usuário seja preservado na resposta
          },
          contextInfo: null,
          messageType: "conversation",
          messageTimestamp: messageTimestamp,
          instanceId: response.data?.key?.id || uuidv4().replace(/-/g, ''),
          source: "unknown"
        },
        instanceName: instanceName,
        phoneNumber: formattedPhone
      };
      
      log(`[Evolution API] Resposta formatada: ${JSON.stringify(responseFormat)}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Mensagem enviada com sucesso',
        result: responseFormat
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao enviar mensagem: ${error.message}`, 'evolution-api');
      console.error(`Detalhes do erro ao enviar mensagem:`, error);
      return {
        status: false,
        message: error.message || 'Erro ao enviar mensagem',
        error
      };
    }
  },
  
  /**
   * Envia uma imagem através de uma instância
   * @param instanceName Nome da instância
   * @param phoneNumber Número do destinatário
   * @param imageUrl URL da imagem ou caminho local (base64 com prefixo data:image)
   * @param caption Legenda opcional para a imagem
   * @param options Opções adicionais
   * Baseado na documentação: https://doc.evolution-api.com/v2/api-reference/send-messages/send-media
   */
  async sendImageMessage(
    instanceName: string, 
    phoneNumber: string, 
    imageUrl: string,
    caption: string = '',
    options: any = {}
  ): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Enviando imagem para ${phoneNumber} via instância ${instanceName}`, 'evolution-api');
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Formatação conforme a documentação da API v2
      const payload: any = {
        number: formattedPhone,
        options: {
          delay: options?.delay || 1200,
          presence: "composing"
        },
        mediaMessage: {
          mediatype: "image",
          media: imageUrl, // URL ou base64
          caption: caption,
          fileName: options?.fileName || `image_${Date.now()}.jpg`
        }
      };
      
      // Adiciona as opções avançadas se fornecidas
      if (options?.quoted) {
        payload.options.quoted = options.quoted;
      }
      
      log(`[Evolution API] Enviando imagem com payload: ${JSON.stringify(payload)}`, 'evolution-api');
      
      // Endpoint para enviar mídia
      const response = await api.post(`/message/sendMedia/${instanceName}`, payload);
      
      if (response.status !== 201 && response.status !== 200) {
        log(`[Evolution API] Erro ao enviar imagem: ${JSON.stringify(response.data)}`, 'evolution-api');
        console.error(`[Evolution API] ERRO ao enviar imagem:`, response.data);
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao enviar imagem',
          error: response.data
        };
      }
      
      log(`[Evolution API] Resposta ao enviar imagem: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      // Gera um ID único para a mensagem
      const messageId = uuidv4().replace(/-/g, '').toUpperCase();
      
      // Timestamp atual em segundos
      const messageTimestamp = Math.floor(Date.now() / 1000);
      
      // Formato específico de resposta solicitado
      const responseFormat = {
        success: true,
        statusCode: 201,
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: messageId
          },
          pushName: "",
          status: "PENDING",
          message: {
            conversation: caption || "Imagem enviada"
          },
          contextInfo: null,
          messageType: "image",
          messageTimestamp: messageTimestamp,
          instanceId: response.data?.key?.id || uuidv4().replace(/-/g, ''),
          source: "unknown"
        },
        instanceName: instanceName,
        phoneNumber: formattedPhone
      };
      
      log(`[Evolution API] Resposta formatada para imagem: ${JSON.stringify(responseFormat)}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Imagem enviada com sucesso',
        result: responseFormat
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao enviar imagem: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao enviar imagem',
        error
      };
    }
  },
  
  /**
   * Envia um áudio através de uma instância
   * @param instanceName Nome da instância
   * @param phoneNumber Número do destinatário
   * @param audioUrl URL do áudio ou caminho local (base64 com prefixo data:audio)
   * @param options Opções adicionais
   * Baseado na documentação: https://doc.evolution-api.com/v2/api-reference/send-messages/send-media
   */
  async sendAudioMessage(
    instanceName: string, 
    phoneNumber: string, 
    audioUrl: string,
    options: any = {}
  ): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Enviando áudio para ${phoneNumber} via instância ${instanceName}`, 'evolution-api');
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Formatação conforme a documentação da API v2
      const payload: any = {
        number: formattedPhone,
        options: {
          delay: options?.delay || 1200,
          presence: "recording" // Para áudio, mostra "gravando..."
        },
        mediaMessage: {
          mediatype: "audio",
          media: audioUrl, // URL ou base64
          fileName: options?.fileName || `audio_${Date.now()}.mp3`
        }
      };
      
      // Adiciona as opções avançadas se fornecidas
      if (options?.quoted) {
        payload.options.quoted = options.quoted;
      }
      
      // Define se é uma nota de voz (áudio de gravação) ou um arquivo de áudio
      if (options?.ptt !== undefined) {
        payload.mediaMessage.ptt = options.ptt;
      }
      
      log(`[Evolution API] Enviando áudio com payload: ${JSON.stringify(payload)}`, 'evolution-api');
      
      // Endpoint para enviar mídia
      const response = await api.post(`/message/sendMedia/${instanceName}`, payload);
      
      if (response.status !== 201 && response.status !== 200) {
        log(`[Evolution API] Erro ao enviar áudio: ${JSON.stringify(response.data)}`, 'evolution-api');
        console.error(`[Evolution API] ERRO ao enviar áudio:`, response.data);
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao enviar áudio',
          error: response.data
        };
      }
      
      log(`[Evolution API] Resposta ao enviar áudio: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      // Gera um ID único para a mensagem
      const messageId = uuidv4().replace(/-/g, '').toUpperCase();
      
      // Timestamp atual em segundos
      const messageTimestamp = Math.floor(Date.now() / 1000);
      
      // Formato específico de resposta solicitado
      const responseFormat = {
        success: true,
        statusCode: 201,
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: messageId
          },
          pushName: "",
          status: "PENDING",
          message: {
            conversation: "Áudio enviado"
          },
          contextInfo: null,
          messageType: "audio",
          messageTimestamp: messageTimestamp,
          instanceId: response.data?.key?.id || uuidv4().replace(/-/g, ''),
          source: "unknown"
        },
        instanceName: instanceName,
        phoneNumber: formattedPhone
      };
      
      log(`[Evolution API] Resposta formatada para áudio: ${JSON.stringify(responseFormat)}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Áudio enviado com sucesso',
        result: responseFormat
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao enviar áudio: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao enviar áudio',
        error
      };
    }
  },
  
  /**
   * Envia um vídeo através de uma instância
   * @param instanceName Nome da instância
   * @param phoneNumber Número do destinatário
   * @param videoUrl URL do vídeo ou caminho local (base64 com prefixo data:video)
   * @param caption Legenda opcional para o vídeo
   * @param options Opções adicionais
   * Baseado na documentação: https://doc.evolution-api.com/v2/api-reference/send-messages/send-media
   */
  async sendVideoMessage(
    instanceName: string, 
    phoneNumber: string, 
    videoUrl: string,
    caption: string = '',
    options: any = {}
  ): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Enviando vídeo para ${phoneNumber} via instância ${instanceName}`, 'evolution-api');
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Formatação conforme a documentação da API v2
      const payload: any = {
        number: formattedPhone,
        options: {
          delay: options?.delay || 1200,
          presence: "composing"
        },
        mediaMessage: {
          mediatype: "video",
          media: videoUrl, // URL ou base64
          caption: caption,
          fileName: options?.fileName || `video_${Date.now()}.mp4`
        }
      };
      
      // Adiciona as opções avançadas se fornecidas
      if (options?.quoted) {
        payload.options.quoted = options.quoted;
      }
      
      log(`[Evolution API] Enviando vídeo com payload: ${JSON.stringify(payload)}`, 'evolution-api');
      
      // Endpoint para enviar mídia
      const response = await api.post(`/message/sendMedia/${instanceName}`, payload);
      
      if (response.status !== 201 && response.status !== 200) {
        log(`[Evolution API] Erro ao enviar vídeo: ${JSON.stringify(response.data)}`, 'evolution-api');
        console.error(`[Evolution API] ERRO ao enviar vídeo:`, response.data);
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao enviar vídeo',
          error: response.data
        };
      }
      
      log(`[Evolution API] Resposta ao enviar vídeo: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      // Gera um ID único para a mensagem
      const messageId = uuidv4().replace(/-/g, '').toUpperCase();
      
      // Timestamp atual em segundos
      const messageTimestamp = Math.floor(Date.now() / 1000);
      
      // Formato específico de resposta solicitado
      const responseFormat = {
        success: true,
        statusCode: 201,
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: messageId
          },
          pushName: "",
          status: "PENDING",
          message: {
            conversation: caption || "Vídeo enviado"
          },
          contextInfo: null,
          messageType: "video",
          messageTimestamp: messageTimestamp,
          instanceId: response.data?.key?.id || uuidv4().replace(/-/g, ''),
          source: "unknown"
        },
        instanceName: instanceName,
        phoneNumber: formattedPhone
      };
      
      log(`[Evolution API] Resposta formatada para vídeo: ${JSON.stringify(responseFormat)}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Vídeo enviado com sucesso',
        result: responseFormat
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao enviar vídeo: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao enviar vídeo',
        error
      };
    }
  },
  
  /**
   * Envia um documento/arquivo através de uma instância
   * @param instanceName Nome da instância
   * @param phoneNumber Número do destinatário
   * @param documentUrl URL do documento ou caminho local (base64 com prefixo data:application)
   * @param fileName Nome do arquivo
   * @param options Opções adicionais
   * Baseado na documentação: https://doc.evolution-api.com/v2/api-reference/send-messages/send-media
   */
  async sendDocumentMessage(
    instanceName: string, 
    phoneNumber: string, 
    documentUrl: string,
    fileName: string,
    options: any = {}
  ): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Enviando documento para ${phoneNumber} via instância ${instanceName}`, 'evolution-api');
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Formatação conforme a documentação da API v2
      const payload: any = {
        number: formattedPhone,
        options: {
          delay: options?.delay || 1200,
          presence: "composing"
        },
        mediaMessage: {
          mediatype: "document",
          media: documentUrl, // URL ou base64
          fileName: fileName || `document_${Date.now()}.pdf`
        }
      };
      
      // Adiciona as opções avançadas se fornecidas
      if (options?.quoted) {
        payload.options.quoted = options.quoted;
      }
      
      log(`[Evolution API] Enviando documento com payload: ${JSON.stringify(payload)}`, 'evolution-api');
      
      // Endpoint para enviar mídia
      const response = await api.post(`/message/sendMedia/${instanceName}`, payload);
      
      if (response.status !== 201 && response.status !== 200) {
        log(`[Evolution API] Erro ao enviar documento: ${JSON.stringify(response.data)}`, 'evolution-api');
        console.error(`[Evolution API] ERRO ao enviar documento:`, response.data);
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao enviar documento',
          error: response.data
        };
      }
      
      log(`[Evolution API] Resposta ao enviar documento: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      // Gera um ID único para a mensagem
      const messageId = uuidv4().replace(/-/g, '').toUpperCase();
      
      // Timestamp atual em segundos
      const messageTimestamp = Math.floor(Date.now() / 1000);
      
      // Formato específico de resposta solicitado
      const responseFormat = {
        success: true,
        statusCode: 201,
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: messageId
          },
          pushName: "",
          status: "PENDING",
          message: {
            conversation: `Documento: ${fileName}`
          },
          contextInfo: null,
          messageType: "document",
          messageTimestamp: messageTimestamp,
          instanceId: response.data?.key?.id || uuidv4().replace(/-/g, ''),
          source: "unknown"
        },
        instanceName: instanceName,
        phoneNumber: formattedPhone
      };
      
      log(`[Evolution API] Resposta formatada para documento: ${JSON.stringify(responseFormat)}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Documento enviado com sucesso',
        result: responseFormat
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao enviar documento: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao enviar documento',
        error
      };
    }
  },
  
  /**
   * Envia uma mensagem de texto com botões através de uma instância
   * Conforme documentação: https://doc.evolution-api.com/v2/api-reference/send-messages/send-button
   */
  async sendButtonMessage(instanceName: string, phoneNumber: string, message: string, buttons: {id: string, text: string}[]): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Enviando mensagem com botões para ${phoneNumber} via instância ${instanceName}`, 'evolution-api');
      console.log(`[Evolution API] Enviando mensagem com botões para ${phoneNumber} via instância ${instanceName}`);
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = phoneNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Verifica se o número já possui código de país
      // Trata diversos formatos: números internacionais ou brasileiros com ou sem código do país
      if (!formattedPhone.match(/^\d{10,15}$/)) {
        log(`[Evolution API] Formato de número inválido: ${formattedPhone}`, 'evolution-api');
        console.log(`[Evolution API] ATENÇÃO: Formato de número inválido: ${formattedPhone}`);
      } else if (!formattedPhone.match(/^[1-9]\d{1,3}\d{8,11}$/)) {
        // Provavelmente é um número sem código de país, assumimos Brasil (55) por padrão
        if (formattedPhone.length >= 8 && formattedPhone.length <= 11) {
          log(`[Evolution API] Adicionando código do Brasil (55) ao número: ${formattedPhone}`, 'evolution-api');
          formattedPhone = `55${formattedPhone}`;
        }
      }
      
      // Formata os botões conforme exigido pela API
      const formattedButtons = buttons.map(button => ({
        buttonId: button.id,
        buttonText: {
          displayText: button.text
        },
        type: 1
      }));
      
      // Payload conforme documentação atualizada da API v2
      const payload = {
        number: formattedPhone,
        options: {
          delay: 1200,
          presence: "composing"
        },
        // Formato correto para a Evolution API v2
        buttonMessage: {
          title: "Opções Disponíveis",
          description: message,
          footerText: "Escolha uma das opções abaixo",
          buttons: formattedButtons,
          headerType: 1
        }
      };
      
      log(`[Evolution API] Enviando mensagem com botões: ${JSON.stringify(payload)}`, 'evolution-api');
      console.log(`[Evolution API] PAYLOAD de botões: ${JSON.stringify(payload, null, 2)}`);
      
      const response = await api.post(`/message/sendButton/${instanceName}`, payload);
      
      if (response.status !== 201 && response.status !== 200) {
        log(`[Evolution API] Erro ao enviar mensagem com botões: ${JSON.stringify(response.data)}`, 'evolution-api');
        console.error(`[Evolution API] ERRO ao enviar mensagem com botões:`, response.data);
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao enviar mensagem com botões',
          error: response.data
        };
      }
      
      log(`[Evolution API] Resposta ao enviar mensagem com botões: ${JSON.stringify(response.data)}`, 'evolution-api');
      console.log(`[Evolution API] SUCESSO ao enviar mensagem com botões:`, response.data);
      
      // Gera um ID único para a mensagem
      const messageId = uuidv4().replace(/-/g, '').toUpperCase();
      
      // Timestamp atual em segundos
      const messageTimestamp = Math.floor(Date.now() / 1000);
      
      // Formato específico de resposta solicitado
      const responseFormat = {
        success: true,
        statusCode: 201,
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: messageId
          },
          pushName: "",
          status: "PENDING",
          message: {
            conversation: message
          },
          contextInfo: null,
          messageType: "button",
          messageTimestamp: messageTimestamp,
          instanceId: response.data?.key?.id || uuidv4().replace(/-/g, ''),
          source: "unknown"
        },
        instanceName: instanceName,
        phoneNumber: formattedPhone
      };
      
      log(`[Evolution API] Resposta formatada para botões: ${JSON.stringify(responseFormat)}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Mensagem com botões enviada com sucesso',
        result: responseFormat
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao enviar mensagem com botões: ${error.message}`, 'evolution-api');
      return {
        status: false,
        message: error.message || 'Erro ao enviar mensagem com botões',
        error
      };
    }
  },
  
  /**
   * Simula o recebimento de uma mensagem (para testes)
   * Atualizado para o formato da Evolution API v2
   */
  async simulateIncomingMessage(instanceName: string, fromNumber: string, messageContent: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Simulando recebimento de mensagem. Instância: ${instanceName}, De: ${fromNumber}, Mensagem: "${messageContent}"`, 'evolution-api');
      
      // Normaliza o número de telefone, removendo qualquer prefixo + ou @
      let formattedPhone = fromNumber.replace(/[+@\s]/g, '').trim();
      
      // Remove qualquer sufixo após o @ caso ainda exista
      if (formattedPhone.includes('@')) {
        formattedPhone = formattedPhone.split('@')[0];
      }
      
      // Verifica se o número já possui código de país
      // Trata diversos formatos: números internacionais ou brasileiros com ou sem código do país
      if (!formattedPhone.match(/^\d{10,15}$/)) {
        log(`[Evolution API] Formato de número inválido: ${formattedPhone}`, 'evolution-api');
      } else if (!formattedPhone.match(/^[1-9]\d{1,3}\d{8,11}$/)) {
        // Provavelmente é um número sem código de país, assumimos Brasil (55) por padrão
        if (formattedPhone.length >= 8 && formattedPhone.length <= 11) {
          log(`[Evolution API] Adicionando código do Brasil (55) ao número: ${formattedPhone}`, 'evolution-api');
          formattedPhone = `55${formattedPhone}`;
        }
      }
      
      // Adiciona o sufixo WhatsApp
      const remoteJid = `${formattedPhone}@s.whatsapp.net`;
      
      // Cria um objeto simulando uma mensagem recebida no formato da Evolution API v2
      // Baseado em webhooks reais observados na documentação
      const mockMessage = {
        instance: {
          instanceName: instanceName
        },
        event: "messages.upsert",
        receive: {
          type: "notify",
          isEphemeral: false,
          isViewOnce: false,
          messages: [
            {
              key: {
                remoteJid: remoteJid,
                fromMe: false,
                id: `SIMULATED-${Date.now()}`
              },
              messageTimestamp: Math.floor(Date.now() / 1000),
              pushName: "Simulador de Teste",
              message: {
                conversation: messageContent
              },
              isAutomated: false, 
              sender: {
                id: remoteJid,
                name: "Simulador Teste",
                formattedNumber: formattedPhone,
                isMe: false
              },
              hasQuotedMessage: false,
              body: messageContent,
              type: "text",
              timestamp: new Date().toISOString()
            }
          ],
          statusMessage: "STATUS_PENDING"
        }
      };
      
      // Adicionar teste direto no processador de mensagens para simular o processamento
      return {
        status: true,
        message: 'Mensagem simulada criada com sucesso',
        mockMessage
      };
    } catch (error: any) {
      console.error('Erro ao simular mensagem:', error);
      return {
        status: false,
        message: `Erro ao simular mensagem: ${error.message}`
      };
    }
  },
  
  /**
   * Configura um webhook para receber notificações de novas mensagens
   * Configuração atualizada para Evolution API v2
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Configurando webhook para instância ${instanceName}: ${webhookUrl}`, 'evolution-api');
      
      // Payload simplificado para maior compatibilidade
      const payload = {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: [
              "QRCODE_UPDATED",
              "MESSAGES_UPSERT",
              "SEND_MESSAGE",
              "CONNECTION_UPDATE"
          ]
        }
      };
      
      log(`[Evolution API] Configurando webhook com payload: ${JSON.stringify(payload)}`, 'evolution-api');
      
      // Testando primeiro com a rota da versão 2
      const response = await api.post(`/webhook/set/${instanceName}`, payload);
      
      // Adicionando log para debug da resposta
      log(`[Evolution API] Resposta da configuração de webhook: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      if (response.status !== 200 && response.status !== 201) {
        log(`[Evolution API] Erro ao configurar webhook: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || 'Erro ao configurar webhook',
          error: response.data
        };
      }
      
      // Verifica se o webhook foi configurado corretamente
      try {
        // Busca a configuração atual do webhook para confirmar
        const checkResponse = await api.get(`/webhook/find/${instanceName}`);
        log(`[Evolution API] Verificação do webhook: ${JSON.stringify(checkResponse.data)}`, 'evolution-api');
      } catch (error: any) {
        log(`[Evolution API] Erro ao verificar webhook: ${error?.message || 'Erro desconhecido'}`, 'evolution-api');
        // Apenas log, não interrompe o fluxo
      }
      
      // Configura também as definições para marcar as mensagens como lidas
      try {
        await this.setSettings(instanceName, {
          reject_call: true,
          read_messages: true,
          read_status: true
        });
        log(`[Evolution API] Configurações de leitura de mensagens aplicadas com sucesso`, 'evolution-api');
      } catch (error: any) {
        log(`[Evolution API] Erro ao configurar leitura de mensagens: ${error?.message}`, 'evolution-api');
        // Não interrompe o fluxo, apenas registra o erro
      }

      return {
        status: true,
        message: 'Webhook configurado com sucesso',
        result: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao configurar webhook: ${error.message}`, 'evolution-api');
      console.error('[Evolution API] Erro completo ao configurar webhook:', error);
      return {
        status: false,
        message: error.message || 'Erro ao configurar webhook',
        error
      };
    }
  },
  
  /**
   * Define configurações para uma instância específica
   * Conforme documentação: https://doc.evolution-api.com/v2/api-reference/settings/set
   */
  async setSettings(instanceName: string, settings: any): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Configurando settings para instância ${instanceName}`, 'evolution-api');
      
      const response = await api.post(`/settings/set/${instanceName}`, settings);
      
      log(`[Evolution API] Resposta da configuração de settings: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      if (response.status !== 200 && response.status !== 201) {
        log(`[Evolution API] Erro ao configurar settings: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || 'Erro ao configurar settings',
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Settings configurados com sucesso',
        result: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao configurar settings: ${error?.message || 'Erro desconhecido'}`, 'evolution-api');
      console.error(`[Evolution API] Erro completo ao configurar settings:`, error);
      return {
        status: false,
        message: `Erro ao configurar settings: ${error?.message || 'Erro desconhecido'}`,
        error
      };
    }
  },
  
  /**
   * Obtém as configurações atuais de uma instância
   * Conforme documentação: https://doc.evolution-api.com/v2/api-reference/settings/get
   */
  async getSettings(instanceName: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Obtendo settings da instância ${instanceName}`, 'evolution-api');
      
      const response = await api.get(`/settings/get/${instanceName}`);
      
      log(`[Evolution API] Resposta da obtenção de settings: ${JSON.stringify(response.data)}`, 'evolution-api');
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao obter settings: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.response?.message || 'Erro ao obter settings',
          error: response.data
        };
      }
      
      return {
        status: true,
        message: 'Settings obtidos com sucesso',
        result: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao obter settings: ${error?.message || 'Erro desconhecido'}`, 'evolution-api');
      console.error(`[Evolution API] Erro completo ao obter settings:`, error);
      return {
        status: false,
        message: `Erro ao obter settings: ${error?.message || 'Erro desconhecido'}`,
        error
      };
    }
  },

  /**
   * Verifica números de WhatsApp
   * Conforme documentação: https://doc.evolution-api.com/v2/api-reference/chat/whatsapp-numbers
   */
  async verifyWhatsAppNumbers(instanceName: string, numbers: string[]): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Verificando números para instância ${instanceName}: ${numbers.join(', ')}`, 'evolution-api');
      
      const response = await api.post(`/chat/whatsappNumbers/${instanceName}`, {
        numbers: numbers
      });
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao verificar números: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao verificar números',
          error: response.data
        };
      }
      
      log(`[Evolution API] Verificação de números concluída para ${instanceName}`, 'evolution-api');
      
      return {
        status: true,
        message: 'Verificação de números concluída com sucesso',
        result: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao verificar números: ${error.message}`, 'evolution-api');
      console.error('[Evolution API] Erro completo ao verificar números:', error);
      return {
        status: false,
        message: error.message || 'Erro ao verificar números',
        error
      };
    }
  },
  
  /**
   * Busca todos os contatos de uma instância
   * Conforme documentação: https://doc.evolution-api.com/v2/api-reference/chat/get-all-contacts
   */
  async getAllContacts(instanceName: string): Promise<ApiResponse> {
    try {
      log(`[Evolution API] Buscando contatos para instância ${instanceName}`, 'evolution-api');
      
      const response = await api.get(`/chat/get-all-contacts/${instanceName}`);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao buscar contatos: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao buscar contatos',
          error: response.data
        };
      }
      
      log(`[Evolution API] Contatos encontrados para ${instanceName}: ${response.data?.contacts?.length || 0} contatos`, 'evolution-api');
      
      return {
        status: true,
        message: 'Contatos encontrados',
        ...response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao buscar contatos: ${error.message}`, 'evolution-api');
      
      if (error.response) {
        return {
          status: false,
          message: `Erro ao buscar contatos: ${error.response.data?.message || error.message}`,
          error: error.response.data
        };
      }
      
      return {
        status: false,
        message: `Erro ao buscar contatos: ${error.message}`,
        error
      };
    }
  },

  /**
   * Busca mensagens de uma instância
   * Conforme documentação: https://doc.evolution-api.com/v2/api-reference/chat/find-messages
   * Limitado aos últimos 10 minutos para melhorar a performance
   */
  async findMessages(instanceName: string, remoteJid?: string, page: number = 1, limit: number = 50): Promise<ApiResponse> {
    try {
      //log(`[Evolution API] Buscando mensagens para instância ${instanceName}${remoteJid ? ' e contato ' + remoteJid : ''}`, 'evolution-api');
      
      // Calcular timestamp de 10 minutos atrás
      const tenMinutesAgo = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // Converte para segundos
      
      const data: any = {
        where: {
          // Filtrar mensagens dos últimos 10 minutos
          messageTimestamp: {
            $gte: tenMinutesAgo
          }
        }
      };

      // Se um remoteJid for fornecido, filtra por esse contato específico
      if (remoteJid) {
        data.where.key = {
          remoteJid: remoteJid
        };
      }
      
      // Adiciona paginação
      data.limit = limit;
      data.page = page;

      const response = await api.post(`/chat/findMessages/${instanceName}`, data);
      
      if (response.status !== 200) {
        log(`[Evolution API] Erro ao buscar mensagens: ${JSON.stringify(response.data)}`, 'evolution-api');
        return {
          status: false,
          message: response.data?.error || response.data?.message || 'Erro ao buscar mensagens',
          error: response.data
        };
      }
      
      //log(`[Evolution API] Mensagens encontradas para ${instanceName}${remoteJid ? ' e contato ' + remoteJid : ''}: ${response.data?.messages?.total || 0} mensagens`, 'evolution-api');
      
      return {
        status: true,
        message: 'Mensagens encontradas com sucesso',
        result: response.data
      };
    } catch (error: any) {
      log(`[Evolution API] Erro ao buscar mensagens: ${error.message}`, 'evolution-api');
      console.error('[Evolution API] Erro completo ao buscar mensagens:', error);
      return {
        status: false,
        message: error.message || 'Erro ao buscar mensagens',
        error
      };
    }
  },
};

/**
 * Converter uma instância da Evolution API para o formato da nossa aplicação
 */
export function convertEvolutionInstanceToAppInstance(instanceName: string, evolutionData: any, userId: number): any {
  // Mapear o estado da instância para o formato da nossa aplicação
  let status = 'disconnected';
  
  // Extrair o estado, que pode estar em diferentes lugares na resposta
  let state = null;
  if (evolutionData?.instance?.state) {
    state = evolutionData.instance.state;
  } else if (evolutionData?.state) {
    state = evolutionData.state;
  } else if (evolutionData?.status) {
    state = evolutionData.status;
  }
  
  log(`[Evolution API] Convertendo estado "${state}" para instância ${instanceName}`, 'evolution-api');
  
  if (state) {
    // Vários estados possíveis na Evolution API
    // CORREÇÃO: instância com "state": "open" deve ser tratada como CONECTADA (não desconectada)
    if (state === 'connected' || state === 'CONNECTED' || state === 'open') {
      status = 'connected';
    } else if (state === 'connecting' || state === 'qrcode' || state === 'QRCODE') {
      status = 'connecting';
    }
  }

  return {
    id: uuidv4(),
    name: instanceName,
    userId,
    status,
    lastConnection: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}