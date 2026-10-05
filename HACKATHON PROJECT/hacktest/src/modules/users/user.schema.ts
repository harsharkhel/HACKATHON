import { z } from 'zod';

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(80).optional(),
    email: z.string().trim().email('Please provide a valid email address').optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'User id is required'),
  }),
});
