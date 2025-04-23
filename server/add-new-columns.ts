import { log } from "./vite";
import postgres from "postgres";

/**
 * Este script adiciona novas colunas nas tabelas existentes para suportar 
 * as novas funcionalidades de analytics e melhorar a estrutura do banco de dados
 */
async function main() {
  log("Iniciando adição de novas colunas no banco de dados...", "db");
  
  try {
    // Obter a URL do banco de dados a partir das variáveis de ambiente
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Criar um cliente postgres para migração
    const client = postgres(DATABASE_URL, { max: 1 });
    
    log("Verificando e adicionando colunas nas tabelas...", "db");
    
    // Adicionar a coluna trigger_keyword na tabela message_flows
    try {
      // Verificar se a coluna já existe
      const messageFlowsColumns = await client`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'message_flows' AND column_name = 'trigger_keyword';
      `;
      
      if (messageFlowsColumns.length === 0) {
        log("Adicionando coluna trigger_keyword na tabela message_flows...", "db");
        await client`
          ALTER TABLE message_flows 
          ADD COLUMN trigger_keyword TEXT NOT NULL DEFAULT '';
        `;
        log("Coluna trigger_keyword adicionada com sucesso.", "db");
      } else {
        log("A coluna trigger_keyword já existe na tabela message_flows.", "db");
      }
    } catch (error) {
      console.error("Erro ao adicionar coluna trigger_keyword:", error);
    }

    // Adicionar novas colunas na tabela activities
    try {
      // Verificar se as colunas já existem
      const activitiesColumns = await client`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'activities' AND (column_name = 'instance_id' OR column_name = 'flow_id' OR column_name = 'status' OR column_name = 'timestamp');
      `;
      
      const existingColumns = activitiesColumns.map(col => col.column_name);
      
      if (!existingColumns.includes('instance_id')) {
        log("Adicionando coluna instance_id na tabela activities...", "db");
        await client`
          ALTER TABLE activities 
          ADD COLUMN instance_id TEXT REFERENCES instances(id);
        `;
        log("Coluna instance_id adicionada com sucesso.", "db");
      } else {
        log("A coluna instance_id já existe na tabela activities.", "db");
      }
      
      if (!existingColumns.includes('flow_id')) {
        log("Adicionando coluna flow_id na tabela activities...", "db");
        await client`
          ALTER TABLE activities 
          ADD COLUMN flow_id TEXT REFERENCES message_flows(id);
        `;
        log("Coluna flow_id adicionada com sucesso.", "db");
      } else {
        log("A coluna flow_id já existe na tabela activities.", "db");
      }
      
      if (!existingColumns.includes('status')) {
        log("Adicionando coluna status na tabela activities...", "db");
        await client`
          ALTER TABLE activities 
          ADD COLUMN status TEXT;
        `;
        log("Coluna status adicionada com sucesso.", "db");
      } else {
        log("A coluna status já existe na tabela activities.", "db");
      }
      
      if (!existingColumns.includes('timestamp')) {
        log("Adicionando coluna timestamp na tabela activities...", "db");
        await client`
          ALTER TABLE activities 
          ADD COLUMN timestamp TIMESTAMP NOT NULL DEFAULT NOW();
        `;
        log("Coluna timestamp adicionada com sucesso.", "db");
      } else {
        log("A coluna timestamp já existe na tabela activities.", "db");
      }
    } catch (error) {
      console.error("Erro ao adicionar colunas na tabela activities:", error);
    }

    log("Adição de colunas concluída com sucesso!", "db");
    
    // Fechar a conexão
    await client.end();
    
    process.exit(0);
  } catch (error) {
    console.error("Erro durante a adição de colunas:", error);
    process.exit(1);
  }
}

main();