import http from 'node:http';
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import crypto from 'node:crypto';
import { LoadTestStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  LOAD_TEST_CANCEL_KEY_PREFIX,
  LOAD_TEST_LOCK_KEY_PREFIX,
  LOAD_TEST_PROGRESS_KEY_PREFIX,
  type LoadTestProgress,
} from '../../config/loadTestQueue';
import {
  deleteTemporaryStateIfValue,
  getTemporaryState,
  setTemporaryState,
  setTemporaryStateIfAbsent,
} from '../../config/redis';
import { isPrivateAddress, validateTargetUrl } from '../../services/urlSecurityService';
import { createModuleLogger } from '../../utils/logger';
import { calculateLoadTestMetrics, type LoadTestObservation } from './loadTest.metrics';

const log = createModuleLogger('load-test-worker');
const REQUEST_TIMEOUT_MS = 5_000;
const DNS_TIMEOUT_MS = 2_000;
const PROGRESS_TTL_SECONDS = 2 * 60 * 60;
const LOCK_TTL_SECONDS = 90;

const isTerminalStatus = (status: LoadTestStatus): boolean =>
  status === LoadTestStatus.COMPLETED ||
  status === LoadTestStatus.FAILED ||
  status === LoadTestStatus.CANCELLED;

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

interface RequestResult extends LoadTestObservation {}

const resolvePinnedTarget = async (rawUrl: string): Promise<{ url: URL; addresses: ResolvedAddress[] }> => {
  const normalizedUrl = validateTargetUrl(rawUrl);
  const url = new URL(normalizedUrl);
  const hostname = url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1, -1)
    : url.hostname;
  const family = isIP(hostname);
  if (family) {
    if (isPrivateAddress(hostname)) throw new Error('unsafe_target');
    return { url, addresses: [{ address: hostname, family: family as 4 | 6 }] };
  }

  const resolver = new Resolver();
  let timeout: NodeJS.Timeout | undefined;
  const dnsResults = await Promise.race([
    Promise.all([
      resolver.resolve4(hostname).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') return [];
        throw error;
      }),
      resolver.resolve6(hostname).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') return [];
        throw error;
      }),
    ]),
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('dns_timeout')), DNS_TIMEOUT_MS);
    }),
  ]).catch((error: unknown) => {
    resolver.cancel();
    throw error;
  }).finally(() => {
    if (timeout) clearTimeout(timeout);
  });

  const addresses = [
    ...dnsResults[0].map((address) => ({ address, family: 4 as const })),
    ...dnsResults[1].map((address) => ({ address, family: 6 as const })),
  ];
  if (addresses.length === 0) throw new Error('dns_failure');
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('unsafe_target');
  return { url, addresses };
};

const requestTarget = (
  target: URL,
  addresses: ResolvedAddress[],
  activeRequests: Set<http.ClientRequest>,
): Promise<RequestResult> => new Promise((resolve) => {
  const transport = target.protocol === 'https:' ? https : http;
  const startedAt = performance.now();
  let settled = false;
  const finish = (statusCode: number | null, errorReason: string | null): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    activeRequests.delete(request);
    resolve({
      statusCode,
      errorReason,
      latencyMs: Math.max(0, performance.now() - startedAt),
    });
  };

  const request = transport.request(target, {
    method: 'GET',
    agent: false,
    maxHeaderSize: 16 * 1024,
    headers: {
      'user-agent': 'HackPreview-ControlledLoadTest/1.0',
      accept: '*/*',
      range: 'bytes=0-0',
      connection: 'close',
    },
    lookup: (_hostname, options, callback) => {
      const matchingAddresses = addresses.filter(({ family }) => !options.family || family === options.family);
      if (matchingAddresses.length === 0) {
        callback(Object.assign(new Error('No validated address for target'), { code: 'ENOTFOUND' }), '', 0);
        return;
      }
      if (options.all) {
        callback(null, matchingAddresses);
        return;
      }
      callback(null, matchingAddresses[0].address, matchingAddresses[0].family);
    },
  });
  activeRequests.add(request);

  const timeout = setTimeout(() => {
    request.destroy(Object.assign(new Error('request_timeout'), { code: 'ETIMEDOUT' }));
  }, REQUEST_TIMEOUT_MS);
  request.once('response', (response) => {
    const statusCode = response.statusCode ?? 0;
    response.destroy();
    request.destroy();
    finish(statusCode, null);
  });
  request.once('error', (error: NodeJS.ErrnoException) => {
    const reason = error.code === 'ETIMEDOUT' || error.message === 'request_timeout'
      ? 'timeout'
      : error.code?.startsWith('CERT_') || error.code === 'ERR_TLS_CERT_ALTNAME_INVALID'
        ? 'tls_error'
        : error.message === 'cancelled'
          ? 'cancelled'
          : 'connection_error';
    finish(null, reason);
  });
  request.end();
});

