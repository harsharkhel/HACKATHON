import type { NextFunction, Request, Response } from 'express';
import { GoneError, UnauthorizedError } from '../utils/errors';
import { requireActiveDeviceSession } from '../services/deviceSession.service';

export const requireActiveProjectSession = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const sessionId = req.header('x-project-session-id');
  if (!sessionId) {
    next(new UnauthorizedError('An active project session is required', 'PROJECT_SESSION_REQUIRED'));
    return;
  }

  try {
    req.activeProjectSession = await requireActiveDeviceSession(sessionId);
    next();
  } catch (error) {
    if (error instanceof GoneError) {
      next(error);
      return;
    }
    next(error);
  }
};
