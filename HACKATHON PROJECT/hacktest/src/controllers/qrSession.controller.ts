import type { Request, Response } from 'express';
import { connectDeviceSession } from '../services/deviceSession.service';
import {
  createProjectQrSession,
  getQrProjectPreview,
  revokeProjectQrSession,
} from '../services/qrSession.service';
import { UnauthorizedError } from '../utils/errors';

const userId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED');
  return req.user.userId;
};

export const createQr = async (req: Request, res: Response): Promise<void> => {
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const result = await createProjectQrSession(String(req.params.id), userId(req), format);
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ success: true, data: result });
};

export const getQrPreview = async (req: Request, res: Response): Promise<void> => {
  const result = await getQrProjectPreview(String(req.params.token));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ success: true, data: result });
};

export const connectFromQr = async (req: Request, res: Response): Promise<void> => {
  const result = await connectDeviceSession(String(req.params.token), {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ success: true, data: result });
};

export const revokeQr = async (req: Request, res: Response): Promise<void> => {
  const result = await revokeProjectQrSession(
    String(req.params.id),
    userId(req),
    String(req.params.qrSessionId),
  );
  res.status(200).json({ success: true, data: result });
};
