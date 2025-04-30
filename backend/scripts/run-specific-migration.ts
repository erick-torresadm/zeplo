import { db } from '../src/database/connection';
import { logger } from '../src/utils/logger';
import path from 'path';
import { fileURLToPath } from 'url';

// Compatibilidade com ESM para obter o dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSpecificMigration() {
  try {
    logger.info('Executando migração específica para atualizar a tabela flows...');
    
    // Verificar se a coluna 'is_draft' existe na tabela 'flows'
    const hasIsDraftColumn = await db.schema.hasColumn('flows', 'is_draft');
    
    if (!hasIsDraftColumn) {
      logger.info('Adicionando coluna "is_draft" à tabela "flows"');
      
      await db.schema.alterTable('flows', (table) => {
        table.boolean('is_draft').defaultTo(true);
      });
      
      logger.info('Coluna "is_draft" adicionada com sucesso à tabela "flows"');
    } else {
      logger.info('Coluna "is_draft" já existe na tabela "flows", pulando');
    }
    
    // Verificar se a coluna 'description' existe na tabela 'flows'
    const hasDescriptionColumn = await db.schema.hasColumn('flows', 'description');
    
    if (hasDescriptionColumn) {
      logger.info('Removendo coluna "description" da tabela "flows"');
      
      await db.schema.alterTable('flows', (table) => {
        table.dropColumn('description');
      });
      
      logger.info('Coluna "description" removida com sucesso da tabela "flows"');
    } else {
      logger.info('Coluna "description" não existe na tabela "flows", pulando');
    }

    // Verificar se a coluna 'trigger_type' existe e definir um valor padrão
    const hasTriggerTypeColumn = await db.schema.hasColumn('flows', 'trigger_type');
    
    if (hasTriggerTypeColumn) {
      logger.info('Atualizando coluna "trigger_type" na tabela "flows" para permitir valores nulos ou definir um valor padrão');
      
      try {
        // Tentando definir um valor padrão para registros existentes
        await db('flows')
          .whereNull('trigger_type')
          .update({ trigger_type: 'message' });
        
        // Alterando a coluna para ter um valor padrão
        await db.schema.alterTable('flows', (table) => {
          table.string('trigger_type').defaultTo('message').alter();
        });
        
        logger.info('Coluna "trigger_type" atualizada com sucesso');
      } catch (error) {
        logger.error('Erro ao atualizar coluna "trigger_type":', error);
      }
    }

    // Modificar a restrição de chave estrangeira para user_id
    logger.info('Modificando a restrição de chave estrangeira para user_id para permitir nulos...');
    
    try {
      // Primeiro verificamos se a coluna user_id é nullable
      const userIdInfo = await db.raw(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'flows' AND column_name = 'user_id'
      `);
      
      const isNullable = userIdInfo.rows && userIdInfo.rows[0] ? userIdInfo.rows[0].is_nullable === 'YES' : false;
      
      if (!isNullable) {
        // Precisamos remover a restrição de chave estrangeira existente
        // Primeiro, obtemos o nome da restrição
        const constraintInfo = await db.raw(`
          SELECT conname as constraint_name
          FROM pg_constraint
          JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
          WHERE pg_class.relname = 'flows' AND pg_constraint.contype = 'f' AND pg_get_constraintdef(pg_constraint.oid) LIKE '%user_id%'
        `);
        
        if (constraintInfo.rows && constraintInfo.rows.length > 0) {
          const constraintName = constraintInfo.rows[0].constraint_name;
          
          // Removemos a restrição existente
          await db.schema.alterTable('flows', (table) => {
            table.dropForeign(['user_id'], constraintName);
          });
          
          logger.info(`Restrição de chave estrangeira '${constraintName}' removida com sucesso`);
        }
        
        // Alteramos a coluna user_id para permitir nulos
        await db.schema.alterTable('flows', (table) => {
          table.integer('user_id').nullable().alter();
        });
        
        // Se for necessário, adicionamos uma nova restrição que permite nulos
        await db.schema.alterTable('flows', (table) => {
          table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
        });
        
        logger.info('Restrição de chave estrangeira modificada com sucesso');
      } else {
        logger.info('A coluna user_id já permite valores nulos, pulando modificação');
      }
    } catch (error) {
      logger.error('Erro ao modificar restrição de chave estrangeira:', error);
    }
    
    logger.info('Migração específica concluída com sucesso');
    process.exit(0);
  } catch (error) {
    logger.error('Falha na migração específica:', error);
    process.exit(1);
  }
}

// Executar a migração
runSpecificMigration(); 