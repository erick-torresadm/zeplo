import knex, { Knex } from 'knex';
import { config } from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
config();

// Database connection configuration
const dbConfig = {
  client: process.env.DB_CLIENT || 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'zeplo',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 30000,
    keepAlive: true
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    createRetryIntervalMillis: 1000,
    afterCreate: (conn: any, done: Function) => {
      conn.query('SELECT 1', (err: any) => {
        if (err) {
          logger.error('Erro ao verificar conexão:', err);
        }
        done(err, conn);
      });
    }
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './src/database/migrations',
  },
  debug: process.env.NODE_ENV !== 'production',
  log: {
    warn(message: string) {
      logger.warn('Database warn:', message);
    },
    error(message: string) {
      logger.error('Database error:', message);
    },
    deprecate(message: string) {
      logger.warn('Database deprecated:', message);
    },
    debug(message: string) {
      if (process.env.DB_DEBUG === 'true') {
        logger.debug('Database debug:', message);
      }
    }
  }
};

// Criar instância do Knex com handlers para eventos de erro
let dbInstance: Knex = knex(dbConfig);

// Adicionar evento para logging de erros
dbInstance.on('query-error', (error, query) => {
  logger.error(`Erro na query: ${query.sql}`, error);
});

// Teste de conexão com retry
export const testConnection = async (retries = 3): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await dbInstance.raw('SELECT 1');
      logger.info('Database connection successful');
      return true;
    } catch (error) {
      logger.error(`Database connection attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        const delay = Math.min(attempt * 1000, 5000);
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  logger.error(`Database connection failed after ${retries} attempts`);
  return false;
};

// Função para reconectar em caso de erro
export const reconnectIfNeeded = async (): Promise<void> => {
  try {
    await dbInstance.raw('SELECT 1');
  } catch (error) {
    logger.error('Database connection lost, attempting to reconnect', error);
    // Destruir a conexão atual
    await dbInstance.destroy();
    // Recriar a conexão
    dbInstance = knex(dbConfig);
    await testConnection();
  }
};

// Exportar a instância do banco de dados
export const db = dbInstance;

export default dbInstance; 