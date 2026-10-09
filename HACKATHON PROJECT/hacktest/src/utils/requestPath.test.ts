import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeRequestPath } from './requestPath';

describe('sanitizeRequestPath', () => {
  it('redacts QR tokens and device-session IDs from log paths', () => {
    const token = 'a'.repeat(64);
    const sessionId = '123e4567-e89b-42d3-a456-426614174000';

    assert.equal(
      sanitizeRequestPath(`/api/v1/qr/${token}/connect`),
      '/api/v1/qr/[REDACTED]/connect',
    );
    assert.equal(
      sanitizeRequestPath(`/api/v1/preview/${token}`),
      '/api/v1/preview/[REDACTED]',
    );
    assert.equal(
      sanitizeRequestPath(`/api/v1/sessions/${sessionId}/heartbeat`),
      '/api/v1/sessions/[REDACTED]/heartbeat',
    );
  });
});
