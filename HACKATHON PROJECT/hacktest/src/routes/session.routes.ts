import { Router } from 'express';
import {
  connectSession,
  deleteSession,
  getSession,
  heartbeatSession,
} from '../controllers/deviceSession.controller';
import { qrSessionLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { connectSessionRequestSchema, sessionIdRequestSchema } from '../validators/session.validators';

const router = Router();

router.post('/connect', qrSessionLimiter, validate(connectSessionRequestSchema), connectSession);
router.get('/:id', qrSessionLimiter, validate(sessionIdRequestSchema), getSession);
router.post('/:id/heartbeat', qrSessionLimiter, validate(sessionIdRequestSchema), heartbeatSession);
router.delete('/:id', qrSessionLimiter, validate(sessionIdRequestSchema), deleteSession);

export default router;
