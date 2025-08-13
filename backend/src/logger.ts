import pino, { Logger } from 'pino';
import { tracingContextManager } from './tracing/contextManager';

const isProd = process.env.NODE_ENV === 'production';

const baseOptions = {
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: {
    service: 'ai-goal-seeking-backend',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  redact: {
    paths: [
      'req.headers.authorization',
      'headers.authorization',
      'password',
      'token',
      '*.token',
    ],
    remove: true,
  },
  formatters: {
    level(label: string) {
      return { level: label };
    },
    bindings(bindings: pino.Bindings) {
      return { pid: bindings.pid, host: bindings.hostname };
    },
  },
};

const logger: Logger = isProd
  ? pino(baseOptions)
  : pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,host',
          singleLine: false,
        },
      },
    });

/**
 * Returns the root logger or a child logger bound with current trace context if available.
 */
export function getLogger(bindTrace = true): Logger {
  if (!bindTrace) {
    return logger;
  }
  const trace = tracingContextManager.getCurrentTraceInfo();
  if (trace) {
    return logger.child({
      traceId: trace.traceId,
      spanId: trace.spanId,
      traceFlags: trace.traceFlags,
    });
  }
  return logger;
}

export { logger };

/**
 * Monkey-patch console to route through pino, so any remaining console.* calls
 * are emitted via the structured logger. This preserves output now and can be
 * removed once all callsites are fully migrated.
 */
export function patchConsole(): void {
  const bind = (method: 'info' | 'warn' | 'error' | 'debug') => {
    return (...args: any[]) => {
      const l = getLogger();
      const [first, ...rest] = args;

      // Error objects route as error with stack
      if (first instanceof Error) {
        // @ts-ignore - pino accepts Error as first arg
        return (l as any)[method](first, ...rest);
      }

      if (typeof first === 'string') {
        // Treat first string as message, attach the rest as args array for context
        return (l as any)[method]({ args: rest }, first);
      }

      if (typeof first === 'object' && first !== null) {
        // If next is a string, treat as message; otherwise log object
        if (rest.length && typeof rest[0] === 'string') {
          const [msg, ...tail] = rest;
          return (l as any)[method](first, msg, ...tail);
        }
        return (l as any)[method](first);
      }

      // Fallback
      return (l as any)[method]({ args });
    };
  };

  // eslint-disable-next-line no-console
  console.log = bind('info');
  // eslint-disable-next-line no-console
  console.info = bind('info');
  // eslint-disable-next-line no-console
  console.warn = bind('warn');
  // eslint-disable-next-line no-console
  console.error = bind('error');
  // eslint-disable-next-line no-console
  console.debug = bind('debug');
}
