/**
 * Script para configurar o banco de dados - criar tabelas necessárias
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { DATABASE_URL } from './db';

async function setup() {
  console.log('[setup] Iniciando configuração do banco de dados...');
  
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  const db = drizzle(client);
  
  console.log('[setup] Criando tabelas no banco de dados...');
  
  // Aplicar todas as migrações (vai criar todas as tabelas definidas em schema.ts)
  await migrate(db, { migrationsFolder: 'drizzle' });
  
  console.log('[setup] Configuração do banco de dados concluída!');
  
  await client.end();
}

setup()
  .catch(err => {
    console.error('[setup] Erro ao configurar banco de dados:', err);
    process.exit(1);
  });