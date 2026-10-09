import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { projectAnalyticsRequestSchema } from './analytics.validators';

const projectId = '00000000-0000-4000-8000-000000000001';

describe('projectAnalyticsRequestSchema', () => {
  it('accepts optional RFC3339 date filters', () => {
    const result = projectAnalyticsRequestSchema.safeParse({
      params: { id: projectId },
      query: {
        startDate: '2026-10-01T00:00:00Z',
        endDate: '2026-10-09T23:59:59+05:30',
      },
    });

    assert.equal(result.success, true);
  });

  it('rejects invalid, reversed, and unknown query parameters', () => {
    for (const query of [
      { startDate: 'not-a-date' },
      { startDate: '2026-10-10T00:00:00Z', endDate: '2026-10-09T00:00:00Z' },
      { period: 'all' },
    ]) {
      assert.equal(
        projectAnalyticsRequestSchema.safeParse({ params: { id: projectId }, query }).success,
        false,
      );
    }
  });
});
