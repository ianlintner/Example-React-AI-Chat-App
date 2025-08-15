type Level = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel =
  (process.env.EXPO_PUBLIC_LOG_LEVEL as Level | undefined) ||
  (process.env.LOG_LEVEL as Level | undefined);

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.EXPO_PUBLIC_NODE_ENV === 'production';

const currentLevel: Level = envLevel || (isProd ? 'info' : 'debug');

function shouldLog(level: Level): boolean {
  return levelOrder[level] >= levelOrder[currentLevel];
}

function formatMessage(args: any[]): any[] {
  // Keep formatting simple; attach JSON objects as-is
  return args;
}

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(...formatMessage(args));
    }
  },
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(...formatMessage(args));
    }
  },
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(...formatMessage(args));
    }
  },
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(...formatMessage(args));
    }
  },
};

export type Logger = typeof logger;
