import { z } from 'zod';

export const createTestJobSchema = z.object({
  body: z.object({
    projectId: z.string().min(1, 'Project id is required'),
    type: z.enum(['COMPATIBILITY', 'PERFORMANCE', 'LOAD']),
    sessionId: z.string().min(1, 'Session id is required').optional().or(z.literal('')),
  }),
});

export const updateTestJobStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Test job id is required'),
  }),
  body: z.object({
    status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    startedAt: z.coerce.date().optional(),
    completedAt: z.coerce.date().optional(),
    errorMessage: z.string().trim().max(2000).optional(),
  }),
});
