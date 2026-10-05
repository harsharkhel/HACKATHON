import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { createQrSession, validateQrSession } from './qr.controller';

const router = Router();

router.post('/projects/:id/qr', requireAuth, createQrSession);
router.get('/qr/:token', validateQrSession);

export default router;
