import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isIP } from 'node:net';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    next(new UnauthorizedError('Authentication token is required', 'MISSING_TOKEN'));
    return;
  }

  let userId: string | undefined;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'object' && payload !== null) {
      const id = typeof payload.userId === 'string' ? payload.userId : payload.sub;
      if (typeof id === 'string' && isIP(id) === 0) {
        userId = id;
      }
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Invalid or expired token', 'INVALID_TOKEN'));
      return;
    }
    next(error);
    return;
  }

  if (!userId) {
    next(new UnauthorizedError('Invalid authentication token', 'INVALID_TOKEN'));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      next(new UnauthorizedError('Invalid authentication token', 'INVALID_TOKEN'));
      return;
    }

    req.user = { userId: user.id, role: user.role as UserRole };
    next();
  } catch (error) {
    next(error);
  }
};
