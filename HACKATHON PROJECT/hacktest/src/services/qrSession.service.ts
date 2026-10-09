import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { GoneError, NotFoundError } from '../utils/errors';
import { hashSHA256 } from '../utils/crypto';

const QR_TOKEN_TTL_MS = 30 * 60 * 1000;

export type QrImageFormat = 'svg' | 'png';

const tokenHash = (token: string): string => hashSHA256(token);

export const createQrToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: tokenHash(token) };
};

const findValidQrSession = async (token: string) => {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new GoneError('This QR session is invalid or expired', 'INVALID_QR_TOKEN');
  }

  const session = await prisma.qRSession.findUnique({
    where: { qrTokenHash: tokenHash(token) },
    include: {
      project: {
        select: { id: true, name: true, description: true, projectUrl: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw new GoneError('This QR session is invalid or expired', 'INVALID_QR_TOKEN');
  }

  return session;
};

export const createProjectQrSession = async (
  projectId: string,
  userId: string,
  format: QrImageFormat,
) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');

  const { token, tokenHash: storedTokenHash } = createQrToken();
  const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS);
  const sessionUrl = `${env.FRONTEND_URL.replace(/\/+$/, '')}/p/${token}`;
  const image = format === 'svg'
    ? await QRCode.toString(sessionUrl, { type: 'svg', errorCorrectionLevel: 'M' })
    : await QRCode.toDataURL(sessionUrl, { type: 'image/png', errorCorrectionLevel: 'M' });
  const session = await prisma.qRSession.create({
    data: {
      projectId,
      qrTokenHash: storedTokenHash,
      expiresAt,
    },
  });

  return {
    id: session.id,
    expiresAt: session.expiresAt,
    sessionUrl,
    format,
    image,
  };
};

export const getQrProjectPreview = async (token: string) => {
  const session = await findValidQrSession(token);
  return {
    expiresAt: session.expiresAt,
    project: session.project,
  };
};

export const getProjectPreviewByToken = async (token: string) => {
  const session = await findValidQrSession(token);
  const latestHealthCheck = await prisma.healthCheck.findFirst({
    where: { projectId: session.projectId },
    orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
    select: { isHealthy: true, responseTime: true },
  });

  return {
    project: {
      name: session.project.name,
      description: session.project.description,
      projectUrl: session.project.projectUrl,
    },
    health: {
      status: latestHealthCheck ? (latestHealthCheck.isHealthy ? 'healthy' : 'unhealthy') : 'unknown',
      responseTime: latestHealthCheck?.responseTime ?? null,
    },
    session: {
      expiresAt: session.expiresAt,
    },
  };
};

export const revokeProjectQrSession = async (
  projectId: string,
  userId: string,
  qrSessionId: string,
) => {
  const owned = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!owned) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');

  const revokedAt = new Date();
  const result = await prisma.qRSession.updateMany({
    where: { id: qrSessionId, projectId, revokedAt: null },
    data: { revokedAt },
  });
  if (result.count !== 1) throw new NotFoundError('QR session not found', 'QR_SESSION_NOT_FOUND');
  return { revokedAt };
};

export const resolveQrTokenForConnection = async (token: string) => {
  const session = await findValidQrSession(token);
  return {
    projectId: session.project.id,
    project: session.project,
    expiresAt: session.expiresAt,
  };
};
