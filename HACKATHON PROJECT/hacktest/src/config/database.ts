/**
 * Prisma Database Client (Singleton)
 * 
 * WHY SINGLETON: Prisma Client manages a connection pool internally.
 * Creating multiple instances would create multiple connection pools,
 * exhausting database connections. We create ONE instance and reuse it.
 * 
 * WHY THIS PATTERN: In development, hot-reloading (nodemon) re-executes
 * this file on every save. Without the globalThis trick, each reload
 * creates a new Prisma Client, leading to "Too many connections" errors.
 * The globalThis pattern stores the client on the Node.js global object,
 * which persists across hot reloads.
 */

import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Declare a global variable to hold the Prisma client across hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse existing client or create a new one
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log queries in development for debugging, only errors in production
    log: env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

// In development, store on globalThis so hot reloads reuse the same client
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
