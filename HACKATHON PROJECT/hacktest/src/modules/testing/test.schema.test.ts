import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestJobSchema, updateTestJobStatusSchema } from './test.schema';

test('createTestJobSchema validates a valid payload', () => {
  const result = createTestJobSchema.safeParse({
    body: {
      projectId: 'project-123',
      type: 'COMPATIBILITY',
      sessionId: 'session-789',
    },
  });

  assert.equal(result.success, true);
});

test('updateTestJobStatusSchema rejects empty status values', () => {
  const result = updateTestJobStatusSchema.safeParse({
    params: { id: 'job-123' },
    body: { status: '' },
  });

  assert.equal(result.success, false);
});
