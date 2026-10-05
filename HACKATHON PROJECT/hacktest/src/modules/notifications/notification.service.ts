import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const listNotifications = async (
  userId: string,
  query: { page?: number; limit?: number; unreadOnly?: boolean }
) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const skip = (page - 1) * limit;

  const where: { userId: string; read?: boolean } = { userId };
  if (query.unreadOnly === true) {
    where.read = false;
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError('You cannot update this notification', 'FORBIDDEN');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
};

export const createNotification = async (
  userId: string,
  input: { type: 'TEST_COMPLETED' | 'EVALUATION_RECEIVED' | 'PROJECT_SUBMITTED' | 'HACKATHON_UPDATE'; title: string; message: string }
) => {
  return prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
    },
  });
};
