import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function createSessionTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `;

    await client.query(createTableSQL);
    console.log('Tabela de sessão criada com sucesso!');
  } catch (error) {
    console.error('Erro ao criar tabela de sessão:', error);
  } finally {
    await client.end();
  }
}

createSessionTable(); 