import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isHealthyStatus } from './healthCheck.service';

describe('isHealthyStatus', () => {
  it('treats successful and redirect responses as reachable', () => {
    assert.equal(isHealthyStatus(200), true);
    assert.equal(isHealthyStatus(302), true);
    assert.equal(isHealthyStatus(399), true);
  });

  it('rejects client and server errors', () => {
    assert.equal(isHealthyStatus(199), false);
    assert.equal(isHealthyStatus(400), false);
    assert.equal(isHealthyStatus(503), false);
  });
});
