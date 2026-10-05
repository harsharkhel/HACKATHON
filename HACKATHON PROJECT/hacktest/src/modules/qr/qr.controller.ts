import type { NextFunction, Request, Response } from 'express';
import { createProjectQrSession, validateQrToken } from './qr.service';

export const createQrSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const session = await createProjectQrSession(String(req.params.id), req.user.userId, req.user.role);
    res.status(200).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const validateQrSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await validateQrToken(String(req.params.token));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
