import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(80, 'Name is too long'),
    email: z.string().trim().email('Please provide a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long').max(128, 'Password is too long'),
    role: z.enum(['PARTICIPANT', 'JUDGE', 'ORGANIZER']).default('PARTICIPANT'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long').max(128, 'Password is too long'),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});
