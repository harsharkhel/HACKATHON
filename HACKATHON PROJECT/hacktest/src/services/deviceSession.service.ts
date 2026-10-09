import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { prisma } from '../config/database';
import { deleteTemporaryState, getTemporaryState, setTemporaryState } from '../config/redis';
import { GoneError, NotFoundError } from '../utils/errors';
import { hashSHA256 } from '../utils/crypto';
import { createModuleLogger } from '../utils/logger';
import { resolveQrTokenForConnection } from './qrSession.service';

const log = createModuleLogger('device-session');
const SESSION_TTL_MS = 30 * 60 * 1000;
const ACTIVE_SESSION_PREFIX = 'hackpreview:active-session:';

export interface ConnectionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export const parseDeviceMetadata = (userAgent: string | null) => {
  const ua = (userAgent ?? '').slice(0, 512);
  const deviceType = /ipad|tablet/i.test(ua)
    ? 'tablet'
    : /mobile|iphone|android/i.test(ua)
      ? 'mobile'
      : 'desktop';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /firefox\//i.test(ua)
      ? 'Firefox'
      : /chrome\//i.test(ua)
        ? 'Chrome'
        : /safari\//i.test(ua) && !/chrome\//i.test(ua)
          ? 'Safari'
          : 'Unknown';
  const operatingSystem = /windows/i.test(ua)
    ? 'Windows'
    : /android/i.test(ua)
      ? 'Android'
      : /iphone|ipad|ios/i.test(ua)
        ? 'iOS'
        : /mac os|macintosh/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Unknown';

  return { deviceType, browser, operatingSystem, userAgent: ua || null };
};

const activeSessionKey = (sessionId: string): string => `${ACTIVE_SESSION_PREFIX}${sessionId}`;
const normalizeIpAddress = (ipAddress: string | null): string | null =>
  ipAddress?.startsWith('::ffff:') ? ipAddress.slice(7) : ipAddress;

const getActiveDeviceSession = async (sessionId: string) => {
  const session = await prisma.deviceSession.findUnique({
    where: { id: sessionId },
    include: {
      projectSession: {
        include: { project: { select: { id: true, name: true, description: true, projectUrl: true } } },
      },
    },
  });

  if (!session) throw new NotFoundError('Device session not found', 'SESSION_NOT_FOUND');
  if (session.projectSession.expiresAt <= new Date()) {
    await deleteTemporaryState(activeSessionKey(sessionId));
    throw new GoneError('Device session has expired', 'SESSION_EXPIRED');
  }

  const activeProjectId = await getTemporaryState(activeSessionKey(sessionId));
  if (activeProjectId !== session.projectSession.projectId) {
    throw new GoneError('Device session is no longer active', 'SESSION_INACTIVE');
  }

  return session;
};

const publicDeviceSession = (session: Awaited<ReturnType<typeof getActiveDeviceSession>>) => ({
  id: session.id,
  deviceType: session.deviceType,
  browser: session.browser,
  operatingSystem: session.operatingSystem,
  connectedAt: session.connectedAt,
  lastSeenAt: session.lastSeenAt,
  expiresAt: session.projectSession.expiresAt,
  project: session.projectSession.project,
});

export const connectDeviceSession = async (
  qrToken: string,
  metadata: ConnectionMetadata,
) => {
  const qr = await resolveQrTokenForConnection(qrToken);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const parsedMetadata = parseDeviceMetadata(metadata.userAgent);
  const deviceSession = await prisma.$transaction(async (transaction) => {
    const projectSession = await transaction.projectSession.create({
      data: {
        projectId: qr.projectId,
        sessionToken: hashSHA256(id),
        expiresAt,
      },
    });
    return transaction.deviceSession.create({
      data: {
        id,
        projectSessionId: projectSession.id,
        deviceType: parsedMetadata.deviceType,
        browser: parsedMetadata.browser,
        operatingSystem: parsedMetadata.operatingSystem,
        ipAddress: normalizeIpAddress(metadata.ipAddress),
        userAgent: parsedMetadata.userAgent,
      },
      include: {
        projectSession: {
          include: { project: { select: { id: true, name: true, description: true, projectUrl: true } } },
        },
      },
    });
  });

  try {
    await setTemporaryState(activeSessionKey(id), qr.projectId, Math.ceil(SESSION_TTL_MS / 1000));
  } catch (error) {
    await prisma.projectSession.update({
      where: { id: deviceSession.projectSessionId },
      data: { expiresAt: new Date() },
    });
    log.error({ err: error, sessionId: id }, 'Failed to activate device session in Redis');
    throw error;
  }

  log.info({ sessionId: id, projectId: qr.projectId }, 'Device session connected');
  return publicDeviceSession(deviceSession);
};

export const getDeviceSession = async (sessionId: string) =>
  publicDeviceSession(await getActiveDeviceSession(sessionId));

export const heartbeatDeviceSession = async (sessionId: string) => {
  const session = await getActiveDeviceSession(sessionId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.projectSession.update({
      where: { id: session.projectSessionId },
      data: { expiresAt },
    });
    return transaction.deviceSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: now },
      include: {
        projectSession: {
          include: { project: { select: { id: true, name: true, description: true, projectUrl: true } } },
        },
      },
    });
  });
  await setTemporaryState(activeSessionKey(sessionId), session.projectSession.projectId, Math.ceil(SESSION_TTL_MS / 1000));
  return publicDeviceSession(updated);
};

export const endDeviceSession = async (sessionId: string): Promise<void> => {
  const session = await prisma.deviceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, projectSessionId: true },
  });
  if (!session) throw new NotFoundError('Device session not found', 'SESSION_NOT_FOUND');

  await prisma.projectSession.update({
    where: { id: session.projectSessionId },
    data: { expiresAt: new Date() },
  });
  await deleteTemporaryState(activeSessionKey(sessionId));
  log.info({ sessionId }, 'Device session disconnected');
};

export const requireActiveDeviceSession = async (sessionId: string): Promise<{ id: string; projectId: string }> => {
  if (isIP(sessionId) !== 0 || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new GoneError('Device session is no longer active', 'SESSION_INACTIVE');
  }
  const session = await getActiveDeviceSession(sessionId);
  return { id: session.id, projectId: session.projectSession.projectId };
};
