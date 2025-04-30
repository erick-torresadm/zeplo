import { Knex } from 'knex';

/**
 * Migração para remover o campo 'description' da tabela 'flows'
 * e adicionar uma flag 'is_draft' caso não exista
 */
export async function up(knex: Knex): Promise<void> {
  // Verificar se a coluna 'description' existe antes de tentar removê-la
  const hasDescriptionColumn = await knex.schema.hasColumn('flows', 'description');
  
  if (hasDescriptionColumn) {
    await knex.schema.alterTable('flows', (table) => {
      table.dropColumn('description');
    });
    console.log('Coluna "description" removida da tabela "flows"');
  } else {
    console.log('Coluna "description" não existe na tabela "flows", pulando');
  }
  
  // Verificar se a coluna 'is_draft' existe, caso não, adicionar
  const hasIsDraftColumn = await knex.schema.hasColumn('flows', 'is_draft');
  
  if (!hasIsDraftColumn) {
    await knex.schema.alterTable('flows', (table) => {
      table.boolean('is_draft').defaultTo(true);
    });
    console.log('Coluna "is_draft" adicionada à tabela "flows"');
  } else {
    console.log('Coluna "is_draft" já existe na tabela "flows", pulando');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Reverter as alterações (adicionar description e remover is_draft)
  const hasIsDraftColumn = await knex.schema.hasColumn('flows', 'is_draft');
  
  if (hasIsDraftColumn) {
    await knex.schema.alterTable('flows', (table) => {
      // Criar a coluna description novamente
      table.text('description').nullable();
    });
  }
} 