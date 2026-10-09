import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deviceInfoRequestSchema } from './session.validators';

describe('deviceInfoRequestSchema', () => {
  it('accepts bounded viewport and coarse connection metrics', () => {
    const result = deviceInfoRequestSchema.parse({
      params: { id: '123e4567-e89b-42d3-a456-426614174000' },
      body: {
        viewportWidth: 390,
        viewportHeight: 844,
        connectionType: 'cellular',
        effectiveType: '4g',
        downlinkMbps: 20,
        roundTripTimeMs: 50,
      },
    });
    assert.equal(result.body.viewportWidth, 390);
    assert.equal(result.body.connectionType, 'cellular');
  });

  it('rejects excessive viewport data and unbounded connection values', () => {
    assert.throws(() => deviceInfoRequestSchema.parse({
      params: { id: '123e4567-e89b-42d3-a456-426614174000' },
      body: { viewportWidth: 100_001 },
    }));
    assert.throws(() => deviceInfoRequestSchema.parse({
      params: { id: '123e4567-e89b-42d3-a456-426614174000' },
      body: { connectionType: 'private-network-name' },
    }));
  });
});
