import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Este script adiciona a coluna avatar_url na tabela users
 */
async function main() {
  try {
    console.log("[migration] Verificando se a coluna avatar_url já existe...");
    
    // Verifica se a coluna já existe
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'avatar_url'
    `);
    
    if (result.length > 0) {
      console.log("[migration] A coluna avatar_url já existe na tabela users.");
    } else {
      console.log("[migration] Adicionando coluna avatar_url na tabela users...");
      
      // Adiciona a coluna avatar_url
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN avatar_url TEXT
      `);
      
      console.log("[migration] Coluna avatar_url adicionada com sucesso.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("[migration] Erro ao adicionar coluna avatar_url:", error);
    process.exit(1);
  }
}

main();