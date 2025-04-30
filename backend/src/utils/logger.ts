import winston from 'winston';
import { config } from 'dotenv';

// Load environment variables
config();

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Create format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create format for file
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: fileFormat,
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Write all logs to zeplo-error.log
    new winston.transports.File({
      filename: 'logs/zeplo-error.log',
      level: 'error',
    }),
    // Write all logs to zeplo-combined.log
    new winston.transports.File({ filename: 'logs/zeplo-combined.log' }),
  ],
});

// Shorthand for logging errors
export const logError = (message: string, error: any): void => {
  if (error instanceof Error) {
    logger.error(`${message}: ${error.message}`);
    logger.debug(error.stack);
  } else {
    logger.error(`${message}: ${JSON.stringify(error)}`);
  }
};

export default logger;

// Helper functions for common logging patterns
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

export const logWarning = (message: string, meta?: any) => {
  logger.warn(message, meta);
}; 