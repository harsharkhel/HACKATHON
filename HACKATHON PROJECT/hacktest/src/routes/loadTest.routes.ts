import { Router } from 'express';
import {
  cancelLoadTestHandler,
  getLoadTestHandler,
} from '../controllers/loadTest.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loadTestLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { loadTestIdSchema } from '../modules/load-tests/loadTest.schema';

const router = Router();

router.post('/:id/cancel', requireAuth, loadTestLimiter, validate(loadTestIdSchema), cancelLoadTestHandler);
router.get('/:id', requireAuth, validate(loadTestIdSchema), getLoadTestHandler);

export default router;
