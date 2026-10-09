import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { LoadTestStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { disconnectRedis } from '../config/redis';
import {
  disconnectLoadTestQueue,
  LOAD_TEST_CANCEL_KEY_PREFIX,
  LOAD_TEST_PROGRESS_KEY_PREFIX,
  LOAD_TEST_QUEUE_NAME,
  type LoadTestJobData,
} from '../config/loadTestQueue';
import { setTemporaryState } from '../config/redis';
import { disconnectDatabase } from '../services/database.service';
import { createModuleLogger } from '../utils/logger';
import { runLoadTest } from '../modules/load-tests/loadTest.worker.service';

const log = createModuleLogger('load-test-worker');
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const activeJobs = new Set<string>();
let shuttingDown: Promise<void> | undefined;

const worker = new Worker<LoadTestJobData>(
  LOAD_TEST_QUEUE_NAME,
  async (job: Job<LoadTestJobData>) => {
    activeJobs.add(job.data.loadTestId);
    try {
      await runLoadTest(job.data.loadTestId);
    } finally {
      activeJobs.delete(job.data.loadTestId);
    }
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 90_000,
    stalledInterval: 30_000,
    maxStalledCount: 1,
  },
);

worker.on('completed', (job) => {
  log.info({ loadTestId: job.data.loadTestId, jobId: job.id }, 'Queue job completed');
});

worker.on('failed', async (job, error) => {
  log.error({
    err: error,
    loadTestId: job?.data.loadTestId,
    attemptsMade: job?.attemptsMade,
    attempts: job?.opts.attempts,
  }, 'Queue job attempt failed');

  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  try {
    const record = await prisma.loadTest.findUnique({
      where: { id: job.data.loadTestId },
      select: {
        cancelRequestedAt: true,
        totalRequests: true,
        successfulRequests: true,
        failedRequests: true,
        requestsPerSecond: true,
        averageResponseTime: true,
        status: true,
      },
    });
    const finalStatus = record?.cancelRequestedAt ? LoadTestStatus.CANCELLED : LoadTestStatus.FAILED;
    await prisma.loadTest.updateMany({
      where: {
        id: job.data.loadTestId,
        status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] },
      },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        errorMessage: record?.cancelRequestedAt
          ? null
          : 'The load-test worker failed after retrying. Please retry the test.',
      },
    });
    if (record && ![LoadTestStatus.COMPLETED, LoadTestStatus.CANCELLED].includes(record.status)) {
      await setTemporaryState(
        `${LOAD_TEST_PROGRESS_KEY_PREFIX}${job.data.loadTestId}`,
        JSON.stringify({
          status: finalStatus.toLowerCase(),
          currentRequests: record.totalRequests,
          successfulRequests: record.successfulRequests,
          failedRequests: record.failedRequests,
          currentRps: record.requestsPerSecond ?? 0,
          currentLatency: record.averageResponseTime,
          progress: 100,
          updatedAt: new Date().toISOString(),
        }),
        2 * 60 * 60,
      );
    }
  } catch (failureError) {
    log.error({ err: failureError, loadTestId: job.data.loadTestId }, 'Unable to persist terminal job failure');
  }
});

worker.on('stalled', (jobId) => {
  log.warn({ jobId }, 'Load-test job stalled and will be recovered by the queue');
});

worker.on('error', (error) => {
  log.error({ err: error }, 'Load-test worker error');
});

const shutdown = (signal: NodeJS.Signals): void => {
  log.info({ signal }, 'Gracefully stopping load-test worker');
  shuttingDown ??= (async () => {
    await Promise.all([...activeJobs].map(async (loadTestId) => {
      try {
        await prisma.loadTest.updateMany({
          where: { id: loadTestId, status: LoadTestStatus.RUNNING },
          data: { cancelRequestedAt: new Date() },
        });
        await connection.set(`${LOAD_TEST_CANCEL_KEY_PREFIX}${loadTestId}`, '1', 'EX', 120);
      } catch (error) {
        log.error({ err: error, loadTestId }, 'Unable to request active load-test cancellation');
      }
    }));
    await worker.close();
    if (connection.status === 'ready') await connection.quit();
    else connection.disconnect();
    await Promise.all([
      disconnectDatabase(),
      disconnectRedis(),
      disconnectLoadTestQueue(),
    ]);
    log.info('Load-test worker stopped');
  })().catch((error: unknown) => {
    log.fatal({ err: error }, 'Load-test worker shutdown failed');
    process.exitCode = 1;
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

void worker.waitUntilReady().then(() => {
  log.info({ queue: LOAD_TEST_QUEUE_NAME }, 'Load-test worker ready');
}).catch((error: unknown) => {
  log.fatal({ err: error }, 'Unable to start load-test worker');
  shutdown('SIGTERM');
  process.exitCode = 1;
});

export { worker };
