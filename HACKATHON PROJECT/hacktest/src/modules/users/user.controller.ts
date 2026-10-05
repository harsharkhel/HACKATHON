import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../utils/errors';
import { getUserById, listUsers, updateUserProfile } from './user.service';

export const getUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await listUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = String(req.params.id);
    const actor = req.user;

    if (!actor) {
      throw new ForbiddenError('Authentication is required', 'AUTH_REQUIRED');
    }

    if (actor.userId !== targetUserId && actor.role !== 'ORGANIZER') {
      throw new ForbiddenError('You can only view your own profile unless you are an organizer', 'FORBIDDEN');
    }

    const user = await getUserById(targetUserId);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = String(req.params.id);
    const actor = req.user;

    if (!actor) {
      throw new ForbiddenError('Authentication is required', 'AUTH_REQUIRED');
    }

    const updatedUser = await updateUserProfile(targetUserId, actor.userId, actor.role, req.body);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};
