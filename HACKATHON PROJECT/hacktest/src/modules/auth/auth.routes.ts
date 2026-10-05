import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import { validate } from '../../middleware/validation.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { login, me, register } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', requireAuth, me);

export default router;
