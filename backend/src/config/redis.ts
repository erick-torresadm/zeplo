import Redis from 'ioredis';
import { config } from 'dotenv';
import { RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';

config();

const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '6'),
  keyPrefix: process.env.CACHE_REDIS_PREFIX_KEY || 'evolution:',
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Aumentar timeout para evitar desconexões
  connectTimeout: 10000,
  // Adicionar reconexão automática
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // reconectar para erros READONLY
    }
    return false;
  }
};

// Se a URI do Redis estiver definida, use-a em vez das configurações individuais
const redisUri = process.env.CACHE_REDIS_URI;

let redis: Redis;

try {
  redis = redisUri ? new Redis(redisUri) : new Redis(redisConfig);
  
  redis.on('error', (error: Error) => {
    logger.error('Redis connection error:', error);
    // Não derruba a aplicação, apenas registra o erro
  });
  
  redis.on('connect', () => {
    logger.info('Successfully connected to Redis');
  });
  
  // Tente uma operação PING para verificar a conexão e autenticação
  redis.ping().then(() => {
    logger.info('Redis connection authenticated and operational');
  }).catch(err => {
    logger.error('Redis authentication or connection failed:', err);
  });
} catch (err) {
  logger.error('Failed to initialize Redis connection:', err);
  // Criar um cliente Redis simulado para não quebrar a aplicação
  redis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    // Adicionar outros métodos conforme necessário
  } as any;
}

// Verificar se o cache Redis está habilitado
const isCacheEnabled = process.env.CACHE_REDIS_ENABLED === 'true';
if (!isCacheEnabled) {
  logger.warn('Redis cache is disabled. Set CACHE_REDIS_ENABLED=true to enable it.');
}

export default redis;

// Exportar funções auxiliares para o cache
export const cacheConfig = {
  isEnabled: isCacheEnabled,
  saveInstances: process.env.CACHE_REDIS_SAVE_INSTANCES === 'true',
  prefix: process.env.CACHE_REDIS_PREFIX_KEY || 'evolution'
}; 