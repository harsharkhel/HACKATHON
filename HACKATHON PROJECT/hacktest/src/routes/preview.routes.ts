import { Router } from 'express';
import { getProjectPreview } from '../controllers/preview.controller';
import { previewLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { previewTokenRequestSchema } from '../validators/session.validators';

const router = Router();

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

router.get('/:sessionToken', previewLimiter, validate(previewTokenRequestSchema), getProjectPreview);

export default router;
