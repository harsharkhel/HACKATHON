import http from 'node:http';
import app from './app';
import { env } from './config/env';
import { createModuleLogger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './services/database.service';

const log = createModuleLogger('server');
const server = http.createServer(app);

const startServer = async (): Promise<void> => {
  await connectDatabase();
  server.listen(env.PORT, () => {
    log.info({ port: env.PORT, environment: env.NODE_ENV }, 'HackPreview API listening');
  });
};

const shutdown = (signal: NodeJS.Signals): void => {
  log.info({ signal }, 'Shutting down HTTP server');
  server.close((error) => {
    if (error) {
      log.error({ err: error }, 'HTTP server failed to close cleanly');
      process.exitCode = 1;
    }

    void disconnectDatabase().catch((disconnectError: unknown) => {
      log.error({ err: disconnectError }, 'Failed to close PostgreSQL connection');
      process.exitCode = 1;
    });
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void startServer().catch((error: unknown) => {
  log.fatal({ err: error }, 'Failed to start HackPreview API');
  process.exitCode = 1;
});

export { server };
