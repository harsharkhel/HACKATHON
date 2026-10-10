import { z } from 'zod';

export const createAuditLogSchema = z.object({
  body: z.object({
    action: z.enum([
      'LOGIN',
      'LOGOUT',
      'CREATE',
      'UPDATE',
      'DELETE',
      'VIEW',
      'EXPORT',
      'SYSTEM',
      'AUTH',
      'QR',
      'HEALTH_CHECK',
      'LOAD_TEST',
      'SESSION',
    ]),
    entityType: z.enum([
      'USER',
      'PROJECT',
      'QR_SESSION',
      'HEALTH_CHECK',
      'LOAD_TEST',
      'SESSION',
      'SYSTEM',
    ]).default('SYSTEM'),
    entityId: z.string().trim().min(1).max(255).optional(),
    metadata: z.record(z.any()).default({}),
    ipAddress: z.string().trim().refine(
      (value) => value === 'unknown' || /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(value),
      'IP address must be a valid IPv4 address or "unknown"',
    ).optional(),
  }).strict(),
});

export const listAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    entityType: z.string().trim().max(100).optional(),
    action: z.string().trim().max(100).optional(),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
  }).strict(),
});
