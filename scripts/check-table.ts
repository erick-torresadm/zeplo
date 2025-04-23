import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function checkTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Verificar se a tabela existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    console.log('Tabela users existe?', tableExists.rows[0].exists);

    if (tableExists.rows[0].exists) {
      // Verificar a estrutura da tabela
      const tableStructure = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      
      console.log('\nEstrutura da tabela users:');
      console.table(tableStructure.rows);
    }
  } catch (error) {
    console.error('Erro ao verificar tabela:', error);
  } finally {
    await client.end();
  }
}

checkTable(); 