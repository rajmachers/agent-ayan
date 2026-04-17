import winston from 'winston';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.colorize({ all: true }),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} [P7-CONTROL-PLANE] ${level}: ${stack || message}`;
        })
      ),
      defaultMeta: { 
        service: 'p7-control-plane',
        version: '1.0.0',
        port: process.env.PORT || 13002
      },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: '../../logs/enhanced/p7-control-plane.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ],
    });

    // Handle uncaught exceptions and rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: '../../logs/enhanced/p7-control-plane-exceptions.log' })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ filename: '../../logs/enhanced/p7-control-plane-rejections.log' })
    );
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public error(message: string, error?: any): void {
    this.logger.error(message, { error: error?.stack || error });
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}