import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: z.coerce.boolean().optional(),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification id is required'),
  }),
});
