import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { prisma } from '../config/database';
import { getProjectAnalytics } from './projectAnalytics.service';

describe('getProjectAnalytics', () => {
  const originals: Array<{ target: object; key: string; descriptor: PropertyDescriptor | undefined }> = [];
  const calls: Record<string, unknown[]> = {};

  const mockMethod = (target: object, key: string, value: (...args: never[]) => unknown): void => {
    originals.push({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) });
    Object.defineProperty(target, key, { configurable: true, value });
  };

  after(() => {
    for (const { target, key, descriptor } of originals.reverse()) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  });

  it('uses database aggregates and applies date/project filters', async () => {
    calls.methods = [];
    const record = (method: string, args: unknown): void => {
      calls.methods.push(method);
      (calls[method] ??= []).push(args);
    };

    mockMethod(prisma.deviceSession, 'count', async (args) => {
      record('deviceSession.count', args);
      return 7;
    });
    mockMethod(prisma.deviceSession, 'groupBy', async (args) => {
      const query = args as unknown as { by: string[] };
      record(`deviceSession.groupBy.${query.by[0]}`, args);
      const row = { _count: { _all: 7 } };
      if (query.by[0] === 'deviceType') return [{ ...row, deviceType: 'mobile' }];
      if (query.by[0] === 'browser') return [{ ...row, browser: 'Chrome' }];
      return [{ ...row, operatingSystem: 'Android' }];
    });
    mockMethod(prisma.projectSession, 'count', async (args) => {
      record('projectSession.count', args);
      return 7;
    });
    mockMethod(prisma.healthCheck, 'aggregate', async (args) => {
      record('healthCheck.aggregate', args);
      return { _count: { _all: 5 }, _avg: { responseTime: 120 } };
    });
    mockMethod(prisma.healthCheck, 'count', async (args) => {
      record('healthCheck.count', args);
      return 1;
    });
    mockMethod(prisma.loadTest, 'groupBy', async (args) => {
      record('loadTest.groupBy', args);
      return [{ status: 'COMPLETED', _count: { _all: 2 } }];
    });
    mockMethod(prisma.loadTest, 'aggregate', async (args) => {
      const query = args as unknown as { _sum: { totalRequests?: boolean } };
      record(query._sum.totalRequests ? 'loadTest.totalRequests' : 'loadTest.failedRequests', args);
      return { _sum: query._sum.totalRequests ? { totalRequests: 100 } : { failedRequests: 10 } };
    });

    const result = await getProjectAnalytics('project-id', {
      startDate: '2026-10-01T00:00:00Z',
      endDate: '2026-10-09T00:00:00Z',
    });

    assert.equal(result.qrScans, 7);
    assert.equal(result.uniqueSessions, 7);
    assert.equal(result.activeSessions, 7);
    assert.deepEqual(result.devicesByType, { mobile: 7 });
    assert.deepEqual(result.browsers, { Chrome: 7 });
    assert.deepEqual(result.operatingSystems, { Android: 7 });
    assert.equal(result.averageResponseTimeMs, 120);
    assert.equal(result.errorRate, 11 / 105);
    assert.equal(result.loadTests.total, 2);
    assert.equal(calls.methods.includes('findMany'), false);

    const deviceGroupBy = calls['deviceSession.groupBy.deviceType'][0] as {
      where: { connectedAt: { gte: Date; lte: Date }; projectSession: { is: { projectId: string } } };
    };
    assert.equal(deviceGroupBy.where.projectSession.is.projectId, 'project-id');
    assert.equal(deviceGroupBy.where.connectedAt.gte.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(deviceGroupBy.where.connectedAt.lte.toISOString(), '2026-10-09T00:00:00.000Z');
  });
});
