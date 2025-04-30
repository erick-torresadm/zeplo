import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    table.integer('instance_id').references('id').inTable('instances').onDelete('CASCADE');
    table.string('message_id').notNullable();
    table.string('from').notNullable();
    table.string('to').notNullable();
    table.text('content').notNullable();
    table.string('type').notNullable();
    table.timestamp('timestamp').notNullable();
    table.timestamps(true, true);

    // Indexes
    table.index(['instance_id', 'timestamp']);
    table.index(['from', 'to']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
} 