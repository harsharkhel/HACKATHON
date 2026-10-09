import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProjectOwner } from '../middleware/projectAuthorization.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createProjectRequestSchema,
  projectIdRequestSchema,
  updateProjectRequestSchema,
} from '../validators/project.validators';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('PARTICIPANT'),
  validate(createProjectRequestSchema),
  projectController.create,
);
router.get('/', requireAuth, projectController.list);
router.get(
  '/:id',
  requireAuth,
  validate(projectIdRequestSchema),
  requireProjectOwner,
  projectController.getById,
);
router.patch(
  '/:id',
  requireAuth,
  requireRole('PARTICIPANT'),
  validate(projectIdRequestSchema),
  validate(updateProjectRequestSchema),
  requireProjectOwner,
  projectController.update,
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('PARTICIPANT'),
  validate(projectIdRequestSchema),
  requireProjectOwner,
  projectController.remove,
);

export default router;
