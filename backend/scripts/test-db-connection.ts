import { config } from 'dotenv';
import knex from 'knex';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

// Database configuration
const dbConfig = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  debug: process.env.NODE_ENV === 'development'
};

async function testDatabaseConnection() {
  logger.info('🔄 Testing database connection...');
  logger.info('Configuration:');
  logger.info(`Host: ${dbConfig.connection.host}`);
  logger.info(`Port: ${dbConfig.connection.port}`);
  logger.info(`Database: ${dbConfig.connection.database}`);
  logger.info(`User: ${dbConfig.connection.user}`);

  const db = knex(dbConfig);

  try {
    // Test connection with a simple query
    const result = await db.raw('SELECT NOW()');
    logger.info('\n✅ Database connection established successfully!');
    logger.info(`Server timestamp: ${result.rows[0].now}`);

    // List all tables
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    logger.info('\nTables found:');
    if (tables.rows.length === 0) {
      logger.info('No tables found. Database might be empty.');
    } else {
      tables.rows.forEach((row: any) => {
        logger.info(`- ${row.table_name}`);
      });
    }

    // Get row counts from main tables
    const tablesList = tables.rows.map((row: any) => row.table_name);
    
    logger.info('\nTable row counts:');
    for (const table of tablesList) {
      try {
        const countResult = await db(table).count('* as count').first();
        logger.info(`- ${table}: ${countResult ? countResult.count : 0} rows`);
      } catch (error) {
        logger.error(`- Error getting count for ${table}`);
      }
    }

    return true;
  } catch (error: any) {
    logger.error('\n❌ Database connection error:', error.message);
    if (error.code) {
      logger.error('Error code:', error.code);
    }
    
    // Check common error codes
    if (error.code === 'ECONNREFUSED') {
      logger.error('The database server is not running or not accessible with the current configuration.');
    } else if (error.code === '28P01') {
      logger.error('Authentication failed. Check your database username and password.');
    } else if (error.code === '3D000') {
      logger.error('The database does not exist.');
    }
    
    return false;
  } finally {
    // Always close the connection
    await db.destroy();
    logger.info('\nDatabase connection closed.');
  }
}

// Run the test
testDatabaseConnection()
  .then((success) => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error('Unexpected error:', error);
    process.exit(1);
  }); 