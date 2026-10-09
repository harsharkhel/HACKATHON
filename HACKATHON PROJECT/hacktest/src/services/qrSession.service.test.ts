import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createQrToken } from './qrSession.service';
import { hashSHA256 } from '../utils/crypto';

describe('createQrToken', () => {
  it('returns an unguessable token and stores only its SHA-256 digest', () => {
    const first = createQrToken();
    const second = createQrToken();

    assert.match(first.token, /^[a-f0-9]{64}$/);
    assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
    assert.equal(first.tokenHash, hashSHA256(first.token));
    assert.notEqual(first.token, first.tokenHash);
    assert.notEqual(first.token, second.token);
    assert.notEqual(first.tokenHash, second.tokenHash);
  });
});
