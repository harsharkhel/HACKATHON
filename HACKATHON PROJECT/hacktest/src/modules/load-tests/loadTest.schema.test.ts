import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLoadTestRequestSchema } from './loadTest.schema';

describe('createLoadTestRequestSchema', () => {
  it('applies bounded defaults for concurrency, duration, and request count', () => {
    assert.deepEqual(
      createLoadTestRequestSchema.parse({ body: {} }),
      { body: { concurrency: 100, durationSeconds: 30, maxRequests: 10_000 } },
    );
  });

  it('allows the documented 500-user cap but rejects higher values and unbounded duration', () => {
    assert.equal(createLoadTestRequestSchema.parse({
      body: { concurrency: 500, durationSeconds: 60, maxRequests: 10_000 },
    }).body.concurrency, 500);
    assert.throws(() => createLoadTestRequestSchema.parse({
      body: { concurrency: 501, durationSeconds: 60, maxRequests: 10_000 },
    }));
    assert.throws(() => createLoadTestRequestSchema.parse({
      body: { concurrency: 10, durationSeconds: 61, maxRequests: 10_000 },
    }));
  });
});
