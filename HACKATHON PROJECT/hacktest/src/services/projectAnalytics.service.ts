import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { ProjectAnalyticsQuery } from '../validators/analytics.validators';

const dateRange = (query: ProjectAnalyticsQuery): Prisma.DateTimeFilter => ({
  ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
  ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
});

const countsBy = (rows: Array<{ value: string | null; count: number }>): Record<string, number> =>
  Object.fromEntries(rows.map(({ value, count }) => [value || 'Unknown', count]));

export const getProjectAnalytics = async (
  projectId: string,
  query: ProjectAnalyticsQuery,
) => {
  const range = dateRange(query);
  const sessionWhere: Prisma.ProjectSessionWhereInput = {
    projectId,
    createdAt: range,
  };
  const deviceWhere: Prisma.DeviceSessionWhereInput = {
    connectedAt: range,
    projectSession: { is: { projectId } },
  };
  const healthWhere: Prisma.HealthCheckWhereInput = {
    projectId,
    checkedAt: range,
  };
  const loadTestWhere: Prisma.LoadTestWhereInput = {
    projectId,
    createdAt: range,
  };

  const [
    qrScans,
    uniqueSessions,
    activeSessions,
    deviceTypeRows,
    browserRows,
    operatingSystemRows,
    healthSummary,
    failedHealthChecks,
    loadTestSummary,
    loadTestRequests,
    loadTestFailures,
  ] = await Promise.all([
    prisma.deviceSession.count({ where: deviceWhere }),
    prisma.projectSession.count({ where: sessionWhere }),
    prisma.projectSession.count({
      where: { ...sessionWhere, expiresAt: { gt: new Date() } },
    }),
    prisma.deviceSession.groupBy({
      by: ['deviceType'],
      where: deviceWhere,
      _count: { _all: true },
    }),
    prisma.deviceSession.groupBy({
      by: ['browser'],
      where: deviceWhere,
      _count: { _all: true },
    }),
    prisma.deviceSession.groupBy({
      by: ['operatingSystem'],
      where: deviceWhere,
      _count: { _all: true },
    }),
    prisma.healthCheck.aggregate({
      where: healthWhere,
      _count: { _all: true },
      _avg: { responseTime: true },
    }),
    prisma.healthCheck.count({ where: { ...healthWhere, isHealthy: false } }),
    prisma.loadTest.groupBy({
      by: ['status'],
      where: loadTestWhere,
      _count: { _all: true },
    }),
    prisma.loadTest.aggregate({
      where: loadTestWhere,
      _sum: { totalRequests: true },
    }),
    prisma.loadTest.aggregate({
      where: loadTestWhere,
      _sum: { failedRequests: true },
    }),
  ]);

  const totalHealthChecks = healthSummary._count._all;
  const totalLoadRequests = loadTestRequests._sum.totalRequests ?? 0;
  const totalFailures = failedHealthChecks + (loadTestFailures._sum.failedRequests ?? 0);
  const totalMeasuredRequests = totalHealthChecks + totalLoadRequests;
  const loadTests = Object.fromEntries(
    loadTestSummary.map(({ status, _count }) => [status.toLowerCase(), _count._all]),
  );
  const devicesByType = countsBy(deviceTypeRows.map(({ deviceType, _count }) => ({
    value: deviceType,
    count: _count._all,
  })));
  const browsers = countsBy(browserRows.map(({ browser, _count }) => ({
    value: browser,
    count: _count._all,
  })));
  const operatingSystems = countsBy(operatingSystemRows.map(({ operatingSystem, _count }) => ({
    value: operatingSystem,
    count: _count._all,
  })));

  return {
    period: {
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
    },
    qrScans,
    uniqueSessions,
    activeSessions,
    devicesByType,
    browsers,
    operatingSystems,
    healthChecks: {
      total: totalHealthChecks,
      healthy: totalHealthChecks - failedHealthChecks,
      failed: failedHealthChecks,
    },
    loadTests: {
      total: Object.values(loadTests).reduce((sum, count) => sum + count, 0),
      byStatus: loadTests,
    },
    averageResponseTimeMs: healthSummary._avg.responseTime,
    errorRate: totalMeasuredRequests === 0 ? 0 : totalFailures / totalMeasuredRequests,
  };
};
