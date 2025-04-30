import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('flows', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.text('description').nullable();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.jsonb('nodes').defaultTo('[]');
    table.jsonb('connections').defaultTo('[]');
    table.boolean('is_published').defaultTo(false);
    table.string('trigger_keyword').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('flows');
} 