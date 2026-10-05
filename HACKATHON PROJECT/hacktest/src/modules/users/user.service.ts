import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const listUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  return user;
};

export const updateUserProfile = async (
  userId: string,
  actorId: string,
  actorRole: string,
  input: { name?: string; email?: string }
) => {
  if (userId !== actorId && actorRole !== 'ORGANIZER') {
    throw new ForbiddenError('You are not allowed to update this profile', 'FORBIDDEN');
  }

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  if (input.email && input.email.toLowerCase() !== existingUser.email.toLowerCase()) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (emailTaken) {
      throw new ForbiddenError('This email is already in use', 'EMAIL_TAKEN');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name ?? existingUser.name,
      email: input.email ? input.email.toLowerCase() : existingUser.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};
