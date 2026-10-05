import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshSchema } from './auth.schema';

test('refreshSchema accepts a refresh token payload', () => {
  const result = refreshSchema.safeParse({
    body: { refreshToken: 'token-value' },
  });

  assert.equal(result.success, true);
});

test('refreshSchema rejects empty refresh token', () => {
  const result = refreshSchema.safeParse({
    body: { refreshToken: '' },
  });

  assert.equal(result.success, false);
});
