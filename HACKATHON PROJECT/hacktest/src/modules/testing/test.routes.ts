import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { createTestJobHandler, getTestJobHandler, listProjectTestJobsHandler, updateTestJobStatusHandler } from './test.controller';
import { createTestJobSchema, updateTestJobStatusSchema } from './test.schema';

const router = Router();

router.post('/jobs', requireAuth, requireRole('JUDGE', 'ORGANIZER'), validate(createTestJobSchema), createTestJobHandler);
router.get('/projects/:projectId/jobs', requireAuth, listProjectTestJobsHandler);
router.get('/jobs/:id', requireAuth, getTestJobHandler);
router.patch('/jobs/:id/status', requireAuth, requireRole('JUDGE', 'ORGANIZER'), validate(updateTestJobStatusSchema), updateTestJobStatusHandler);

export default router;
