import pino from 'pino';
/**
 * Simple Pino wrapper that implements the ILogger interface
 */
class PinoLoggerWrapper {
    pinoInstance;
    constructor(pinoInstance) {
        this.pinoInstance = pinoInstance;
    }
    isDebugEnabled() {
        return this.pinoInstance.level === 'debug';
    }
    trace(objOrMsg, msg) {
        if (typeof objOrMsg === 'string') {
            this.pinoInstance.trace(objOrMsg);
        }
        else {
            this.pinoInstance.trace(objOrMsg, msg);
        }
    }
    debug(objOrMsg, msg) {
        if (typeof objOrMsg === 'string') {
            this.pinoInstance.debug(objOrMsg);
        }
        else {
            this.pinoInstance.debug(objOrMsg, msg);
        }
    }
    info(objOrMsg, msg) {
        if (typeof objOrMsg === 'string') {
            this.pinoInstance.info(objOrMsg);
        }
        else {
            this.pinoInstance.info(objOrMsg, msg);
        }
    }
    warn(objOrMsg, msg) {
        if (typeof objOrMsg === 'string') {
            this.pinoInstance.warn(objOrMsg);
        }
        else {
            this.pinoInstance.warn(objOrMsg, msg);
        }
    }
    error(objOrMsg, msg) {
        if (typeof objOrMsg === 'string') {
            this.pinoInstance.error(objOrMsg);
        }
        else {
            this.pinoInstance.error(objOrMsg, msg);
        }
    }
    fatal(objOrMsg, msg) {
        if (typeof objOrMsg === 'string') {
            this.pinoInstance.fatal(objOrMsg);
        }
        else {
            this.pinoInstance.fatal(objOrMsg, msg);
        }
    }
    child(bindings) {
        return new PinoLoggerWrapper(this.pinoInstance.child(bindings));
    }
}
// Configure Pino
const pinoConfig = {
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
export const createModuleLogger = (module) => {
    return logger.child({ module });
};
// Helper function to log errors with context
export const logError = (logger, error, context) => {
    const errorInfo = {
        error,
        ...context,
    };
    logger.error(errorInfo, 'An error occurred');
};
