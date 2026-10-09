import test from 'node:test';
import assert from 'node:assert/strict';
import { listAuditLogsQuerySchema, createAuditLogSchema } from './audit.schema';

test('createAuditLogSchema accepts valid action metadata', () => {
  const result = createAuditLogSchema.safeParse({
    body: {
      action: 'LOGIN',
      entityType: 'USER',
      entityId: 'user-123',
      metadata: { source: 'web' },
      ipAddress: '127.0.0.1',
    },
  });

  assert.equal(result.success, true);
});

test('listAuditLogsQuerySchema rejects invalid page values', () => {
  const result = listAuditLogsQuerySchema.safeParse({
    query: { page: '0', limit: '10' },
  });

  assert.equal(result.success, false);
});