const readCancelRequested = async (loadTestId: string): Promise<boolean> => {
  const record = await prisma.loadTest.findUnique({
    where: { id: loadTestId },
    select: { cancelRequestedAt: true, status: true },
  });
  if (!record) throw new Error('load_test_not_found');
  if (record.status === LoadTestStatus.CANCELLED) return true;
  return record.cancelRequestedAt !== null ||
    (await getTemporaryState(`${LOAD_TEST_CANCEL_KEY_PREFIX}${loadTestId}`)) === '1';
};

const storeProgress = async (
  loadTestId: string,
  progress: Omit<LoadTestProgress, 'updatedAt'>,
): Promise<void> => {
  await setTemporaryState(
    `${LOAD_TEST_PROGRESS_KEY_PREFIX}${loadTestId}`,
    JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }),
    PROGRESS_TTL_SECONDS,
  );
};

const persistFailure = async (loadTestId: string, message: string): Promise<void> => {
  await prisma.loadTest.updateMany({
    where: { id: loadTestId, status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] } },
    data: {
      status: LoadTestStatus.FAILED,
      completedAt: new Date(),
      errorMessage: message,
    },
  });
};

const runLoadTestWithLock = async (loadTestId: string): Promise<void> => {
  const loadTest = await prisma.loadTest.findUnique({ where: { id: loadTestId } });
  if (!loadTest) throw new Error('load_test_not_found');
  if (isTerminalStatus(loadTest.status)) {
    log.info({ loadTestId, status: loadTest.status }, 'Skipping terminal load-test job');
    return;
  }

  if (await readCancelRequested(loadTestId)) {
    await prisma.loadTest.updateMany({
      where: { id: loadTestId, status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] } },
      data: { status: LoadTestStatus.CANCELLED, completedAt: new Date() },
    });
    await storeProgress(loadTestId, {
      status: 'cancelled',
      currentRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      currentRps: 0,
      currentLatency: null,
      progress: 100,
    });
    return;
  }

  const startedAt = new Date();
  const claimed = await prisma.loadTest.updateMany({
    where: {
      id: loadTestId,
      status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] },
      cancelRequestedAt: null,
    },
    data: { status: LoadTestStatus.RUNNING, startedAt, completedAt: null, errorMessage: null },
  });
  if (claimed.count !== 1) {
    const current = await prisma.loadTest.findUnique({
      where: { id: loadTestId },
      select: { status: true, cancelRequestedAt: true },
    });
    if (current?.cancelRequestedAt || current?.status === LoadTestStatus.CANCELLED) {
      await prisma.loadTest.updateMany({
        where: { id: loadTestId, status: { in: [LoadTestStatus.QUEUED, LoadTestStatus.RUNNING] } },
        data: { status: LoadTestStatus.CANCELLED, completedAt: new Date() },
      });
      await storeProgress(loadTestId, {
        status: 'cancelled',
        currentRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        currentRps: 0,
        currentLatency: null,
        progress: 100,
      });
      return;
    }
    if (current && isTerminalStatus(current.status)) return;
    throw new Error('load_test_claim_failed');
  }
  log.info({
    loadTestId,
    concurrency: loadTest.concurrentUsers,
    durationSeconds: loadTest.durationSeconds,
    maxRequests: loadTest.maxRequests,
  }, 'Load test started');
  await storeProgress(loadTestId, {
    status: 'starting',
    currentRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    currentRps: 0,
    currentLatency: null,
    progress: 0,
  });

  let pinnedTarget: Awaited<ReturnType<typeof resolvePinnedTarget>>;
  try {
    pinnedTarget = await resolvePinnedTarget(loadTest.targetUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'target_validation_failed';
    await persistFailure(loadTestId, reason === 'unsafe_target' ? 'Target URL resolved to a non-public address.' : 'Target URL could not be safely resolved.');
    await storeProgress(loadTestId, {
      status: 'failed',
      currentRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      currentRps: 0,
      currentLatency: null,
      progress: 100,
    });
    log.warn({ loadTestId, reason }, 'Load-test target validation failed');
    return;
  }

  const observations: LoadTestObservation[] = [];
  const activeRequests = new Set<http.ClientRequest>();
  let nextRequest = 0;
  let stoppingReason: 'cancelled' | 'duration' | null = null;
  let cancellationFailure: Error | undefined;
  let progressWrite = Promise.resolve();
  let lastProgressAt = 0;
  const startedMonotonic = performance.now();

  const stopActiveRequests = (): void => {
    for (const request of activeRequests) {
      request.destroy(new Error('cancelled'));
    }
  };
  const publishProgress = (force = false): void => {
    const now = performance.now();
    if (!force && now - lastProgressAt < 500) return;
    lastProgressAt = now;
    const currentRequests = observations.length;
    const successfulRequests = observations.filter(
      (item) => item.statusCode !== null && item.statusCode >= 200 && item.statusCode < 400,
    ).length;
    const elapsedMs = Math.max(1, now - startedMonotonic);
    const snapshot: Omit<LoadTestProgress, 'updatedAt'> = {
      status: stoppingReason === 'cancelled' ? 'cancelled' : 'running',
      currentRequests,
      successfulRequests,
      failedRequests: currentRequests - successfulRequests,
      currentRps: currentRequests / (elapsedMs / 1_000),
      currentLatency: observations.at(-1)?.latencyMs ?? null,
      progress: Math.min(99, Math.floor((elapsedMs / (loadTest.durationSeconds * 1_000)) * 100)),
    };
    progressWrite = progressWrite.then(() => storeProgress(loadTestId, snapshot));
  };
  const checkCancellation = setInterval(() => {
    void readCancelRequested(loadTestId).then((requested) => {
      if (requested && stoppingReason === null) {
        stoppingReason = 'cancelled';
        stopActiveRequests();
        publishProgress(true);
      }
    }).catch((error: unknown) => {
      cancellationFailure = error instanceof Error ? error : new Error('Cancellation check failed');
      stoppingReason = 'cancelled';
      stopActiveRequests();
    });
  }, 250);
  const stopAtDuration = setTimeout(() => {
    if (stoppingReason === null) {
      stoppingReason = 'duration';
      stopActiveRequests();
      publishProgress(true);
    }
  }, loadTest.durationSeconds * 1_000);
  await storeProgress(loadTestId, {
    status: 'running',
    currentRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    currentRps: 0,
    currentLatency: null,
    progress: 0,
  });
  const progressInterval = setInterval(() => publishProgress(), 500);

  const simulateUser = async (): Promise<void> => {
    while (nextRequest < loadTest.maxRequests && stoppingReason === null) {
      const requestNumber = nextRequest;
      nextRequest += 1;
      if (requestNumber >= loadTest.maxRequests) return;
      observations.push(await requestTarget(pinnedTarget.url, pinnedTarget.addresses, activeRequests));
      publishProgress();
    }
  };

  try {
    await Promise.all(Array.from({ length: loadTest.concurrentUsers }, () => simulateUser()));
    if (cancellationFailure) throw cancellationFailure;
  } finally {
    clearInterval(checkCancellation);
    clearTimeout(stopAtDuration);
    clearInterval(progressInterval);
  }
  await progressWrite;

  const durationMs = performance.now() - startedMonotonic;
  const metrics = calculateLoadTestMetrics(observations, durationMs);
  const finalStatus = stoppingReason === 'cancelled'
    ? LoadTestStatus.CANCELLED
    : LoadTestStatus.COMPLETED;

  await prisma.loadTest.update({
    where: { id: loadTestId },
    data: {
      ...metrics,
      httpStatusDistribution: metrics.httpStatusDistribution as Prisma.InputJsonObject,
      errorDistribution: metrics.errorDistribution as Prisma.InputJsonObject,
      status: finalStatus,
      completedAt: new Date(),
    },
  });
  await storeProgress(loadTestId, {
    status: finalStatus.toLowerCase() as LoadTestProgress['status'],
    currentRequests: metrics.totalRequests,
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    currentRps: metrics.requestsPerSecond,
    currentLatency: observations.at(-1)?.latencyMs ?? null,
    progress: 100,
  });
  log.info({
    loadTestId,
    status: finalStatus,
    totalRequests: metrics.totalRequests,
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    durationMs: metrics.durationMs,
    requestsPerSecond: metrics.requestsPerSecond,
  }, 'Load test finished');
};

export const runLoadTest = async (loadTestId: string): Promise<void> => {
  const lockKey = `${LOAD_TEST_LOCK_KEY_PREFIX}${loadTestId}`;
  const lockValue = `${process.pid}:${crypto.randomUUID()}`;
  const acquired = await setTemporaryStateIfAbsent(lockKey, lockValue, LOCK_TTL_SECONDS);
  if (!acquired) {
    log.warn({ loadTestId }, 'Duplicate load-test execution skipped because the worker lock is held');
    throw new Error('load_test_already_claimed');
  }

  try {
    await runLoadTestWithLock(loadTestId);
  } finally {
    await deleteTemporaryStateIfValue(lockKey, lockValue);
  }
};
