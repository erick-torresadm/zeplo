import { config } from 'dotenv';
import { Knex } from 'knex';

// Carregar variáveis de ambiente do arquivo .env.test se existir
config({ path: '.env.test' });

// Configurar variáveis de ambiente para teste
process.env.NODE_ENV = 'test';
process.env.MINIO_ENDPOINT = 'https://minios3.zeplo.com.br';
process.env.MINIO_BUCKET = 'zeplo';
process.env.EVOLUTION_API_URL = 'https://api.zeplo.com.br';
process.env.EVOLUTION_API_KEY = 'test-api-key';

// Mock do Knex
jest.mock('knex', () => {
  const mKnex = () => ({
    // Mock das funções do Knex que você usa
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  });
  mKnex.transaction = jest.fn();
  return mKnex;
});

// Mock do axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      response: {
        use: jest.fn()
      }
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }))
}));

// Desabilitar logs durante os testes
jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarning: jest.fn()
})); 