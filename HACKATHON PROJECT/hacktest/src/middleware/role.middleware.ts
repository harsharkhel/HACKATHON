import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const requireRole = (...allowedRoles: Array<'PARTICIPANT' | 'JUDGE' | 'ORGANIZER'>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action', 'FORBIDDEN'));
    }

    next();
  };
};
