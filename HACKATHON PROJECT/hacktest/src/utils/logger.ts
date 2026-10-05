/**
 * Pino Logger
 * 
 * WHY PINO: It's the fastest Node.js logger (5x faster than Winston).
 * It outputs structured JSON in production (easy to parse by log aggregators
 * like Datadog, ELK, etc.) and pretty-prints in development for readability.
 * 
 * WHY NOT console.log: 
 * - No log levels (can't filter info vs error vs debug)
 * - No structured output (can't search/filter JSON fields)
 * - No timestamps
 * - Slower in high-throughput scenarios
 * 
 * SECURITY: We configure Pino to redact sensitive fields. If any object
 * containing "password", "token", etc. is accidentally logged, Pino
 * replaces those values with "[REDACTED]".
 */

import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  // Log level: 'debug' in development, 'info' in production
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',

  // Redact sensitive fields from ALL log output
  // If you accidentally do logger.info({user: {password: "secret"}}),
  // the password will show as "[REDACTED]"
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },

  // Pretty-print in development, JSON in production
  transport: env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard', // Human-readable timestamps
          ignore: 'pid,hostname',        // Less noise in dev
        },
      }
    : undefined, // In production, use default JSON output
});

// Export a child logger factory for modules to create named loggers
// Usage: const log = createModuleLogger('auth');
//        log.info('User logged in'); → outputs: {"module": "auth", "msg": "User logged in"}
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};
