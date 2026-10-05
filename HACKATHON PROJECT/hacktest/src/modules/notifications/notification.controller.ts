import type { NextFunction, Request, Response } from 'express';
import { listNotifications, markNotificationRead } from './notification.service';

export const listNotificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const notifications = await listNotifications(req.user.userId, {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      unreadOnly: req.query.unreadOnly === 'true',
    });

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

export const markNotificationReadHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const notification = await markNotificationRead(req.user.userId, String(req.params.id));
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};
