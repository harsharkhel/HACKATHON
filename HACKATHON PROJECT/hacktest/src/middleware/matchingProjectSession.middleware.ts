import type { NextFunction, Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

export const requireMatchingProjectSession = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.activeProjectSession) {
    next(new UnauthorizedError('An active project session is required', 'PROJECT_SESSION_REQUIRED'));
    return;
  }
  if (req.activeProjectSession.projectId !== req.params.id) {
    next(new NotFoundError('Project not found', 'PROJECT_NOT_FOUND'));
    return;
  }
  next();
};
