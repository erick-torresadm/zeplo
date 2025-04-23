/**
 * Script para criar a tabela de histórico de mensagens
 */
import postgres from "postgres";
import { DATABASE_URL } from "./db";

async function createMessageHistoryTable() {
  console.log('[script] Criando tabela message_history...');
  console.log('[script] URL do banco de dados:', DATABASE_URL ? 'definida' : 'não definida');

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL não definida');
  }
  
  const sql = postgres(DATABASE_URL);

  try {
    console.log('[script] Conectado ao banco de dados');

    // Verificar se a tabela já existe
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'message_history'
      );
    `;

    if (tableExists[0].exists) {
      console.log('[script] Tabela message_history já existe');
      
      // Verificar se a coluna de timestamp existe
      const columnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'message_history'
          AND column_name = 'timestamp'
        );
      `;
      
      if (!columnExists[0].exists) {
        console.log('[script] Adicionando coluna timestamp à tabela existente...');
        await sql`
          ALTER TABLE "message_history" 
          ADD COLUMN "timestamp" TIMESTAMP DEFAULT NOW() NOT NULL;
        `;
        console.log('[script] Coluna timestamp adicionada com sucesso!');
      } else {
        console.log('[script] Coluna timestamp já existe, nenhuma ação necessária');
      }
      
      return;
    }

    // Criar a tabela message_history conforme definida no schema.ts
    await sql`
      CREATE TABLE IF NOT EXISTS "message_history" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "instance_id" TEXT NOT NULL REFERENCES "instances"("id"),
        "instance_name" TEXT NOT NULL,
        "sender" TEXT NOT NULL,
        "message_content" TEXT NOT NULL,
        "triggered_keyword" TEXT,
        "flow_id" TEXT REFERENCES "message_flows"("id"),
        "status" TEXT NOT NULL DEFAULT 'no_match',
        "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    console.log('[script] Tabela message_history criada com sucesso!');
  } catch (error) {
    console.error('[script] Erro ao criar/atualizar tabela message_history:', error);
  } finally {
    await sql.end();
    console.log('[script] Conexão com o banco de dados encerrada');
  }
}

createMessageHistoryTable();