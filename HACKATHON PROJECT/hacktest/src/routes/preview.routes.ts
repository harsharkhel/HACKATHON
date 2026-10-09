import { Router } from 'express';
import { getProjectPreview } from '../controllers/preview.controller';
import { previewLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { previewTokenRequestSchema } from '../validators/session.validators';

const router = Router();

router.get('/:sessionToken', previewLimiter, validate(previewTokenRequestSchema), getProjectPreview);

export default router;
