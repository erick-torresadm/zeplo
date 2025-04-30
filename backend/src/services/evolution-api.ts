import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import { logger } from '../utils/logger';

config();

// Types
export interface ApiResponse<T = any> {
  status: boolean;
  message: string;
  data?: T;
}

interface EvolutionApiInstance {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  integration: string;
  token: string;
  clientName: string;
  qrcode?: string;
}

export interface Instance {
    instanceName: string;
    owner: string;
    profileName: string;
    profilePictureUrl: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    apikey?: string;
    qrcode?: string;
}

export interface MessageOptions {
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

// Interfaces para os novos métodos
export interface ContactVCard {
  fullName: string;
  organization?: string;
  phoneNumber: string;
  email?: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  title?: string;
  address?: string;
}

export interface PollData {
  name: string;
  options: string[];
  selectableCount?: number;
}

export interface ListData {
  buttonText: string;
  description: string;
  title: string;
  footer?: string;
  sections: {
    title: string;
    rows: {
      title: string;
      description?: string;
      rowId: string;
    }[]
  }[]
}

export interface PrivacySettings {
  lastSeen?: 'all' | 'contacts' | 'none';
  online?: 'all' | 'match_last_seen';
  profilePhoto?: 'all' | 'contacts' | 'none';
  status?: 'all' | 'contacts' | 'none';
  readReceipts?: boolean;
  groupsAdd?: 'all' | 'contacts' | 'none';
}

interface EvolutionApiConfig {
  baseURL: string;
  apiKey: string;
}

class EvolutionAPI {
  private api: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const config: EvolutionApiConfig = {
      baseURL: process.env.EVOLUTION_API_URL || 'https://api.zeplo.com.br',
      apiKey: process.env.EVOLUTION_API_KEY || ''
    };

    this.baseUrl = config.baseURL;
    this.apiKey = config.apiKey;

    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        console.error('Evolution API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  private handleResponse<T>(response: any): ApiResponse<T> {
    if (response.data) {
      // Se for uma lista de instâncias, mapear cada uma
      if (Array.isArray(response.data)) {
        const instances = response.data.map((instance: EvolutionApiInstance) => ({
          instanceName: instance.name,
          owner: instance.ownerJid || '',
          profileName: instance.profileName || '',
          profilePictureUrl: instance.profilePicUrl || '',
          status: this.mapConnectionStatus(instance.connectionStatus),
          apikey: instance.token,
          qrcode: instance.qrcode
        }));
        
        return {
          status: true,
          message: 'Success',
          data: instances as T
        };
      }
      
      // Se for uma única instância
      return {
        status: true,
        message: response.data.message || 'Success',
        data: response.data
      };
    }
    return {
      status: false,
      message: 'Invalid response format'
    };
  }

  private mapConnectionStatus(status: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    switch (status?.toLowerCase()) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'disconnected':
      case 'close':
      case 'logout':
        return 'disconnected';
      default:
        return 'error';
    }
  }

  async getAllInstances(): Promise<ApiResponse<Instance[]>> {
    try {
      logger.info('Fetching all instances from Evolution API');
      const response = await this.api.get('/instance/fetchInstances');
      
      if (!response.data) {
        logger.warn('No data received from Evolution API');
        return {
          status: false,
          message: 'No data received from Evolution API'
        };
      }

      logger.info('Successfully fetched instances from Evolution API');
      return this.handleResponse<Instance[]>(response);
    } catch (error: any) {
      logger.error('Failed to fetch instances from Evolution API:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch instances'
      };
    }
  }

