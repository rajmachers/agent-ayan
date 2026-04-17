import winston from 'winston';
import { config } from '../config';

const isDevelopment = config.app.environment === 'development';

export const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
      const { timestamp, level, message, service = 'agent-runtime', ...meta } = info;
      return JSON.stringify({
        timestamp,
        level,
        service,
        message,
        ...(Object.keys(meta).length > 0 && { meta }),
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      format: isDevelopment
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : winston.format.json(),
    }),
  ],
});