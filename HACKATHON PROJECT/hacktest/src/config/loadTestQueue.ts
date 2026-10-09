import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';
import { createModuleLogger } from '../utils/logger';

export const LOAD_TEST_QUEUE_NAME = 'hackpreview-load-tests';
export const LOAD_TEST_CANCEL_KEY_PREFIX = 'hackpreview:load-test-cancel:';

export interface LoadTestJobData {
  loadTestId: string;
}

const log = createModuleLogger('load-test-queue');
let connection: IORedis | undefined;
let queue: Queue<LoadTestJobData> | undefined;

export const getLoadTestQueue = (): Queue<LoadTestJobData> => {
  if (connection?.status === 'end') {
    connection = undefined;
    queue = undefined;
  }

  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: true,
      retryStrategy: (attempt) => attempt > 2 ? null : Math.min(attempt * 250, 1_000),
    });
    connection.on('error', (error: Error) => {
      log.error({ err: error }, 'Load-test queue Redis connection error');
    });
  }

  if (!queue) {
    queue = new Queue<LoadTestJobData>(LOAD_TEST_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 7 * 86_400, count: 5_000 },
      },
    });
    queue.on('error', (error: Error) => {
      log.error({ err: error }, 'Load-test queue error');
    });
  }
  return queue;
};

export const disconnectLoadTestQueue = async (): Promise<void> => {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
  if (connection && connection.status !== 'end') {
    if (connection.status === 'ready') await connection.quit();
    else connection.disconnect();
    connection = undefined;
  }
};
