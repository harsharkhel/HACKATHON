import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { createCompatibilityResultHandler, createEvaluationHandler, createLoadTestResultHandler, createPerformanceResultHandler, listProjectEvaluationsHandler } from './evaluation.controller';
import { createCompatibilityResultSchema, createEvaluationSchema, createLoadTestResultSchema, createPerformanceResultSchema } from './evaluation.schema';

const router = Router();

router.post('/results/compatibility', requireAuth, requireRole('JUDGE', 'ORGANIZER'), validate(createCompatibilityResultSchema), createCompatibilityResultHandler);
router.post('/results/performance', requireAuth, requireRole('JUDGE', 'ORGANIZER'), validate(createPerformanceResultSchema), createPerformanceResultHandler);
router.post('/results/load', requireAuth, requireRole('JUDGE', 'ORGANIZER'), validate(createLoadTestResultSchema), createLoadTestResultHandler);
router.post('/', requireAuth, requireRole('JUDGE', 'ORGANIZER'), validate(createEvaluationSchema), createEvaluationHandler);
router.get('/projects/:projectId', requireAuth, listProjectEvaluationsHandler);

export default router;
