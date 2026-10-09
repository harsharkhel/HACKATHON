import { z } from 'zod';

export const createLoadTestRequestSchema = z.object({
  body: z.object({
    concurrency: z.number().int().min(1).max(500).default(100),
    durationSeconds: z.number().int().min(5).max(60).default(30),
    maxRequests: z.number().int().min(100).max(10_000).default(10_000),
  }).strict(),
});

export const loadTestProjectIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const loadTestIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateLoadTestInput = z.infer<typeof createLoadTestRequestSchema>['body'];
