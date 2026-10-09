import { z } from 'zod';

export const sessionIdRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const qrSessionIdRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    qrSessionId: z.string().uuid(),
  }),
});

export const qrTokenRequestSchema = z.object({
  params: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) }),
});

export const connectSessionRequestSchema = z.object({
  body: z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/i),
  }).strict(),
});

export const createQrRequestSchema = z.object({
  query: z.object({ format: z.enum(['svg', 'png']).optional() }),
});
