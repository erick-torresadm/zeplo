import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.string('name').notNullable();
    table.string('plan').defaultTo('free');
    table.timestamp('trial_ends_at');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // WhatsApp Instances
  await knex.schema.createTable('instances', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('status').defaultTo('disconnected');
    table.string('api_key');
    table.jsonb('settings').defaultTo('{}');
    table.timestamps(true, true);
  });

  // Message Flows
  await knex.schema.createTable('flows', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('trigger_type').notNullable(); // keyword, manual, scheduled
    table.string('trigger_value'); // keyword value or cron expression
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // Flow Steps
  await knex.schema.createTable('flow_steps', (table) => {
    table.increments('id').primary();
    table.integer('flow_id').references('id').inTable('flows').onDelete('CASCADE');
    table.integer('order').notNullable();
    table.string('type').notNullable(); // text, image, video, audio, document
    table.text('content');
    table.string('media_url');
    table.integer('delay').defaultTo(0); // delay in seconds
    table.jsonb('settings').defaultTo('{}');
    table.timestamps(true, true);
  });

  // Media Library
  await knex.schema.createTable('media', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').notNullable(); // image, video, audio, document
    table.string('url').notNullable();
    table.string('mime_type');
    table.integer('size');
    table.timestamps(true, true);
  });

  // Contacts
  await knex.schema.createTable('contacts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('phone').notNullable();
    table.string('name');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
  });

  // Message History
  await knex.schema.createTable('message_history', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.integer('instance_id').references('id').inTable('instances');
    table.integer('flow_id').references('id').inTable('flows');
    table.string('direction').notNullable(); // incoming, outgoing
    table.string('status').notNullable(); // sent, delivered, read, failed
    table.string('phone').notNullable();
    table.text('content');
    table.string('media_url');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('message_history');
  await knex.schema.dropTable('contacts');
  await knex.schema.dropTable('media');
  await knex.schema.dropTable('flow_steps');
  await knex.schema.dropTable('flows');
  await knex.schema.dropTable('instances');
  await knex.schema.dropTable('users');
} 