import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { listNotificationsHandler, markNotificationReadHandler } from './notification.controller';
import { listNotificationsQuerySchema, markNotificationReadSchema } from './notification.schema';

const router = Router();

router.get('/', requireAuth, validate(listNotificationsQuerySchema), listNotificationsHandler);
router.patch('/:id/read', requireAuth, validate(markNotificationReadSchema), markNotificationReadHandler);

export default router;
