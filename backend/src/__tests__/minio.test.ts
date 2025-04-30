import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mediaService } from '../services/media';
import { databaseService } from '../services/database';
import s3Client, { BUCKET_NAME } from '../config/s3';

// Mock dos serviços
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('../services/database');

describe('MinIO Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Upload de Arquivo', () => {
    it('deve fazer upload de um arquivo com sucesso', async () => {
      // Mock da resposta do S3
      (S3Client as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({})
      }));

      (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.zeplo.com.br/test-url');

      // Mock do banco de dados
      (databaseService.createMedia as jest.Mock).mockResolvedValue({
        id: 1,
        user_id: 1,
        name: 'test.jpg',
        type: 'image',
        url: 'https://minio.zeplo.com.br/test-url'
      });

      const testFile = {
        buffer: Buffer.from('test content'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        size: 1024
      };

      const result = await mediaService.uploadMedia({
        userId: 1,
        file: testFile,
        type: 'image'
      });

      expect(result).toBeDefined();
      expect(result.url).toBe('https://minio.zeplo.com.br/test-url');
      expect(PutObjectCommand).toHaveBeenCalled();
    });

    it('deve falhar ao fazer upload se houver erro no S3', async () => {
      (S3Client as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockRejectedValue(new Error('Erro no upload'))
      }));

      (getSignedUrl as jest.Mock).mockRejectedValue(new Error('Erro no upload'));

      const testFile = {
        buffer: Buffer.from('test content'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        size: 1024
      };

      await expect(mediaService.uploadMedia({
        userId: 1,
        file: testFile,
        type: 'image'
      })).rejects.toThrow('Erro no upload');
    });
  });

  describe('Geração de URL Assinada', () => {
    it('deve gerar uma URL assinada válida', async () => {
      const mockSignedUrl = 'https://minio.zeplo.com.br/signed-url';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

      const url = await mediaService.getSignedUrl('test-key');
      
      expect(url).toBe(mockSignedUrl);
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: BUCKET_NAME,
        Key: 'test-key'
      });
    });
  });

  describe('Deleção de Arquivo', () => {
    it('deve deletar um arquivo com sucesso', async () => {
      // Mock do S3
      (S3Client as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({})
      }));

      // Mock do banco de dados
      (databaseService.getMediaByUserId as jest.Mock).mockResolvedValue({
        id: 1,
        url: 'https://minio.zeplo.com.br/bucket/test-key'
      });

      await mediaService.deleteMedia(1, 1);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: BUCKET_NAME,
        Key: 'bucket/test-key'
      });
      expect(databaseService.deleteMedia).toHaveBeenCalledWith(1);
    });
  });
}); 