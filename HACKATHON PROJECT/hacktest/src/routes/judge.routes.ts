import { Router } from 'express';
import {
  getJudgeProject,
  getJudgeProjectDevicesHandler,
  getJudgeProjectHealthHandler,
  getJudgeProjectLoadTestsHandler,
} from '../controllers/judgeProject.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireMatchingProjectSession } from '../middleware/matchingProjectSession.middleware';
import { requireActiveProjectSession } from '../middleware/projectSession.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import { projectIdRequestSchema } from '../validators/project.validators';

const router = Router();
const authorizeJudgeProject = [
  requireAuth,
  requireRole('JUDGE'),
  validate(projectIdRequestSchema),
  requireActiveProjectSession,
  requireMatchingProjectSession,
] as const;

router.get('/projects/:id', ...authorizeJudgeProject, getJudgeProject);
router.get('/projects/:id/health', ...authorizeJudgeProject, getJudgeProjectHealthHandler);
router.get('/projects/:id/load-tests', ...authorizeJudgeProject, getJudgeProjectLoadTestsHandler);
router.get('/projects/:id/devices', ...authorizeJudgeProject, getJudgeProjectDevicesHandler);

export default router;
