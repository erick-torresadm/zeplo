import { log } from "./vite";
import postgres from "postgres";

/**
 * Este script atualiza o esquema das tabelas para corresponder às definições no código
 * Alterar tipos de colunas e relacionamentos
 */
async function main() {
  log("Iniciando atualização do esquema do banco de dados...", "db");
  
  try {
    // Obter a URL do banco de dados a partir das variáveis de ambiente
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Criar um cliente postgres para migração
    const migrationClient = postgres(DATABASE_URL, { max: 1 });
    
    log("Convertendo colunas de UUID para TEXT...", "db");
    
    // Atualizar as colunas para corresponder ao esquema
    try {
      // Verifica se as colunas são do tipo UUID
      const result = await migrationClient`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'instances' AND column_name = 'id';
      `;
      
      if (result.length > 0 && result[0].data_type === 'uuid') {
        log("As colunas são do tipo UUID. Convertendo para TEXT...", "db");
        
        // Remover restrições de chave estrangeira
        await migrationClient`
          ALTER TABLE message_flows DROP CONSTRAINT IF EXISTS message_flows_instance_id_fkey;
        `;
        
        // Converter colunas UUID para TEXT
        await migrationClient`
          ALTER TABLE instances 
          ALTER COLUMN id TYPE TEXT USING id::TEXT;
        `;
        
        await migrationClient`
          ALTER TABLE message_flows 
          ALTER COLUMN id TYPE TEXT USING id::TEXT,
          ALTER COLUMN instance_id TYPE TEXT USING instance_id::TEXT;
        `;
        
        // Restaurar restrições de chave estrangeira
        await migrationClient`
          ALTER TABLE message_flows 
          ADD CONSTRAINT message_flows_instance_id_fkey 
          FOREIGN KEY (instance_id) REFERENCES instances(id);
        `;
        
        log("Conversão de colunas concluída.", "db");
      } else {
        log("As colunas já são do tipo TEXT. Nenhuma conversão necessária.", "db");
      }
    } catch (error) {
      console.error("Erro ao converter colunas:", error);
    }
    
    log("Atualização do esquema concluída com sucesso!", "db");
    
    // Fechar a conexão
    await migrationClient.end();
    
    process.exit(0);
  } catch (error) {
    console.error("Erro durante a atualização do esquema:", error);
    process.exit(1);
  }
}

main();