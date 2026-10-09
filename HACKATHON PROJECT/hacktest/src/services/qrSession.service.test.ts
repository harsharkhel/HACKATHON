import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createQrToken } from './qrSession.service';
import { hashSHA256 } from '../utils/crypto';
import { prisma } from '../config/database';
import { getProjectPreviewByToken } from './qrSession.service';

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

describe('getProjectPreviewByToken', () => {
  it('returns only public project fields, latest health, and QR expiry', async () => {
    const { token } = createQrToken();
    const expiresAt = new Date('2026-10-09T20:00:00.000Z');
    const previous = Object.getOwnPropertyDescriptor(prisma.qRSession, 'findUnique');
    const previousHealth = Object.getOwnPropertyDescriptor(prisma.healthCheck, 'findFirst');

    Object.defineProperty(prisma.qRSession, 'findUnique', {
      configurable: true,
      value: async (args: unknown) => {
        assert.deepEqual(args, { where: { qrTokenHash: hashSHA256(token) }, include: {
          project: { select: { id: true, name: true, description: true, projectUrl: true } },
        } });
        return {
          id: 'qr-session-id',
          projectId: 'project-id',
          expiresAt,
          revokedAt: null,
          project: {
            id: 'project-id',
            name: 'Preview Project',
            description: 'Public description',
            projectUrl: 'https://example.com/',
            userId: 'private-owner-id',
          },
        };
      },
    });
    Object.defineProperty(prisma.healthCheck, 'findFirst', {
      configurable: true,
      value: async () => ({ isHealthy: true, responseTime: 142 }),
    });

    try {
      const result = await getProjectPreviewByToken(token);
      assert.deepEqual(result, {
        project: {
          name: 'Preview Project',
          description: 'Public description',
          projectUrl: 'https://example.com/',
        },
        health: { status: 'healthy', responseTime: 142 },
        session: { expiresAt },
      });
      assert.equal('userId' in result.project, false);
    } finally {
      if (previous) Object.defineProperty(prisma.qRSession, 'findUnique', previous);
      else Reflect.deleteProperty(prisma.qRSession, 'findUnique');
      if (previousHealth) Object.defineProperty(prisma.healthCheck, 'findFirst', previousHealth);
      else Reflect.deleteProperty(prisma.healthCheck, 'findFirst');
    }
  });
});
