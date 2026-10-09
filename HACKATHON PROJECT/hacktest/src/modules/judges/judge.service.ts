import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { listLoadTestsForAuthorizedSession } from '../load-tests/loadTest.service';
import { listDeviceCompatibilityForAuthorizedSession } from '../../services/deviceSession.service';

const getJudgeProject = async (projectId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      projectUrl: true,
      status: true,
    },
  });
  if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  return project;
};

export const getJudgeProjectOverview = async (projectId: string) => {
  const [project, health, loadTests, deviceCompatibility] = await Promise.all([
    getJudgeProject(projectId),
    prisma.healthCheck.findFirst({
      where: { projectId },
      orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
      select: {
        isHealthy: true,
        responseTime: true,
        statusCode: true,
        checkedAt: true,
      },
    }),
    prisma.loadTest.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1,
      select: {
        status: true,
        totalRequests: true,
        successfulRequests: true,
        failedRequests: true,
        averageResponseTime: true,
        p95ResponseTime: true,
        p99ResponseTime: true,
        requestsPerSecond: true,
        errorRate: true,
        completedAt: true,
      },
    }),
    listDeviceCompatibilityForAuthorizedSession(projectId),
  ]);

  return {
    project,
    health: {
      availability: health ? health.isHealthy : null,
      responseTime: health?.responseTime ?? null,
      statusCode: health?.statusCode ?? null,
      checkedAt: health?.checkedAt ?? null,
    },
    loadTest: loadTests[0] ?? null,
    deviceCompatibility,
  };
};

export const getJudgeProjectHealth = async (projectId: string) => {
  await getJudgeProject(projectId);
  const result = await prisma.healthCheck.findFirst({
    where: { projectId },
    orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
    select: {
      isHealthy: true,
      statusCode: true,
      responseTime: true,
      dnsResolutionTime: true,
      tlsSuccess: true,
      redirectCount: true,
      checkedAt: true,
      errorReason: true,
    },
  });
  return result
    ? {
        availability: result.isHealthy,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        dnsResolutionTime: result.dnsResolutionTime,
        tlsSuccess: result.tlsSuccess,
        redirectCount: result.redirectCount,
        checkedAt: result.checkedAt,
        errorReason: result.errorReason,
      }
    : {
        availability: null,
        statusCode: null,
        responseTime: null,
        dnsResolutionTime: null,
        tlsSuccess: null,
        redirectCount: 0,
        checkedAt: null,
        errorReason: null,
      };
};

export const getJudgeProjectLoadTests = async (projectId: string) => {
  await getJudgeProject(projectId);
  return listLoadTestsForAuthorizedSession(projectId);
};

export const getJudgeProjectDevices = async (projectId: string) => {
  await getJudgeProject(projectId);
  return listDeviceCompatibilityForAuthorizedSession(projectId);
};
