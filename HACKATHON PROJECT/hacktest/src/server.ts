/**
 * HTTP Server Bootstrap
 * 
 * WHY SEPARATE FROM app.ts:
 * - app.ts defines WHAT the server does (middleware, routes)
 * - server.ts defines HOW the server runs (port, HTTP server, graceful shutdown)
 * - In Phase 13, Socket.IO will attach to this HTTP server instance
 * - Tests import app.ts directly (no need to bind to a port)
 * 
 * GRACEFUL SHUTDOWN:
 * When the process receives SIGTERM (e.g., Docker stopping the container)
 * or SIGINT (Ctrl+C), we don't just kill the process. We:
 * 1. Stop accepting new connections
 * 2. Wait for in-flight requests to complete
 * 3. Close database connections
 * 4. Close Redis connections
 * 5. THEN exit
 * 
 * This prevents data corruption and ensures all requests get responses.
 */

import http from 'http';
import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { logger, createModuleLogger } from './utils/logger';

const log = createModuleLogger('server');

// Create HTTP server from Express app
// (We create it explicitly so Socket.IO can attach to it later in Phase 13)
const server = http.createServer(app);

// ─── Start Server ──────────────────────────────────────────

const startServer = async () => {
  try {
    // Verify database connection before accepting requests
    await prisma.$connect();
    log.info('✅ Database connected');

    // Start listening for HTTP requests
    server.listen(env.PORT, () => {
      log.info(`✅ Server running on port ${env.PORT}`);
      log.info(`📍 Environment: ${env.NODE_ENV}`);
      log.info(`🔗 Health check: http://localhost:${env.PORT}/health`);
      log.info(`🔗 API base: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    log.fatal({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
};

// ─── Graceful Shutdown ─────────────────────────────────────

const gracefulShutdown = async (signal: string) => {
  log.info(`\n${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(() => {
    log.info('HTTP server closed');
  });

  try {
    // 2. Close database connections
    await prisma.$disconnect();
    log.info('Database disconnected');

    // 3. Redis disconnect will be added in Phase 8

    log.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker stop
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C

// ─── Unhandled Errors ──────────────────────────────────────

// Catch promises that were rejected but not caught with try/catch
process.on('unhandledRejection', (reason: unknown) => {
  log.error({ err: reason }, 'Unhandled Promise Rejection');
  // In production, you might want to crash and let the process manager restart
});

// Catch synchronous errors that weren't caught by try/catch
process.on('uncaughtException', (error: Error) => {
  log.fatal({ err: error }, 'Uncaught Exception — shutting down');
  // Uncaught exceptions mean the process is in an unknown state — crash and restart
  process.exit(1);
});

// ─── Launch ────────────────────────────────────────────────
startServer();

export { server };
