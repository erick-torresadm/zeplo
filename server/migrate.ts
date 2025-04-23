import { db } from "./db";
import { log } from "./vite";
import { users, instances, messageFlows, activities } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Este script executa a migração do esquema do banco de dados
 * Ele cria as tabelas necessárias caso elas não existam
 */
async function main() {
  log("Iniciando migração do banco de dados...", "db");
  
  try {
    // Obter a URL do banco de dados a partir das variáveis de ambiente
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Criar um cliente postgres para migração
    const migrationClient = postgres(DATABASE_URL, { max: 1 });
    const migrationDb = drizzle(migrationClient);
    
    log("Criando tabelas no banco de dados...", "db");
    
    // Executar a migração - criar as tabelas se não existirem
    await migrationDb.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        last_connection TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS message_flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        instance_id TEXT REFERENCES instances(id) ON DELETE CASCADE,
        keyword TEXT NOT NULL,
        messages JSONB NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT
      );
    `);
    
    log("Migração concluída com sucesso!", "db");
    
    // Fechar a conexão
    await migrationClient.end();
    
    process.exit(0);
  } catch (error) {
    console.error("Erro durante a migração:", error);
    process.exit(1);
  }
}

main();