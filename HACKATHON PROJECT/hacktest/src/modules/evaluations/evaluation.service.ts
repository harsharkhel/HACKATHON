import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';

const ensureTestJobExists = async (testJobId: string) => {
  const job = await prisma.testJob.findUnique({
    where: { id: testJobId },
    select: {
      id: true,
      projectId: true,
      type: true,
      status: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Test job not found', 'TEST_JOB_NOT_FOUND');
  }

  return job;
};

export const createCompatibilityResult = async (
  actorRole: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER',
  input: {
    testJobId: string;
    httpStatus?: number;
    pageLoadTime?: number;
    consoleErrors?: number;
    failedRequests?: number;
    brokenLinks?: number;
    horizontalOverflow?: boolean;
    responsive?: boolean;
    viewportResults?: Prisma.InputJsonValue;
    screenshots?: Prisma.InputJsonValue;
    issues?: Prisma.InputJsonValue;
  }
) => {
  if (actorRole === 'PARTICIPANT') {
    throw new ForbiddenError('Participants cannot submit test result data', 'FORBIDDEN');
  }

  const job = await ensureTestJobExists(input.testJobId);

  return prisma.compatibilityResult.upsert({
    where: { testJobId: job.id },
    create: {
      testJobId: job.id,
      httpStatus: input.httpStatus ?? null,
      pageLoadTime: input.pageLoadTime ?? null,
      consoleErrors: input.consoleErrors ?? null,
      failedRequests: input.failedRequests ?? null,
      brokenLinks: input.brokenLinks ?? null,
      horizontalOverflow: input.horizontalOverflow ?? null,
      responsive: input.responsive ?? null,
      viewportResults: (input.viewportResults ?? undefined) as Prisma.InputJsonValue | undefined,
      screenshots: (input.screenshots ?? undefined) as Prisma.InputJsonValue | undefined,
      issues: (input.issues ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      httpStatus: input.httpStatus ?? undefined,
      pageLoadTime: input.pageLoadTime ?? undefined,
      consoleErrors: input.consoleErrors ?? undefined,
      failedRequests: input.failedRequests ?? undefined,
      brokenLinks: input.brokenLinks ?? undefined,
      horizontalOverflow: input.horizontalOverflow ?? undefined,
      responsive: input.responsive ?? undefined,
      viewportResults: (input.viewportResults ?? undefined) as Prisma.InputJsonValue | undefined,
      screenshots: (input.screenshots ?? undefined) as Prisma.InputJsonValue | undefined,
      issues: (input.issues ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
};

export const createPerformanceResult = async (
  actorRole: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER',
  input: {
    testJobId: string;
    avgResponseTime?: number;
    p95Latency?: number;
    p99Latency?: number;
    requestsPerSecond?: number;
    errorRate?: number;
    throughput?: number;
    availability?: number;
  }
) => {
  if (actorRole === 'PARTICIPANT') {
    throw new ForbiddenError('Participants cannot submit performance result data', 'FORBIDDEN');
  }

  const job = await ensureTestJobExists(input.testJobId);

  return prisma.performanceResult.upsert({
    where: { testJobId: job.id },
    create: {
      testJobId: job.id,
      avgResponseTime: input.avgResponseTime ?? null,
      p95Latency: input.p95Latency ?? null,
      p99Latency: input.p99Latency ?? null,
      requestsPerSecond: input.requestsPerSecond ?? null,
      errorRate: input.errorRate ?? null,
      throughput: input.throughput ?? null,
      availability: input.availability ?? null,
    },
    update: {
      avgResponseTime: input.avgResponseTime ?? undefined,
      p95Latency: input.p95Latency ?? undefined,
      p99Latency: input.p99Latency ?? undefined,
      requestsPerSecond: input.requestsPerSecond ?? undefined,
      errorRate: input.errorRate ?? undefined,
      throughput: input.throughput ?? undefined,
      availability: input.availability ?? undefined,
    },
  });
};

export const createLoadTestResult = async (
  actorRole: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER',
  input: {
    testJobId: string;
    virtualUsers?: number;
    duration?: number;
    requestsPerSecond?: number;
    avgLatency?: number;
    p95Latency?: number;
    p99Latency?: number;
    errorRate?: number;
    httpFailures?: number;
    status?: 'PASSED' | 'DEGRADED' | 'FAILED';
  }
) => {
  if (actorRole === 'PARTICIPANT') {
    throw new ForbiddenError('Participants cannot submit load test result data', 'FORBIDDEN');
  }

  const job = await ensureTestJobExists(input.testJobId);

  return prisma.loadTestResult.upsert({
    where: { testJobId: job.id },
    create: {
      testJobId: job.id,
      virtualUsers: input.virtualUsers ?? null,
      duration: input.duration ?? null,
      requestsPerSecond: input.requestsPerSecond ?? null,
      avgLatency: input.avgLatency ?? null,
      p95Latency: input.p95Latency ?? null,
      p99Latency: input.p99Latency ?? null,
      errorRate: input.errorRate ?? null,
      httpFailures: input.httpFailures ?? null,
      status: input.status ?? null,
    },
    update: {
      virtualUsers: input.virtualUsers ?? undefined,
      duration: input.duration ?? undefined,
      requestsPerSecond: input.requestsPerSecond ?? undefined,
      avgLatency: input.avgLatency ?? undefined,
      p95Latency: input.p95Latency ?? undefined,
      p99Latency: input.p99Latency ?? undefined,
      errorRate: input.errorRate ?? undefined,
      httpFailures: input.httpFailures ?? undefined,
      status: input.status ?? undefined,
    },
  });
};

export const createEvaluation = async (
  actorId: string,
  actorRole: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER',
  input: {
    projectId: string;
    judgeId: string;
    innovationScore?: number;
    technicalScore?: number;
    uiuxScore?: number;
    functionalityScore?: number;
    performanceScore?: number;
    scalabilityScore?: number;
    problemSolvingScore?: number;
    presentationScore?: number;
    comments?: string;
  }
) => {
  if (actorRole === 'PARTICIPANT') {
    throw new ForbiddenError('Participants cannot evaluate projects', 'FORBIDDEN');
  }

  if (input.judgeId !== actorId && actorRole !== 'ORGANIZER') {
    throw new ForbiddenError('You can only submit your own evaluation', 'FORBIDDEN');
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { hackathon: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  const judgeAssignment = await prisma.hackathonJudge.findUnique({
    where: {
      userId_hackathonId: {
        userId: input.judgeId,
        hackathonId: project.hackathonId,
      },
    },
  });

  if (!judgeAssignment && actorRole !== 'ORGANIZER') {
    throw new BadRequestError('This judge is not assigned to this hackathon', 'JUDGE_NOT_ASSIGNED');
  }

  const evaluation = await prisma.evaluation.upsert({
    where: {
      projectId_judgeId: {
        projectId: input.projectId,
        judgeId: input.judgeId,
      },
    },
    create: {
      projectId: input.projectId,
      judgeId: input.judgeId,
      innovationScore: input.innovationScore ?? null,
      technicalScore: input.technicalScore ?? null,
      uiuxScore: input.uiuxScore ?? null,
      functionalityScore: input.functionalityScore ?? null,
      performanceScore: input.performanceScore ?? null,
      scalabilityScore: input.scalabilityScore ?? null,
      problemSolvingScore: input.problemSolvingScore ?? null,
      presentationScore: input.presentationScore ?? null,
      comments: input.comments ?? null,
    },
    update: {
      innovationScore: input.innovationScore ?? undefined,
      technicalScore: input.technicalScore ?? undefined,
      uiuxScore: input.uiuxScore ?? undefined,
      functionalityScore: input.functionalityScore ?? undefined,
      performanceScore: input.performanceScore ?? undefined,
      scalabilityScore: input.scalabilityScore ?? undefined,
      problemSolvingScore: input.problemSolvingScore ?? undefined,
      presentationScore: input.presentationScore ?? undefined,
      comments: input.comments ?? undefined,
    },
  });

  await prisma.project.update({
    where: { id: input.projectId },
    data: { status: 'EVALUATED' },
  });

  return evaluation;
};

export const listProjectEvaluations = async (projectId: string) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  return prisma.evaluation.findMany({
    where: { projectId },
    include: {
      judge: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};
