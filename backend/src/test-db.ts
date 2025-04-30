import { config } from 'dotenv';
import db from './config/database';

config();

async function testDatabaseConnection() {
  try {
    console.log('Testando conexão com o banco de dados...');
    console.log('Configurações:');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Porta: ${process.env.DB_PORT}`);
    console.log(`Banco: ${process.env.DB_NAME}`);
    console.log(`Usuário: ${process.env.DB_USER}`);

    // Tenta fazer uma query simples
    const result = await db.raw('SELECT NOW()');
    console.log('\n✅ Conexão estabelecida com sucesso!');
    console.log('Timestamp do servidor:', result.rows[0].now);

    // Lista as tabelas existentes
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\nTabelas encontradas:');
    tables.rows.forEach((row: any) => {
      console.log(`- ${row.table_name}`);
    });

  } catch (error: any) {
    console.error('\n❌ Erro ao conectar com o banco de dados:', error.message);
    if (error.code) {
      console.error('Código do erro:', error.code);
    }
  } finally {
    await db.destroy();
  }
}

testDatabaseConnection(); 