import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Script para adicionar novas colunas nas tabelas de fluxos de mensagens
 * para suportar tipos de gatilho e tempos de ativação
 */
async function main() {
  console.log('Adicionando novas colunas na tabela message_flows...');

  try {
    // Adicionar colunas diretamente usando ALTER TABLE com IF NOT EXISTS
    console.log('Adicionando coluna trigger_type...');
    await db.execute(sql`
      ALTER TABLE message_flows 
      ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL 
      DEFAULT 'exact_match'
    `);
    console.log('Coluna trigger_type processada!');
    
    console.log('Adicionando coluna activation_delay...');
    await db.execute(sql`
      ALTER TABLE message_flows 
      ADD COLUMN IF NOT EXISTS activation_delay INTEGER NOT NULL 
      DEFAULT 0
    `);
    console.log('Coluna activation_delay processada!');

    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();