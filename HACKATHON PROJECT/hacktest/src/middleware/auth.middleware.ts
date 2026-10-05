import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import type { AuthenticatedUser } from '../modules/auth/auth.types';

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new UnauthorizedError('Authentication token is required', 'MISSING_TOKEN');
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string; role?: string };

    if (!payload.userId || !payload.role) {
      throw new UnauthorizedError('Invalid authentication token', 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User associated with this token no longer exists', 'INVALID_TOKEN');
    }

    req.user = {
      userId: user.id,
      role: user.role as AuthenticatedUser['role'],
    };

    next();
  } catch (error) {
    next(error instanceof Error ? new UnauthorizedError('Invalid or expired token', 'INVALID_TOKEN') : error);
  }
};
