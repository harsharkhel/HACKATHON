import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { assignJudgeHandler, createHackathonHandler, deleteHackathonHandler, getHackathon, getHackathons, joinHackathonHandler, updateHackathonHandler } from './hackathon.controller';
import { assignJudgeSchema, createHackathonSchema, updateHackathonSchema } from './hackathon.schema';

const router = Router();

router.get('/', requireAuth, getHackathons);
router.get('/:id', requireAuth, getHackathon);
router.post('/', requireAuth, requireRole('ORGANIZER'), validate(createHackathonSchema), createHackathonHandler);
router.patch('/:id', requireAuth, requireRole('ORGANIZER'), validate(updateHackathonSchema), updateHackathonHandler);
router.delete('/:id', requireAuth, requireRole('ORGANIZER'), deleteHackathonHandler);
router.post('/:id/join', requireAuth, requireRole('PARTICIPANT'), joinHackathonHandler);
router.post('/:id/judges', requireAuth, requireRole('ORGANIZER'), validate(assignJudgeSchema), assignJudgeHandler);

export default router;
