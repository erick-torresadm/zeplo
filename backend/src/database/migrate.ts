import { db } from './connection';
import { logger } from '../utils/logger';
import path from 'path';
import { fileURLToPath } from 'url';

// Compatibilidade com ESM para obter o dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateDatabase() {
  try {
    // Create the uuid-ossp extension if it doesn't exist (for UUID generation)
    await db.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Run migrations
    logger.info('Running migrations...');
    
    // Caminho absoluto para o diretório de migrações
    const migrationsPath = path.join(__dirname, 'migrations');
    logger.info(`Migrações serão carregadas de: ${migrationsPath}`);
    
    await db.migrate.latest({
      directory: migrationsPath,
    });
    
    const version = await db.migrate.currentVersion();
    logger.info(`Migrations completed successfully. Current version: ${version}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

async function rollbackMigration() {
  try {
    logger.info('Rolling back the latest migration...');
    
    // Caminho absoluto para o diretório de migrações
    const migrationsPath = path.join(__dirname, 'migrations');
    
    await db.migrate.down({
      directory: migrationsPath,
    });
    
    const version = await db.migrate.currentVersion();
    logger.info(`Rollback completed successfully. Current version: ${version}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Rollback failed:', error);
    process.exit(1);
  }
}

// Check if we're running a rollback
const isRollback = process.argv.includes('rollback');

if (isRollback) {
  rollbackMigration();
} else {
  migrateDatabase();
} 