import type { Request, Response } from 'express';
import { getLoadTest, getLoadTestProgress } from '../modules/load-tests/loadTest.service';
import { UnauthorizedError } from '../utils/errors';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('load-test-stream');
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

const streamStatus = (status: string): 'queued' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled' => {
  switch (status) {
    case 'QUEUED': return 'queued';
    case 'RUNNING': return 'running';
    case 'COMPLETED': return 'completed';
    case 'FAILED': return 'failed';
    case 'CANCELLED': return 'cancelled';
    default: return 'starting';
  }
};

export const streamLoadTest = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED');
  const loadTestId = String(req.params.id);
  const user = req.user;
  await getLoadTest(loadTestId, user.userId, user.role);

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, private, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');

  let closed = false;
  let polling = false;
  let lastUpdatedAt: string | undefined;
  const sendHeartbeat = setInterval(() => {
    if (!closed) res.write(': heartbeat\n\n');
  }, 15_000);

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(sendHeartbeat);
    clearInterval(poll);
  };
  res.once('close', cleanup);

  const pollProgress = async (): Promise<void> => {
    if (closed || polling) return;
    polling = true;
    try {
      const [record, progress] = await Promise.all([
        getLoadTest(loadTestId, user.userId, user.role),
        getLoadTestProgress(loadTestId),
      ]);
      if (closed) return;

      const snapshot = progress ?? {
        status: streamStatus(record.status),
        currentRequests: record.totalRequests,
        successfulRequests: record.successfulRequests,
        failedRequests: record.failedRequests,
        currentRps: record.requestsPerSecond ?? 0,
        currentLatency: null,
        progress: TERMINAL_STATUSES.has(record.status) ? 100 : 0,
        updatedAt: (record.completedAt ?? record.startedAt ?? record.createdAt).toISOString(),
      };
      if (snapshot.updatedAt !== lastUpdatedAt) {
        res.write(`id: ${snapshot.updatedAt}\nevent: progress\ndata: ${JSON.stringify({
          loadTestId,
          ...snapshot,
        })}\n\n`);
        lastUpdatedAt = snapshot.updatedAt;
      }
      if (TERMINAL_STATUSES.has(record.status)) {
        cleanup();
        res.end();
      }
    } catch (error) {
      log.error({ err: error, loadTestId }, 'Load-test progress stream failed');
      cleanup();
      if (!res.headersSent) res.status(500).json({ success: false, error: { code: 'STREAM_FAILED', message: 'Unable to stream load-test progress' } });
      else res.end();
    } finally {
      polling = false;
    }
  };

  const poll = setInterval(() => {
    void pollProgress();
  }, 1_000);
  await pollProgress();
};
