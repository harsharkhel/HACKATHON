import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateLoadTestMetrics } from './loadTest.metrics';

describe('calculateLoadTestMetrics', () => {
  it('calculates latency percentiles, status and error distributions, rate, and error ratio', () => {
    const metrics = calculateLoadTestMetrics([
      { latencyMs: 10, statusCode: 200, errorReason: null },
      { latencyMs: 20, statusCode: 200, errorReason: null },
      { latencyMs: 30, statusCode: 503, errorReason: null },
      { latencyMs: 40, statusCode: null, errorReason: 'timeout' },
    ], 2_000);

    assert.equal(metrics.totalRequests, 4);
    assert.equal(metrics.successfulRequests, 2);
    assert.equal(metrics.failedRequests, 2);
    assert.equal(metrics.averageResponseTime, 25);
    assert.equal(metrics.medianResponseTime, 25);
    assert.equal(metrics.p95ResponseTime, 40);
    assert.equal(metrics.p99ResponseTime, 40);
    assert.equal(metrics.requestsPerSecond, 2);
    assert.equal(metrics.errorRate, 0.5);
    assert.deepEqual(metrics.httpStatusDistribution, { '200': 2, '503': 1 });
    assert.deepEqual(metrics.errorDistribution, { http_503: 1, timeout: 1 });
  });

  it('returns empty distributions and safe values when no requests complete', () => {
    const metrics = calculateLoadTestMetrics([], 0);

    assert.equal(metrics.totalRequests, 0);
    assert.equal(metrics.averageResponseTime, null);
    assert.equal(metrics.medianResponseTime, null);
    assert.equal(metrics.requestsPerSecond, 0);
    assert.equal(metrics.errorRate, 0);
    assert.deepEqual(metrics.httpStatusDistribution, {});
  });
});
