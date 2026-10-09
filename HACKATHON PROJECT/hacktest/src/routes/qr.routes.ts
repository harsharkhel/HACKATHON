import { Router } from 'express';
import { connectFromQr, getQrPreview } from '../controllers/qrSession.controller';
import { qrSessionLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { qrTokenRequestSchema } from '../validators/session.validators';

const router = Router();

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/:token', qrSessionLimiter, validate(qrTokenRequestSchema), getQrPreview);
router.post('/:token/connect', qrSessionLimiter, validate(qrTokenRequestSchema), connectFromQr);

export default router;
