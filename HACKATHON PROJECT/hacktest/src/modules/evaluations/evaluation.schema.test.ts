import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompatibilityResultSchema, createEvaluationSchema } from './evaluation.schema';

test('compatibility result schema accepts valid compatibility metrics', () => {
  const result = createCompatibilityResultSchema.safeParse({
    body: {
      testJobId: 'job-123',
      httpStatus: 200,
      pageLoadTime: 1.2,
      consoleErrors: 0,
      failedRequests: 0,
      brokenLinks: 0,
      horizontalOverflow: false,
      responsive: true,
      issues: [{ type: 'console', message: 'none' }],
    },
  });

  assert.equal(result.success, true);
});

test('evaluation schema requires judge project pairing', () => {
  const result = createEvaluationSchema.safeParse({
    body: {
      projectId: 'project-123',
      judgeId: '',
      innovationScore: 8,
    },
  });

  assert.equal(result.success, false);
});
