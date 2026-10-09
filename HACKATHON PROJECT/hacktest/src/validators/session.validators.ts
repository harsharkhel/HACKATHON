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

export const previewTokenRequestSchema = z.object({
  params: z.object({ sessionToken: z.string().regex(/^[a-f0-9]{64}$/i) }),
});

export const connectSessionRequestSchema = z.object({
  body: z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/i),
  }).strict(),
});

export const deviceInfoRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    viewportWidth: z.number().int().min(1).max(10_000).optional(),
    viewportHeight: z.number().int().min(1).max(10_000).optional(),
    connectionType: z.enum(['wifi', 'cellular', 'ethernet', 'bluetooth', 'other']).optional(),
    effectiveType: z.enum(['slow-2g', '2g', '3g', '4g']).optional(),
    downlinkMbps: z.number().min(0).max(1_000).optional(),
    roundTripTimeMs: z.number().int().min(0).max(60_000).optional(),
  }).strict(),
});

export const createQrRequestSchema = z.object({
  query: z.object({ format: z.enum(['svg', 'png']).optional() }),
});
