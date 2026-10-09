import { Router } from 'express';
import {
  connectSession,
  deleteSession,
  getSession,
  heartbeatSession,
  updateSessionDeviceInfo,
} from '../controllers/deviceSession.controller';
import { qrSessionLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  connectSessionRequestSchema,
  deviceInfoRequestSchema,
  sessionIdRequestSchema,
} from '../validators/session.validators';

const router = Router();

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.post('/connect', qrSessionLimiter, validate(connectSessionRequestSchema), connectSession);
router.get('/:id', qrSessionLimiter, validate(sessionIdRequestSchema), getSession);
router.post('/:id/heartbeat', qrSessionLimiter, validate(sessionIdRequestSchema), heartbeatSession);
router.post('/:id/device-info', qrSessionLimiter, validate(deviceInfoRequestSchema), updateSessionDeviceInfo);
router.delete('/:id', qrSessionLimiter, validate(sessionIdRequestSchema), deleteSession);

export default router;
