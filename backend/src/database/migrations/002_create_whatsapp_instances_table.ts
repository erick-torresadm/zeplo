import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('whatsapp_instances', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['disconnected', 'connecting', 'connected']).defaultTo('disconnected');
    table.text('qr_code').nullable();
    table.string('api_key').nullable().unique();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('whatsapp_instances');
} 