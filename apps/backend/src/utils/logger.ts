/**
 * Structured logging with Pino
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: ['password', 'token', 'accessToken', 'refreshToken', 'apiKey'],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}
