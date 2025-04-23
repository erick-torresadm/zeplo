/**
 * Este script atualiza a coluna status na tabela message_history 
 * para aceitar o novo valor "scheduled"
 */
import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Iniciando migração do status para a tabela message_history...');
    
    // Altera o enum status para incluir o valor "scheduled"
    await db.execute(sql`
      ALTER TABLE message_history 
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE TEXT,
      ALTER COLUMN status SET DEFAULT 'no_match'
    `);
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));