import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';

export const createTestJob = async (
  actorId: string,
  actorRole: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER',
  input: {
    projectId: string;
    type: 'COMPATIBILITY' | 'PERFORMANCE' | 'LOAD';
    sessionId?: string | null;
  }
) => {
  if (actorRole === 'PARTICIPANT') {
    throw new ForbiddenError('Only judges and organizers can create test jobs', 'FORBIDDEN');
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { hackathon: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  if (input.sessionId) {
    const session = await prisma.testingSession.findUnique({
      where: { id: input.sessionId },
    });

    if (!session || session.projectId !== input.projectId) {
      throw new BadRequestError('The session does not belong to this project', 'INVALID_SESSION');
    }
  }

  const job = await prisma.testJob.create({
    data: {
      projectId: input.projectId,
      sessionId: input.sessionId || null,
      type: input.type,
      status: 'QUEUED',
    },
    include: {
      project: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  await prisma.project.update({
    where: { id: input.projectId },
    data: { status: 'UNDER_REVIEW' },
  });

  return job;
};

export const listProjectTestJobs = async (projectId: string) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  return prisma.testJob.findMany({
    where: { projectId },
    include: {
      compatibilityResult: true,
      performanceResult: true,
      loadTestResult: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getTestJobById = async (jobId: string) => {
  const job = await prisma.testJob.findUnique({
    where: { id: jobId },
    include: {
      project: {
        select: { id: true, name: true, status: true },
      },
      compatibilityResult: true,
      performanceResult: true,
      loadTestResult: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Test job not found', 'TEST_JOB_NOT_FOUND');
  }

  return job;
};

export const updateTestJobStatus = async (
  actorRole: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER',
  jobId: string,
  input: {
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
  }
) => {
  if (actorRole === 'PARTICIPANT') {
    throw new ForbiddenError('Participants cannot update test job status', 'FORBIDDEN');
  }

  const job = await prisma.testJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new NotFoundError('Test job not found', 'TEST_JOB_NOT_FOUND');
  }

  const data: Prisma.TestJobUpdateInput = {
    status: input.status,
  };

  if (input.startedAt) {
    data.startedAt = new Date(input.startedAt);
  } else if (input.status === 'RUNNING' && !job.startedAt) {
    data.startedAt = new Date();
  }

  if (input.completedAt) {
    data.completedAt = new Date(input.completedAt);
  } else if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(input.status) && !job.completedAt) {
    data.completedAt = new Date();
  }

  if (typeof input.errorMessage === 'string') {
    data.errorMessage = input.errorMessage || null;
  }

  const updatedJob = await prisma.testJob.update({
    where: { id: jobId },
    data,
  });

  if (input.status === 'COMPLETED') {
    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: 'TESTED' },
    });
  }

  return updatedJob;
};
