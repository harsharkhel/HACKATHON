import { LoadTestStatus, type UserRole } from '@prisma/client';
import type { LoadTest } from '@prisma/client';
import {
  getLoadTestQueue,
  LOAD_TEST_CANCEL_KEY_PREFIX,
} from '../../config/loadTestQueue';
import { deleteTemporaryState, setTemporaryState } from '../../config/redis';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { createModuleLogger } from '../../utils/logger';
import type { CreateLoadTestInput } from './loadTest.schema';

const log = createModuleLogger('load-tests');
const MAX_QUEUED_JOBS = 100;
const CANCELLATION_TTL_SECONDS = 120;

type LoadTestAccess = {
  id: string;
  userId: string;
  projectUrl: string;
};

const ensureProjectAccess = async (
  projectId: string,
  userId: string,
  role: UserRole,
): Promise<LoadTestAccess> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, projectUrl: true },
  });
  if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  if (role === 'PARTICIPANT' && project.userId !== userId) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }
  return project;
};

const ensureLoadTestAccess = async (
  loadTest: Pick<LoadTest, 'projectId'> & { project: { userId: string } },
  userId: string,
  role: UserRole,
): Promise<void> => {
  if (role === 'PARTICIPANT' && loadTest.project.userId !== userId) {
    throw new NotFoundError('Load test not found', 'LOAD_TEST_NOT_FOUND');
  }
};

const loadTestResponse = (record: LoadTest) => ({
  id: record.id,
  projectId: record.projectId,
  status: record.status,
  concurrency: record.concurrentUsers,
  durationSeconds: record.durationSeconds,
  maxRequests: record.maxRequests,
  totalRequests: record.totalRequests,
  successfulRequests: record.successfulRequests,
  failedRequests: record.failedRequests,
  averageLatency: record.averageResponseTime,
  medianLatency: record.medianResponseTime,
  p95Latency: record.p95ResponseTime,
  p99Latency: record.p99ResponseTime,
  requestsPerSecond: record.requestsPerSecond,
  errorRate: record.errorRate,
  httpStatusDistribution: record.httpStatusDistribution,
  errorDistribution: record.errorDistribution,
  durationMs: record.durationMs,
  errorMessage: record.errorMessage,
  startedAt: record.startedAt,
  completedAt: record.completedAt,
  createdAt: record.createdAt,
});

export const createProjectLoadTest = async (
  projectId: string,
  userId: string,
  role: UserRole,
  input: CreateLoadTestInput,
) => {
  const project = await ensureProjectAccess(projectId, userId, role);
  const activeCount = await prisma.loadTest.count({
    where: { projectId, status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] } },
  });
  if (activeCount > 0) {
    throw new ConflictError('A load test is already queued or running for this project', 'LOAD_TEST_ALREADY_ACTIVE');
  }

  const queue = getLoadTestQueue();
  const [waiting, delayed] = await Promise.all([queue.getWaitingCount(), queue.getDelayedCount()]);
  if (waiting + delayed >= MAX_QUEUED_JOBS) {
    throw new ConflictError('The load-test queue is full; try again later', 'LOAD_TEST_QUEUE_FULL');
  }

  const record = await prisma.loadTest.create({
    data: {
      projectId: project.id,
      targetUrl: project.projectUrl,
      concurrentUsers: input.concurrency,
      durationSeconds: input.durationSeconds,
      maxRequests: input.maxRequests,
      status: LoadTestStatus.QUEUED,
    },
  });

  try {
    await queue.add('run-load-test', { loadTestId: record.id }, { jobId: record.id });
  } catch (error) {
    await prisma.loadTest.update({
      where: { id: record.id },
      data: {
        status: LoadTestStatus.FAILED,
        completedAt: new Date(),
        errorMessage: 'Unable to enqueue the load test; confirm Redis is available and retry.',
      },
    });
    log.error({ err: error, loadTestId: record.id }, 'Failed to enqueue load test');
    throw error;
  }

  log.info({
    loadTestId: record.id,
    projectId: project.id,
    concurrency: input.concurrency,
    durationSeconds: input.durationSeconds,
    maxRequests: input.maxRequests,
  }, 'Load test queued');

  return loadTestResponse(record);
};

export const listProjectLoadTests = async (projectId: string, userId: string, role: UserRole) => {
  await ensureProjectAccess(projectId, userId, role);
  const records = await prisma.loadTest.findMany({
    where: { projectId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });
  return records.map(loadTestResponse);
};

export const getLoadTest = async (loadTestId: string, userId: string, role: UserRole) => {
  const record = await prisma.loadTest.findUnique({
    where: { id: loadTestId },
    include: { project: { select: { userId: true } } },
  });
  if (!record) throw new NotFoundError('Load test not found', 'LOAD_TEST_NOT_FOUND');
  await ensureLoadTestAccess(record, userId, role);
  return loadTestResponse(record);
};

export const cancelLoadTest = async (loadTestId: string, userId: string, role: UserRole) => {
  const record = await prisma.loadTest.findUnique({
    where: { id: loadTestId },
    include: { project: { select: { userId: true } } },
  });
  if (!record) throw new NotFoundError('Load test not found', 'LOAD_TEST_NOT_FOUND');
  await ensureLoadTestAccess(record, userId, role);
  if ([LoadTestStatus.COMPLETED, LoadTestStatus.FAILED, LoadTestStatus.CANCELLED].includes(record.status)) {
    throw new BadRequestError('This load test has already finished', 'LOAD_TEST_NOT_ACTIVE');
  }

  const queue = getLoadTestQueue();
  const job = await queue.getJob(record.id);
  if (record.status === LoadTestStatus.QUEUED) {
    const queued = await prisma.loadTest.updateMany({
      where: { id: record.id, status: LoadTestStatus.QUEUED },
      data: {
        status: LoadTestStatus.CANCELLED,
        cancelRequestedAt: new Date(),
        completedAt: new Date(),
      },
    });
    if (queued.count === 1) {
      if (job) {
        try {
          await job.remove();
        } catch (error) {
          log.warn({ err: error, loadTestId }, 'Queued job could not be removed after cancellation');
        }
      }
      await deleteTemporaryState(`${LOAD_TEST_CANCEL_KEY_PREFIX}${record.id}`);
      log.info({ loadTestId }, 'Queued load test cancelled');
      return getLoadTest(loadTestId, userId, role);
    }
  }

  const requestedAt = new Date();
  const running = await prisma.loadTest.updateMany({
    where: { id: record.id, status: LoadTestStatus.RUNNING },
    data: { cancelRequestedAt: requestedAt },
  });
  if (running.count === 0) {
    const latest = await prisma.loadTest.findUnique({ where: { id: record.id } });
    if (!latest || [LoadTestStatus.COMPLETED, LoadTestStatus.FAILED, LoadTestStatus.CANCELLED].includes(latest.status)) {
      throw new BadRequestError('This load test has already finished', 'LOAD_TEST_NOT_ACTIVE');
    }
  }
  await setTemporaryState(`${LOAD_TEST_CANCEL_KEY_PREFIX}${record.id}`, '1', CANCELLATION_TTL_SECONDS);
  log.info({ loadTestId }, 'Load-test cancellation requested');
  return getLoadTest(loadTestId, userId, role);
};
