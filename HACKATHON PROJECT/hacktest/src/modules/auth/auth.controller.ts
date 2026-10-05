import type { NextFunction, Request, Response } from 'express';
import { loginUser, getCurrentUserById, registerUser } from './auth.service';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const user = await getCurrentUserById(req.user.userId);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
