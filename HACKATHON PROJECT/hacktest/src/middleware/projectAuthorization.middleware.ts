import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

export const requireProjectOwner = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    next(new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED'));
    return;
  }

  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      next(new NotFoundError('Project not found', 'PROJECT_NOT_FOUND'));
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.userId },
      select: { id: true },
    });

    if (!project) {
      next(new NotFoundError('Project not found', 'PROJECT_NOT_FOUND'));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
