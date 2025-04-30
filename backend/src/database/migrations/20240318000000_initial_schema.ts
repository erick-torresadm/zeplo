import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.timestamps(true, true);
  });

  // Contacts table
  await knex.schema.createTable('contacts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('phone').notNullable();
    table.string('email');
    table.text('notes');
    table.timestamps(true, true);
  });

  // Media table
  await knex.schema.createTable('media', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').notNullable();
    table.string('key').notNullable();
    table.string('url').notNullable();
    table.string('mime_type').notNullable();
    table.bigInteger('size').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('media');
  await knex.schema.dropTableIfExists('contacts');
  await knex.schema.dropTableIfExists('users');
} 