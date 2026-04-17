import winston from 'winston';
import path from 'path';

export class Logger {
  private static instance: Logger;
  private winston: winston.Logger;

  private constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'p7-agent-runtime',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
          filename: path.join(logsDir, 'error.log'), 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        // Write all logs to combined.log
        new winston.transports.File({ 
          filename: path.join(logsDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        // Also log to console with colored output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({
              format: 'HH:mm:ss'
            }),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
              let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
              
              // Add metadata if present
              if (Object.keys(meta).length > 0) {
                logMessage += ` ${JSON.stringify(meta)}`;
              }
              
              return logMessage;
            })
          )
        })
      ],
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'exceptions.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ],
      // Handle unhandled rejections
      rejectionHandlers: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'rejections.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ]
    });

    // If we're not in production, log to console with more verbose output
    if (process.env.NODE_ENV !== 'production') {
      this.winston.add(new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, error?: any, meta?: any): void {
    if (error instanceof Error) {
      this.winston.error(message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...meta
      });
    } else if (error) {
      this.winston.error(message, {
        error: error,
        ...meta
      });
    } else {
      this.winston.error(message, meta);
    }
  }

  /**
   * Log fatal error and exit
   */
  fatal(message: string, error?: any): void {
    this.error(message, error);
    process.exit(1);
  }

  /**
   * Create a child logger with additional context
   */
  child(meta: any): winston.Logger {
    return this.winston.child(meta);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, meta?: any): void {
    this.info(`Performance: ${operation}`, {
      duration,
      operation,
      ...meta
    });
  }

  /**
   * Log HTTP request
   */
  request(method: string, url: string, statusCode: number, duration: number, meta?: any): void {
    this.info(`${method} ${url} ${statusCode} - ${duration}ms`, {
      method,
      url,
      statusCode,
      duration,
      type: 'http_request',
      ...meta
    });
  }

  /**
   * Log database query
   */
  query(query: string, duration: number, meta?: any): void {
    this.debug(`Database query executed in ${duration}ms`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      type: 'database_query',
      ...meta
    });
  }

  /**
   * Log AI processing event
   */
  aiEvent(event: string, details: any): void {
    this.info(`AI Event: ${event}`, {
      event,
      details,
      type: 'ai_processing',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log violation detection
   */
  violation(violationType: string, sessionId: string, confidence: number, meta?: any): void {
    this.info(`Violation detected: ${violationType}`, {
      violationType,
      sessionId,
      confidence,
      type: 'violation_detection',
      ...meta
    });
  }

  /**
   * Log escalation event
   */
  escalation(escalationId: string, sessionId: string, reason: string, meta?: any): void {
    this.info(`Escalation created: ${escalationId}`, {
      escalationId,
      sessionId,
      reason,
      type: 'escalation',
      ...meta
    });
  }

  /**
   * Log human override
   */
  override(overrideId: string, proctorId: string, action: string, meta?: any): void {
    this.info(`Human override: ${action}`, {
      overrideId,
      proctorId,
      action,
      type: 'human_override',
      ...meta
    });
  }

  /**
   * Log collaboration event
   */
  collaboration(collaborationId: string, event: string, participants: string[], meta?: any): void {
    this.info(`Collaboration ${event}: ${collaborationId}`, {
      collaborationId,
      event,
      participants,
      type: 'collaboration',
      ...meta
    });
  }

  /**
   * Log session event
   */
  session(sessionId: string, event: string, meta?: any): void {
    this.info(`Session ${event}: ${sessionId}`, {
      sessionId,
      event,
      type: 'session_event',
      ...meta
    });
  }

  /**
   * Log WebSocket event
   */
  websocket(event: string, clientId?: string, meta?: any): void {
    this.debug(`WebSocket ${event}`, {
      event,
      clientId,
      type: 'websocket',
      ...meta
    });
  }

  /**
   * Log security event
   */
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta?: any): void {
    const logLevel = severity === 'critical' ? 'error' : 
                     severity === 'high' ? 'warn' : 'info';
    
    this.winston[logLevel](`Security ${event}`, {
      event,
      severity,
      type: 'security',
      ...meta
    });
  }

  /**
   * Log configuration change
   */
  config(setting: string, oldValue: any, newValue: any, changedBy?: string): void {
    this.info(`Configuration changed: ${setting}`, {
      setting,
      oldValue,
      newValue,
      changedBy,
      type: 'config_change'
    });
  }

  /**
   * Log system startup
   */
  startup(service: string, version: string, port?: number, meta?: any): void {
    this.info(`Service started: ${service} v${version}`, {
      service,
      version,
      port,
      type: 'startup',
      ...meta
    });
  }

  /**
   * Log system shutdown
   */
  shutdown(service: string, reason?: string, meta?: any): void {
    this.info(`Service shutdown: ${service}`, {
      service,
      reason,
      type: 'shutdown',
      ...meta
    });
  }

  /**
   * Log health check
   */
  health(status: 'healthy' | 'unhealthy' | 'degraded', details?: any): void {
    const logLevel = status === 'healthy' ? 'debug' : 
                     status === 'degraded' ? 'warn' : 'error';
    
    this.winston[logLevel](`Health check: ${status}`, {
      status,
      details,
      type: 'health_check'
    });
  }

  /**
   * Log rate limiting event
   */
  rateLimit(identifier: string, limit: number, window: string, meta?: any): void {
    this.warn(`Rate limit exceeded: ${identifier}`, {
      identifier,
      limit,
      window,
      type: 'rate_limit',
      ...meta
    });
  }

  /**
   * Log authentication event
   */
  auth(event: 'login' | 'logout' | 'failed_login' | 'token_refresh', userId?: string, meta?: any): void {
    const logLevel = event === 'failed_login' ? 'warn' : 'info';
    
    this.winston[logLevel](`Authentication ${event}`, {
      event,
      userId,
      type: 'authentication',
      ...meta
    });
  }

  /**
   * Log cache event
   */
  cache(event: 'hit' | 'miss' | 'set' | 'delete' | 'clear', key?: string, meta?: any): void {
    this.debug(`Cache ${event}`, {
      event,
      key,
      type: 'cache',
      ...meta
    });
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(): () => number {
    const start = process.hrtime.bigint();
    
    return (): number => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1000000; // Convert nanoseconds to milliseconds
    };
  }

  /**
   * Log with custom structured format
   */
  structured(level: string, message: string, structured: any): void {
    this.winston.log(level, message, {
      structured: true,
      ...structured
    });
  }

  /**
   * Flush all transports
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.on('finish', resolve);
      this.winston.end();
    });
  }

  /**
   * Change log level at runtime
   */
  setLevel(level: string): void {
    this.winston.level = level;
    this.info(`Log level changed to: ${level}`);
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.winston.level;
  }
}