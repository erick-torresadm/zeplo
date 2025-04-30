import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Flow Nodes table
  await knex.schema.createTable('flow_nodes', (table) => {
    table.increments('id').primary();
    table.integer('flow_id').references('id').inTable('flows').onDelete('CASCADE');
    table.string('type').notNullable(); // start, message, condition, action, end
    table.string('name').notNullable();
    table.jsonb('data').defaultTo('{}'); // Store node-specific data
    table.float('position_x').notNullable();
    table.float('position_y').notNullable();
    table.timestamps(true, true);
  });

  // Flow Connections table
  await knex.schema.createTable('flow_connections', (table) => {
    table.increments('id').primary();
    table.integer('flow_id').references('id').inTable('flows').onDelete('CASCADE');
    table.integer('source_node_id').references('id').inTable('flow_nodes').onDelete('CASCADE');
    table.integer('target_node_id').references('id').inTable('flow_nodes').onDelete('CASCADE');
    table.string('condition').nullable(); // For conditional connections
    table.integer('delay').defaultTo(0); // Delay in seconds before executing next node
    table.timestamps(true, true);
  });

  // Flow Execution History
  await knex.schema.createTable('flow_executions', (table) => {
    table.increments('id').primary();
    table.integer('flow_id').references('id').inTable('flows').onDelete('CASCADE');
    table.integer('instance_id').references('id').inTable('instances').onDelete('CASCADE');
    table.string('status').notNullable(); // started, completed, failed
    table.string('current_node_id').nullable();
    table.jsonb('context').defaultTo('{}'); // Store execution context
    table.timestamp('started_at').notNullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
  });

  // Add new columns to flows table
  await knex.schema.alterTable('flows', (table) => {
    table.jsonb('settings').defaultTo('{}');
    table.string('description').nullable();
    table.string('version').defaultTo('1.0.0');
    table.boolean('is_draft').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('flow_executions');
  await knex.schema.dropTable('flow_connections');
  await knex.schema.dropTable('flow_nodes');
  await knex.schema.alterTable('flows', (table) => {
    table.dropColumn('settings');
    table.dropColumn('description');
    table.dropColumn('version');
    table.dropColumn('is_draft');
  });
} 