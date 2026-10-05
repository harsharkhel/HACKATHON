import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ForbiddenError, GoneError, NotFoundError } from '../../utils/errors';
import { hashSHA256 } from '../../utils/crypto';

export const createProjectQrSession = async (projectId: string, actorId: string, actorRole: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { participant: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.participantId !== actorId && actorRole !== 'ORGANIZER') {
    throw new ForbiddenError('You are not allowed to generate a QR session for this project', 'FORBIDDEN');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const sessionUrl = `${env.FRONTEND_URL}/session/${token}`;

  const session = await prisma.testingSession.create({
    data: {
      projectId,
      tokenHash: hashSHA256(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  const qrCode = await QRCode.toDataURL(sessionUrl);

  return {
    id: session.id,
    expiresAt: session.expiresAt,
    sessionUrl,
    qrCode,
    project: {
      id: project.id,
      name: project.name,
      deploymentUrl: project.deploymentUrl,
    },
  };
};

export const validateQrToken = async (token: string) => {
  if (!token || token.trim().length === 0) {
    throw new GoneError('Invalid or missing QR token', 'INVALID_QR_TOKEN');
  }

  const tokenHash = hashSHA256(token);
  const session = await prisma.testingSession.findUnique({
    where: { tokenHash },
    include: { project: true },
  });

  if (!session) {
    throw new GoneError('This QR session is invalid or expired', 'INVALID_QR_TOKEN');
  }

  if (session.expiresAt < new Date()) {
    throw new GoneError('This QR session has expired', 'QR_EXPIRED');
  }

  if (session.usedAt) {
    throw new GoneError('This QR session has already been used', 'QR_ALREADY_USED');
  }

  await prisma.testingSession.update({
    where: { id: session.id },
    data: { usedAt: new Date() },
  });

  return {
    sessionId: session.id,
    projectId: session.projectId,
    projectName: session.project.name,
    description: session.project.description,
    deploymentUrl: session.project.deploymentUrl,
  };
};
