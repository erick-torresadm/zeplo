import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function recreateUsersTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Remover a tabela antiga
    await client.query(`DROP TABLE IF EXISTS users CASCADE;`);

    // Criar a tabela com a estrutura correta
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        avatar_url TEXT
      );
    `);

    console.log('Tabela users recriada com sucesso!');

    // Verificar a estrutura
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nEstrutura da tabela users:');
    console.table(tableStructure.rows);

    // Criar usuário de teste
    await client.query(`
      INSERT INTO users (username, password, name, email)
      VALUES ('demo', 'demo', 'Demo User', 'demo@example.com')
      ON CONFLICT (username) DO NOTHING;
    `);

    // Verificar usuários
    const users = await client.query(`SELECT * FROM users;`);
    console.log('\nUsuários na tabela:');
    console.table(users.rows);

  } catch (error) {
    console.error('Erro ao recriar tabela:', error);
  } finally {
    await client.end();
  }
}

recreateUsersTable(); 