  async getInstance(instanceName: string): Promise<ApiResponse<Instance>> {
    try {
      const response = await this.api.get(`/instance/info/${instanceName}`);
      return this.handleResponse<Instance>(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async createInstance(instanceName: string): Promise<ApiResponse> {
    try {
      logger.info('Creating Evolution API instance:', {
        instanceName,
        webhook: {
          enabled: true,
          url: `${process.env.WEBHOOK_URL}/webhooks/${instanceName}`,
          events: ['messages', 'status', 'qrcode']
        }
      });
      
      const data = {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        webhook: process.env.WEBHOOK_URL ? {
          enabled: true,
          url: `${process.env.WEBHOOK_URL}/webhooks/${instanceName}`,
          events: ['messages', 'status', 'qrcode']
        } : undefined
      };
      
      logger.info('Request data for instance creation:', JSON.stringify(data, null, 2));
      
      const response = await this.api.post('/instance/create', data);
      
      logger.info('Instance creation response:', {
        status: response.status,
        data: response.data
      });
      
      return this.handleResponse(response);
    } catch (error: any) {
      logger.error('Error creating Evolution API instance:', {
        instanceName,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.response?.data?.response?.message || error.message
      };
    }
  }

  async deleteInstance(instanceName: string): Promise<ApiResponse> {
    try {
      logger.info(`Deleting instance "${instanceName}"`);
      
      // Based on Evolution API documentation, the correct endpoint is /instance/delete/{instanceName}
      const response = await this.api.delete(`/instance/delete/${instanceName}`);
      
      logger.info(`Delete instance response:`, {
        status: response.status,
        data: response.data
      });
      
      return this.handleResponse(response);
    } catch (error: any) {
      logger.error('Error deleting Evolution API instance:', {
        instanceName,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.response?.data?.response?.message || error.message
      };
    }
  }

  async connectInstance(instanceName: string): Promise<ApiResponse> {
    try {
      const response = await this.api.get(`/instance/connect/${instanceName}`, {
        headers: {
          apikey: this.apiKey,
        },
      });

      logger.info({
        message: 'Instance connection initiated',
        instanceName,
        response: response.data,
      });

      return this.handleResponse(response);
    } catch (error: any) {
      logger.error({
        message: 'Error connecting instance',
        instanceName,
        error: error.response?.data || error.message,
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async disconnectInstance(instanceName: string): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/instance/${instanceName}/logout`);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async getQrCode(instanceName: string): Promise<ApiResponse> {
    try {
      const response = await this.api.get(`/instance/connect/${instanceName}`);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async sendMessage(
    instanceName: string, 
    phoneNumber: string, 
    message: string, 
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending text message to ${phoneNumber} from instance ${instanceName}`);
      
      const data = {
        number: phoneNumber,
        text: message,
        options
      };
      
      logger.info(`Sending text message with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendText/${instanceName}`, data);
      
      logger.info(`Message sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'Message sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send message to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send message'
      };
    }
  }

  async sendMediaMessage(
    instanceName: string, 
    phoneNumber: string, 
    mediaUrl: string,
    caption: string = '',
    type: 'image' | 'video' | 'audio' | 'document' = 'image',
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending ${type} message to ${phoneNumber} from instance ${instanceName}`);
      
      // Endpoints diferentes dependendo do tipo de mídia
      const endpoints = {
        image: `/message/sendImage/${instanceName}`,
        video: `/message/sendVideo/${instanceName}`,
        audio: `/message/sendAudio/${instanceName}`,
        document: `/message/sendDocument/${instanceName}`,
      };
      
      const endpoint = endpoints[type];
      
      // Payload diferente dependendo do tipo de mídia
      let data: any = {
        number: phoneNumber,
        options
      };
      
      if (type === 'image') {
        data.image = mediaUrl;
        data.caption = caption;
      } else if (type === 'video') {
        data.video = mediaUrl;
        data.caption = caption;
      } else if (type === 'audio') {
        data.audio = mediaUrl;
      } else if (type === 'document') {
        data.document = mediaUrl;
        data.fileName = caption || 'document';
      }
      
      logger.info(`Sending ${type} with data:`, JSON.stringify(data));
      const response = await this.api.post(endpoint, data);
      
      logger.info(`${type} message sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: `${type} message sent successfully`,
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send ${type} message to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || `Failed to send ${type} message`
      };
    }
  }

  // Novos métodos de envio de mensagem

  async sendWhatsAppAudio(
    instanceName: string,
    phoneNumber: string,
    audioUrl: string,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/message/sendWhatsAppAudio/${instanceName}`, {
        number: phoneNumber,
        options,
        audioMessage: audioUrl
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async sendSticker(
    instanceName: string,
    phoneNumber: string,
    stickerUrl: string,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending sticker to ${phoneNumber} from instance ${instanceName}`);
      
      const data = {
        number: phoneNumber,
        stickerMessage: {
          image: stickerUrl
        },
        options
      };
      
      logger.info(`Sending sticker with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendSticker/${instanceName}`, data);
      
      logger.info(`Sticker sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'Sticker sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send sticker to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send sticker'
      };
    }
  }

  async sendLocation(
    instanceName: string,
    phoneNumber: string,
    locationData: LocationData,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending location to ${phoneNumber} from instance ${instanceName}`);
      
      const data = {
        number: phoneNumber,
        latitude: locationData.lat,
        longitude: locationData.lng,
        name: locationData.title || '',
        address: locationData.address || '',
        options
      };
      
      logger.info(`Sending location with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendLocation/${instanceName}`, data);
      
      logger.info(`Location sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'Location sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send location to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send location'
      };
    }
  }

  async sendContact(
    instanceName: string,
    phoneNumber: string,
    contact: ContactVCard,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending contact to ${phoneNumber} from instance ${instanceName}`);
      
      const data = {
        number: phoneNumber,
        contactMessage: {
          fullName: contact.fullName,
          organization: contact.organization || '',
          phoneNumber: contact.phoneNumber,
          email: contact.email || ''
        },
        options
      };
      
      logger.info(`Sending contact with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendContact/${instanceName}`, data);
      
      logger.info(`Contact sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'Contact sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send contact to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send contact'
      };
    }
  }

  async sendReaction(
    instanceName: string,
    phoneNumber: string,
    messageId: string,
    emoji: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/message/sendReaction/${instanceName}`, {
        reactionMessage: {
          key: {
            remoteJid: phoneNumber,
            id: messageId
          },
          emoji: emoji
        }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async sendPoll(
    instanceName: string,
    phoneNumber: string,
    poll: PollData,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending poll to ${phoneNumber} from instance ${instanceName}`);
      
      const data = {
        number: phoneNumber,
        pollMessage: {
          name: poll.name,
          options: poll.options,
          selectableCount: poll.selectableCount || 1
        },
        options
      };
      
      logger.info(`Sending poll with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendPoll/${instanceName}`, data);
      
      logger.info(`Poll sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'Poll sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send poll to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send poll'
      };
    }
  }

  async sendList(
    instanceName: string,
    phoneNumber: string,
    list: ListData,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending list to ${phoneNumber} from instance ${instanceName}`);
      
      const data = {
        number: phoneNumber,
        listMessage: {
          buttonText: list.buttonText,
          description: list.description,
          title: list.title,
          footer: list.footer || '',
          sections: list.sections
        },
        options
      };
      
      logger.info(`Sending list with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendList/${instanceName}`, data);
      
      logger.info(`List sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'List sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send list to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send list'
      };
    }
  }

  async sendButtons(
    instanceName: string,
    phoneNumber: string,
    title: string,
    description: string,
    buttons: Array<{id: string, text: string}>,
    footer?: string,
    options: MessageOptions = {}
  ): Promise<ApiResponse> {
    try {
      logger.info(`Sending buttons message to ${phoneNumber} from instance ${instanceName}`);
      
      const buttonData = buttons.map((button, index) => ({
        buttonId: button.id,
        buttonText: {
          displayText: button.text
        },
        type: 1
      }));
      
      const data = {
        number: phoneNumber,
        buttonMessage: {
          title: title,
          description: description,
          footer: footer || '',
          buttons: buttonData
        },
        options
      };
      
      logger.info(`Sending buttons with data:`, JSON.stringify(data));
      const response = await this.api.post(`/message/sendButton/${instanceName}`, data);
      
      logger.info(`Buttons message sent successfully to ${phoneNumber}`);
      return {
        status: true,
        message: 'Buttons message sent successfully',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to send buttons message to ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to send buttons message'
      };
    }
  }

  // Métodos para chats e mensagens

  async markMessageAsRead(
    instanceName: string,
    messageId: string,
    phoneNumber: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.put(`/message/markMessageAsRead/${instanceName}`, {
        key: {
          remoteJid: phoneNumber,
          id: messageId
        }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async archiveChat(
    instanceName: string,
    phoneNumber: string,
    archive: boolean = true
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/chat/archive/${instanceName}`, {
        number: phoneNumber,
        archive
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async deleteMessageForEveryone(
    instanceName: string,
    phoneNumber: string,
    messageId: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/message/delete/${instanceName}`, {
        key: {
          remoteJid: phoneNumber,
          id: messageId
        }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async sendPresence(
    instanceName: string,
    phoneNumber: string,
    presenceStatus: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/message/sendPresence/${instanceName}`, {
        number: phoneNumber,
        presence: presenceStatus
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Métodos para contatos e perfil

  async checkNumber(
    instanceName: string,
    phoneNumber: string
  ): Promise<ApiResponse> {
    try {
      logger.info(`Checking if number ${phoneNumber} exists on WhatsApp from instance ${instanceName}`);
      
      // Evolution API usa um endpoint diferente para verificar números
      const response = await this.api.get(`/chat/whatsappNumbers/${instanceName}?numbers[]=${phoneNumber}`);
      
      logger.info(`Number check completed for ${phoneNumber}`);
      return {
        status: true,
        message: 'Number check completed',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to check number ${phoneNumber}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to check number'
      };
    }
  }

  // Alias para manter compatibilidade
  async verifyNumber(
    instanceName: string,
    phoneNumber: string
  ): Promise<ApiResponse> {
    return this.checkNumber(instanceName, phoneNumber);
  }

  async getProfilePictureUrl(
    instanceName: string,
    phoneNumber: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/misc/getProfilePicture/${instanceName}`, {
        number: phoneNumber
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async findContacts(
    instanceName: string,
    query?: string
  ): Promise<ApiResponse> {
    try {
      const url = query 
        ? `/contact/get/${instanceName}?contact=${query}` 
        : `/contact/get/${instanceName}`;
      const response = await this.api.get(url);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async findMessages(
    instanceName: string,
    phoneNumber: string,
    count: number = 20
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/chat/findMessages/${instanceName}`, {
        number: phoneNumber,
        count
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async findStatusMessages(
    instanceName: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.get(`/chat/findStatusMessages/${instanceName}`);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async updateStatusMessage(
    instanceName: string,
    statusId: string,
    markAsRead: boolean = true
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.put(`/message/updateStatusMessage/${instanceName}`, {
        statusId,
        read: markAsRead
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async findChats(
    instanceName: string,
    type?: 'all' | 'groups' | 'users'
  ): Promise<ApiResponse> {
    try {
      logger.info(`Finding chats for instance ${instanceName} with type ${type || 'all'}`);
      
      const response = await this.api.get(`/chat/find/${instanceName}${type ? `?type=${type}` : ''}`);
      
      logger.info(`Chats found for instance ${instanceName}`);
      return {
        status: true,
        message: 'Chats found',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to find chats for instance ${instanceName}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to find chats'
      };
    }
  }

  // Métodos para configurações de perfil

  async getBusinessProfile(
    instanceName: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.get(`/profile/getBusinessProfile/${instanceName}`);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async getProfile(
    instanceName: string
  ): Promise<ApiResponse> {
    try {
      logger.info(`Getting profile for instance ${instanceName}`);
      
      const response = await this.api.get(`/profile/getProfile/${instanceName}`);
      
      logger.info(`Profile fetched for instance ${instanceName}`);
      return {
        status: true,
        message: 'Profile fetched',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to get profile for instance ${instanceName}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to get profile'
      };
    }
  }

  async updateProfileName(
    instanceName: string,
    name: string
  ): Promise<ApiResponse> {
    try {
      logger.info(`Updating profile name for instance ${instanceName} to "${name}"`);
      
      const data = {
        name: name
      };
      
      const response = await this.api.post(`/profile/updateProfileName/${instanceName}`, data);
      
      logger.info(`Profile name updated for instance ${instanceName}`);
      return {
        status: true,
        message: 'Profile name updated',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to update profile name for instance ${instanceName}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to update profile name'
      };
    }
  }

  async updateProfileStatus(
    instanceName: string,
    status: string
  ): Promise<ApiResponse> {
    try {
      logger.info(`Updating profile status for instance ${instanceName} to "${status}"`);
      
      const data = {
        status: status
      };
      
      const response = await this.api.put(`/profile/updateProfileStatus/${instanceName}`, data);
      
      logger.info(`Profile status updated for instance ${instanceName}`);
      return {
        status: true,
        message: 'Profile status updated',
        data: response.data
      };
    } catch (error: any) {
      logger.error(`Failed to update profile status for instance ${instanceName}:`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        status: false,
        message: error.response?.data?.message || error.message || 'Failed to update profile status'
      };
    }
  }

  async updateProfilePicture(
    instanceName: string,
    imageUrl: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.put(`/profile/updateProfilePicture/${instanceName}`, {
        picture: imageUrl
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async removeProfilePicture(
    instanceName: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.delete(`/profile/removeProfilePicture/${instanceName}`);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async getPrivacySettings(
    instanceName: string
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.get(`/profile/getPrivacySettings/${instanceName}`);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async updatePrivacySettings(
    instanceName: string,
    settings: PrivacySettings
  ): Promise<ApiResponse> {
    try {
      const response = await this.api.put(`/profile/updatePrivacySettings/${instanceName}`, settings);
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string): Promise<ApiResponse> {
    try {
      const response = await this.api.post(`/instance/webhook/${instanceName}`, {
        webhookUrl,
        events: ['messages', 'qrcode', 'status', 'connection']
      });
      return this.handleResponse(response);
    } catch (error: any) {
      return {
        status: false,
        message: error.response?.data?.message || error.message
      };
    }
  }
}

export function convertEvolutionInstanceToAppInstance(instanceName: string, evolutionData: any, userId: number): any {
  return {
    name: instanceName,
    user_id: userId,
    connection_status: 'disconnected',
    profile_name: '',
    profile_picture: '',
    created_at: new Date(),
    updated_at: new Date()
  };
}

// Singleton export
export const evolutionAPI = new EvolutionAPI();
export default evolutionAPI;