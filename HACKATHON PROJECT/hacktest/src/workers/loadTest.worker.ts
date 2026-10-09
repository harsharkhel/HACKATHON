import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { LoadTestStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { deleteTemporaryState, setTemporaryState } from '../config/redis';
import {
  disconnectLoadTestQueue,
  LOAD_TEST_CANCEL_KEY_PREFIX,
  LOAD_TEST_QUEUE_NAME,
  type LoadTestJobData,
} from '../config/loadTestQueue';
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
      select: { cancelRequestedAt: true },
    });
    await prisma.loadTest.updateMany({
      where: {
        id: job.data.loadTestId,
        status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] },
      },
      data: {
        status: record?.cancelRequestedAt ? LoadTestStatus.CANCELLED : LoadTestStatus.FAILED,
        completedAt: new Date(),
        errorMessage: record?.cancelRequestedAt
          ? null
          : 'The load-test worker failed after retrying. Please retry the test.',
      },
    });
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
    await Promise.all(
      [...activeJobs].map((loadTestId) =>
        setTemporaryState(`${LOAD_TEST_CANCEL_KEY_PREFIX}${loadTestId}`, '1', 120)),
    );
    await worker.close();
    if (connection.status !== 'end') await connection.quit();
    await Promise.all([disconnectDatabase(), disconnectLoadTestQueue()]);
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
  process.exitCode = 1;
});

export { worker };
