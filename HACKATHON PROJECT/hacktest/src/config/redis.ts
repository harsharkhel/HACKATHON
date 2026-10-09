import { createClient } from 'redis';
import { env } from './env';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('redis');
const client = createClient({
  url: env.REDIS_URL,
  socket: { connectTimeout: 1_000, reconnectStrategy: false },
});
let connection: Promise<void> | undefined;

client.on('error', (error: Error) => {
  log.error({ err: error }, 'Redis connection error');
});

const getClient = async () => {
  if (client.isOpen) return client;
  connection ??= client.connect().finally(() => {
    connection = undefined;
  });
  await connection;
  return client;
};

export const setTemporaryState = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
  const redis = await getClient();
  await redis.set(key, value, { EX: ttlSeconds });
};

export const getTemporaryState = async (key: string): Promise<string | null> => {
  const redis = await getClient();
  return redis.get(key);
};

export const deleteTemporaryState = async (key: string): Promise<void> => {
  const redis = await getClient();
  await redis.del(key);
};
