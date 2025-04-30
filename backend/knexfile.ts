import { config } from 'dotenv';
import type { Knex } from 'knex';

// Carrega as variáveis de ambiente
config();

// Configuração base do Knex
const baseConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts',
  },
};

// Configurações específicas para cada ambiente
const configs: { [key: string]: Knex.Config } = {
  development: {
    ...baseConfig,
    debug: true,
  },
  test: {
    ...baseConfig,
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: `${process.env.DB_NAME}_test`,
    },
  },
  production: {
    ...baseConfig,
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default configs; 