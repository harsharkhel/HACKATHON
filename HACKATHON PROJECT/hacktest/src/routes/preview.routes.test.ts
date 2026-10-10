import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../app';
import { prisma } from '../config/database';
import { hashSHA256 } from '../utils/crypto';

describe('project preview API', () => {
  const token = 'a'.repeat(64);
  const expiresAt = new Date(Date.now() + 60_000);
  let server: Server;
  let baseUrl: string;
  let qrSession: object | null;
  const originals: Array<{ target: object; key: string; descriptor: PropertyDescriptor | undefined }> = [];

  const mockMethod = (target: object, key: string, value: (...args: never[]) => unknown): void => {
    originals.push({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) });
    Object.defineProperty(target, key, { configurable: true, value });
  };

  before(async () => {
    qrSession = {
      id: 'qr-session-id',
      projectId: '00000000-0000-4000-8000-000000000001',
      expiresAt,
      revokedAt: null,
      project: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Public project',
        description: 'Public description',
        projectUrl: 'https://example.com/',
        userId: 'private-owner-id',
        email: 'private@example.com',
      },
    };
    mockMethod(prisma.qRSession, 'findUnique', async (args) => {
      const query = args as unknown as { where: { qrTokenHash: string } };
      assert.equal(query.where.qrTokenHash, hashSHA256(token));
      return qrSession;
    });
    mockMethod(prisma.healthCheck, 'findFirst', async () => ({ isHealthy: true, responseTime: 142 }));
    server = app.listen(0);
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/preview/${token}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    for (const { target, key, descriptor } of originals.reverse()) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  });

  it('returns only preview fields with private no-cache headers and configured CORS', async () => {
    const response = await fetch(baseUrl, { headers: { origin: 'http://localhost:5173' } });
    const payload = await response.json() as {
      data: {
        project: Record<string, unknown>;
        health: { status: string; responseTime: number };
        session: { expiresAt: string };
      };
    };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.deepEqual(payload.data.project, {
      name: 'Public project',
      description: 'Public description',
      projectUrl: 'https://example.com/',
    });
    assert.deepEqual(payload.data.health, { status: 'healthy', responseTime: 142 });
    assert.equal(new Date(payload.data.session.expiresAt).toISOString(), expiresAt.toISOString());
  });

  it('does not authorize arbitrary origins or return expired/revoked token data', async () => {
    const disallowedOriginResponse = await fetch(baseUrl, {
      headers: { origin: 'https://attacker.example' },
    });
    assert.equal(disallowedOriginResponse.headers.get('access-control-allow-origin'), null);

    qrSession = null;
    const invalidResponse = await fetch(baseUrl);
    assert.equal(invalidResponse.status, 410);
    const payload = await invalidResponse.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, 'INVALID_QR_TOKEN');
  });
});
