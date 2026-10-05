import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { createProjectHandler, deleteProjectHandler, getProject, getProjectStatusHandler, getProjectsByHackathon, updateProjectHandler } from './project.controller';
import { createProjectSchema, updateProjectSchema } from './project.schema';

const router = Router();

router.post('/', requireAuth, requireRole('PARTICIPANT'), validate(createProjectSchema), createProjectHandler);
router.get('/hackathon/:hackathonId', requireAuth, getProjectsByHackathon);
router.get('/:id', requireAuth, getProject);
router.patch('/:id', requireAuth, validate(updateProjectSchema), updateProjectHandler);
router.delete('/:id', requireAuth, deleteProjectHandler);
router.get('/:id/status', requireAuth, getProjectStatusHandler);

export default router;
