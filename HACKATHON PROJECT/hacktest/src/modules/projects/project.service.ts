import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const createProject = async (participantId: string, input: {
  hackathonId: string;
  name: string;
  description: string;
  githubUrl?: string | null;
  deploymentUrl?: string | null;
}) => {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: input.hackathonId } });
  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  const participant = await prisma.hackathonParticipant.findUnique({
    where: {
      userId_hackathonId: {
        userId: participantId,
        hackathonId: input.hackathonId,
      },
    },
  });

  if (!participant) {
    throw new ForbiddenError('You must join the hackathon before submitting a project', 'NOT_PARTICIPANT');
  }

  return prisma.project.create({
    data: {
      hackathonId: input.hackathonId,
      participantId,
      name: input.name,
      description: input.description,
      githubUrl: input.githubUrl || null,
      deploymentUrl: input.deploymentUrl || null,
      status: 'SUBMITTED',
    },
  });
};

export const listProjectsForHackathon = async (hackathonId: string) => {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  return prisma.project.findMany({
    where: { hackathonId },
    include: {
      participant: {
        select: { id: true, name: true, email: true },
      },
      testJobs: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getProjectById = async (projectId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      participant: {
        select: { id: true, name: true, email: true },
      },
      hackathon: {
        select: { id: true, name: true },
      },
      testJobs: {
        orderBy: { createdAt: 'desc' },
      },
      evaluations: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  return project;
};

export const updateProject = async (
  projectId: string,
  actorId: string,
  actorRole: string,
  input: {
    name?: string;
    description?: string;
    githubUrl?: string | null;
    deploymentUrl?: string | null;
    status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'TESTED' | 'EVALUATED';
  }
) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.participantId !== actorId && actorRole !== 'ORGANIZER') {
    throw new ForbiddenError('You are not allowed to update this project', 'FORBIDDEN');
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name ?? project.name,
      description: input.description ?? project.description,
      githubUrl: input.githubUrl ?? project.githubUrl,
      deploymentUrl: input.deploymentUrl ?? project.deploymentUrl,
      status: input.status ?? project.status,
    },
  });
};

export const deleteProject = async (projectId: string, actorId: string, actorRole: string) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.participantId !== actorId && actorRole !== 'ORGANIZER') {
    throw new ForbiddenError('You are not allowed to delete this project', 'FORBIDDEN');
  }

  await prisma.project.delete({ where: { id: projectId } });
  return { success: true };
};

export const getProjectStatus = async (projectId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  return project;
};
