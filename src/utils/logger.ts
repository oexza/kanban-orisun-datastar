import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogContext = Record<string, any>;

/**
 * Simple logger interface that abstracts the underlying logging implementation
 */
export interface ILogger {
  trace(obj: LogContext, msg?: string): void;
  trace(msg: string): void;
  debug(obj: LogContext, msg?: string): void;
  debug(msg: string): void;
  info(obj: LogContext, msg?: string): void;
  info(msg: string): void;
  warn(obj: LogContext, msg?: string): void;
  warn(msg: string): void;
  error(obj: LogContext, msg?: string): void;
  error(msg: string): void;
  fatal(obj: LogContext, msg?: string): void;
  fatal(msg: string): void;
  child(bindings: LogContext): ILogger;
  isDebugEnabled(): boolean;

}

/**
 * Simple Pino wrapper that implements the ILogger interface
 */
class PinoLoggerWrapper implements ILogger {
  constructor(private pinoInstance: pino.Logger) {}
  isDebugEnabled(): boolean {
    return this.pinoInstance.level === 'debug';
  }

  trace(obj: LogContext, msg?: string): void;
  trace(msg: string): void;
  trace(objOrMsg: LogContext | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pinoInstance.trace(objOrMsg);
    } else {
      this.pinoInstance.trace(objOrMsg, msg);
    }
  }

  debug(obj: LogContext, msg?: string): void;
  debug(msg: string): void;
  debug(objOrMsg: LogContext | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pinoInstance.debug(objOrMsg);
    } else {
      this.pinoInstance.debug(objOrMsg, msg);
    }
  }

  info(obj: LogContext, msg?: string): void;
  info(msg: string): void;
  info(objOrMsg: LogContext | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pinoInstance.info(objOrMsg);
    } else {
      this.pinoInstance.info(objOrMsg, msg);
    }
  }

  warn(obj: LogContext, msg?: string): void;
  warn(msg: string): void;
  warn(objOrMsg: LogContext | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pinoInstance.warn(objOrMsg);
    } else {
      this.pinoInstance.warn(objOrMsg, msg);
    }
  }

  error(obj: LogContext, msg?: string): void;
  error(msg: string): void;
  error(objOrMsg: LogContext | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pinoInstance.error(objOrMsg);
    } else {
      this.pinoInstance.error(objOrMsg, msg);
    }
  }

  fatal(obj: LogContext, msg?: string): void;
  fatal(msg: string): void;
  fatal(objOrMsg: LogContext | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pinoInstance.fatal(objOrMsg);
    } else {
      this.pinoInstance.fatal(objOrMsg, msg);
    }
  }

  child(bindings: LogContext): ILogger {
    return new PinoLoggerWrapper(this.pinoInstance.child(bindings));
  }
}

// Configure Pino
const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
};

// Create base logger
const baseLogger = pino(pinoConfig);
export const logger = new PinoLoggerWrapper(baseLogger);

// Helper function to create module loggers
export const createModuleLogger = (module: string): ILogger => {
  return logger.child({ module });
};

// Helper function to log errors with context
export const logError = (logger: ILogger, error: unknown, context?: LogContext) => {
  const errorInfo = {
    error,
    ...context,
  };

  logger.error(errorInfo, 'An error occurred');
};