import winston from 'winston';
import { config } from '../config';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: 'api-gateway',
      ...meta
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'ayan-api-gateway',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.environment,
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
  ],
});

// Add file transport in production
if (config.environment === 'production') {
  logger.add(new winston.transports.File({
    filename: '/var/log/ayan/api-gateway-error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));

  logger.add(new winston.transports.File({
    filename: '/var/log/ayan/api-gateway.log',
    maxsize: 5242880, // 5MB
    maxFiles: 10,
  }));
}

// Request correlation ID functionality
export function createRequestLogger(correlationId: string) {
  return logger.child({ correlationId });
}