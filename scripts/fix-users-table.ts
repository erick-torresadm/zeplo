import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function fixUsersTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Adicionar colunas faltantes
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'User',
      ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT 'user@example.com';
    `);

    // Adicionar constraint unique no email
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
        END IF;
      END $$;
    `);

    console.log('Tabela users corrigida com sucesso!');

    // Verificar a estrutura atualizada
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nNova estrutura da tabela users:');
    console.table(tableStructure.rows);
  } catch (error) {
    console.error('Erro ao corrigir tabela:', error);
  } finally {
    await client.end();
  }
}

fixUsersTable(); 