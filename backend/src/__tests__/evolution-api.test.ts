import axios from 'axios';
import { WhatsAppService } from '../services/whatsapp';
import { databaseService } from '../services/database';

jest.mock('axios', () => {
  const interceptors = {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  };
  return {
    create: jest.fn(() => ({
      interceptors,
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn()
    })),
    post: jest.fn(),
    get: jest.fn(),
    interceptors
  };
});
jest.mock('../services/database');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WhatsApp Service Tests', () => {
  let whatsappService: WhatsAppService;

  beforeEach(() => {
    jest.clearAllMocks();
    whatsappService = new WhatsAppService();
  });

  describe('Gerenciamento de Instâncias', () => {
    it('deve criar uma instância com sucesso', async () => {
      const mockInstance = {
        id: 1,
        name: 'test-instance',
        user_id: 1,
        status: 'disconnected',
        evolution_instance_name: 'test-instance'
      };

      (databaseService.createInstance as jest.Mock).mockResolvedValue(mockInstance);
      mockedAxios.post.mockResolvedValue({
        data: {
          status: true,
          message: 'Instance created successfully',
          instance: { instanceName: 'test-instance' }
        }
      });

      const result = await whatsappService.createInstance('test-instance', 1);

      expect(result).toEqual(mockInstance);
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(databaseService.createInstance).toHaveBeenCalled();
    });

    it('deve conectar uma instância com sucesso', async () => {
      const mockInstance = {
        id: 1,
        name: 'test-instance',
        user_id: 1,
        status: 'disconnected',
        evolution_instance_name: 'test-instance'
      };

      (databaseService.getInstanceById as jest.Mock).mockResolvedValue(mockInstance);
      mockedAxios.post.mockResolvedValue({
        data: {
          status: true,
          message: 'Instance connected successfully'
        }
      });

      const result = await whatsappService.connectInstance(1);

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('deve obter QR code com sucesso', async () => {
      const mockInstance = {
        id: 1,
        name: 'test-instance',
        user_id: 1,
        status: 'disconnected',
        evolution_instance_name: 'test-instance'
      };

      const mockQrCode = {
        code: 'test-qr-code',
        base64: 'data:image/png;base64,test'
      };

      (databaseService.getInstanceById as jest.Mock).mockResolvedValue(mockInstance);
      mockedAxios.get.mockResolvedValue({
        data: {
          status: true,
          message: 'QR code retrieved successfully',
          qrcode: mockQrCode
        }
      });

      const result = await whatsappService.getQRCode(1);

      expect(result).toEqual(mockQrCode);
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('Envio de Mensagens', () => {
    it('deve enviar mensagem de texto com sucesso', async () => {
      const mockInstance = {
        id: 1,
        name: 'test-instance',
        user_id: 1,
        status: 'connected',
        evolution_instance_name: 'test-instance'
      };

      (databaseService.getInstanceById as jest.Mock).mockResolvedValue(mockInstance);
      mockedAxios.get.mockResolvedValue({
        data: {
          status: true,
          message: 'Number verified successfully',
          numberExists: true
        }
      });
      mockedAxios.post.mockResolvedValue({
        data: {
          status: true,
          message: 'Message sent successfully'
        }
      });

      const result = await whatsappService.sendMessage(1, '5511999999999', 'Test message');

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('deve enviar mensagem de mídia com sucesso', async () => {
      const mockInstance = {
        id: 1,
        name: 'test-instance',
        user_id: 1,
        status: 'connected',
        evolution_instance_name: 'test-instance'
      };

      const mockMedia = {
        id: 1,
        url: 'https://example.com/test.jpg',
        type: 'image'
      };

      (databaseService.getInstanceById as jest.Mock).mockResolvedValue(mockInstance);
      (databaseService.getMediaByUserId as jest.Mock).mockResolvedValue(mockMedia);
      mockedAxios.post.mockResolvedValue({
        data: {
          status: true,
          message: 'Media message sent successfully'
        }
      });

      const result = await whatsappService.sendMediaMessage(1, '5511999999999', mockMedia.url, 'Test caption', 'image');

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('Webhooks', () => {
    it('deve processar webhook de status com sucesso', async () => {
      const mockInstance = {
        id: 1,
        name: 'test-instance',
        user_id: 1,
        status: 'disconnected',
        evolution_instance_name: 'test-instance'
      };

      (databaseService.getInstanceByName as jest.Mock).mockResolvedValue(mockInstance);
      (databaseService.updateInstance as jest.Mock).mockResolvedValue({ ...mockInstance, status: 'connected' });

      const webhookData = {
        instanceName: 'test-instance',
        status: 'connected'
      };

      await whatsappService.processWebhook(webhookData);

      expect(databaseService.updateInstance).toHaveBeenCalledWith(1, { status: 'connected' });
    });
  });
});