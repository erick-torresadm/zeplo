import { Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

/**
 * Controlador para endpoints de status do sistema
 */
export class SystemController {
  
  /**
   * Verifica o status do banco de dados
   */
  async getDatabaseStatus(req: Request, res: Response): Promise<void> {
    try {
      // Testar a conexão com o banco de dados
      await db.raw('SELECT 1');
      
      res.json({
        status: 'ok',
        connected: true,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Erro ao verificar status do banco de dados:', error);
      res.status(500).json({
        status: 'error',
        connected: false,
        message: 'Falha na conexão com o banco de dados',
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Verifica o status do Redis
   */
  async getRedisStatus(req: Request, res: Response): Promise<void> {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
    
    try {
      // Testar a conexão com o Redis
      await redis.ping();
      
      res.json({
        status: 'ok',
        connected: true,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Erro ao verificar status do Redis:', error);
      res.status(500).json({
        status: 'error',
        connected: false,
        message: 'Falha na conexão com o Redis',
        timestamp: new Date()
      });
    } finally {
      // Fechar a conexão
      redis.disconnect();
    }
  }
  
  /**
   * Verifica o status do armazenamento S3
   */
  async getStorageStatus(req: Request, res: Response): Promise<void> {
    try {
      // Criar cliente S3
      const s3Client = new S3Client({
        endpoint: process.env.MINIO_ENDPOINT,
        region: 'us-east-1', // Região padrão
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || '',
          secretAccessKey: process.env.MINIO_SECRET_KEY || ''
        },
        forcePathStyle: true // Necessário para MinIO
      });
      
      // Testar a conexão com o S3
      await s3Client.send(new ListBucketsCommand({}));
      
      res.json({
        status: 'ok',
        connected: true,
        bucket: process.env.MINIO_BUCKET,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Erro ao verificar status do armazenamento S3:', error);
      res.status(500).json({
        status: 'error',
        connected: false,
        message: 'Falha na conexão com o armazenamento S3',
        timestamp: new Date()
      });
    }
  }
} 