import type { Request, Response } from 'express';
import {
  connectDeviceSession,
  endDeviceSession,
  getDeviceSession,
  heartbeatDeviceSession,
} from '../services/deviceSession.service';

export const connectSession = async (req: Request, res: Response): Promise<void> => {
  const result = await connectDeviceSession(req.body.token, {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ success: true, data: result });
};

export const getSession = async (req: Request, res: Response): Promise<void> => {
  const result = await getDeviceSession(String(req.params.id));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ success: true, data: result });
};

export const heartbeatSession = async (req: Request, res: Response): Promise<void> => {
  const result = await heartbeatDeviceSession(String(req.params.id));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ success: true, data: result });
};

export const deleteSession = async (req: Request, res: Response): Promise<void> => {
  await endDeviceSession(String(req.params.id));
  res.status(204).end();
};
