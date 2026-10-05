import { z } from 'zod';

export const createHackathonSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Hackathon name is required').max(120),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    submissionDeadline: z.coerce.date().optional(),
  }),
});

export const updateHackathonSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    submissionDeadline: z.coerce.date().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'JUDGING', 'COMPLETED', 'ARCHIVED']).optional(),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const assignJudgeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    judgeId: z.string().min(1, 'Judge id is required'),
  }),
});
