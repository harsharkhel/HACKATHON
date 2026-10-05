import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const listHackathons = async () => {
  return prisma.hackathon.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      organizer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: { projects: true },
      },
    },
  });
};

export const getHackathonById = async (hackathonId: string) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    include: {
      organizer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      judges: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  return hackathon;
};

export const createHackathon = async (
  organizerId: string,
  input: {
    name: string;
    description?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    submissionDeadline?: Date | null;
  }
) => {
  return prisma.hackathon.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      submissionDeadline: input.submissionDeadline ?? null,
      organizerId,
      status: 'DRAFT',
    },
  });
};

export const updateHackathon = async (
  hackathonId: string,
  organizerId: string,
  input: {
    name?: string;
    description?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    submissionDeadline?: Date | null;
    status?: 'DRAFT' | 'ACTIVE' | 'JUDGING' | 'COMPLETED' | 'ARCHIVED';
  }
) => {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  if (hackathon.organizerId !== organizerId) {
    throw new ForbiddenError('You are not allowed to update this hackathon', 'FORBIDDEN');
  }

  return prisma.hackathon.update({
    where: { id: hackathonId },
    data: {
      name: input.name ?? hackathon.name,
      description: input.description ?? hackathon.description,
      startDate: input.startDate ?? hackathon.startDate,
      endDate: input.endDate ?? hackathon.endDate,
      submissionDeadline: input.submissionDeadline ?? hackathon.submissionDeadline,
      status: input.status ?? hackathon.status,
    },
  });
};

export const deleteHackathon = async (hackathonId: string, organizerId: string) => {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  if (hackathon.organizerId !== organizerId) {
    throw new ForbiddenError('You are not allowed to delete this hackathon', 'FORBIDDEN');
  }

  await prisma.hackathon.delete({ where: { id: hackathonId } });
  return { success: true };
};

export const joinHackathon = async (hackathonId: string, userId: string) => {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  const existing = await prisma.hackathonParticipant.findUnique({
    where: {
      userId_hackathonId: {
        userId,
        hackathonId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.hackathonParticipant.create({
    data: {
      userId,
      hackathonId,
    },
  });
};

export const assignJudgeToHackathon = async (
  hackathonId: string,
  organizerId: string,
  judgeId: string
) => {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) {
    throw new NotFoundError('Hackathon not found', 'HACKATHON_NOT_FOUND');
  }

  if (hackathon.organizerId !== organizerId) {
    throw new ForbiddenError('Only the organizer can assign judges', 'FORBIDDEN');
  }

  const judgeUser = await prisma.user.findUnique({ where: { id: judgeId } });
  if (!judgeUser) {
    throw new NotFoundError('Judge not found', 'JUDGE_NOT_FOUND');
  }

  if (judgeUser.role !== 'JUDGE') {
    throw new ForbiddenError('The selected user is not a judge', 'INVALID_JUDGE');
  }

  const existing = await prisma.hackathonJudge.findUnique({
    where: {
      userId_hackathonId: {
        userId: judgeId,
        hackathonId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.hackathonJudge.create({
    data: {
      userId: judgeId,
      hackathonId,
    },
  });
};
