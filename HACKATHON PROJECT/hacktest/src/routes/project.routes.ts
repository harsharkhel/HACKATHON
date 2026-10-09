import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProjectOwner } from '../middleware/projectAuthorization.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import { healthCheckLimiter, qrSessionLimiter } from '../middleware/rateLimit.middleware';
import { createProjectHealthCheck, getProjectHealthChecks } from '../controllers/healthCheck.controller';
import { createQr, revokeQr } from '../controllers/qrSession.controller';
import { createLoadTestHandler, listLoadTestsHandler } from '../controllers/loadTest.controller';
import { loadTestLimiter } from '../middleware/rateLimit.middleware';
import {
  createProjectRequestSchema,
  projectIdRequestSchema,
  updateProjectRequestSchema,
} from '../validators/project.validators';
import { qrSessionIdRequestSchema, createQrRequestSchema } from '../validators/session.validators';
import { createLoadTestRequestSchema } from '../modules/load-tests/loadTest.schema';
import { getProjectAnalyticsHandler } from '../controllers/projectAnalytics.controller';
import { projectAnalyticsRequestSchema } from '../validators/analytics.validators';

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
  '/:id/analytics',
  requireAuth,
  validate(projectAnalyticsRequestSchema),
  requireProjectOwner,
  getProjectAnalyticsHandler,
);
router.get(
  '/:id/devices',
  requireAuth,
  validate(projectIdRequestSchema),
  requireProjectOwner,
  projectController.listDevices,
);
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
router.post(
  '/:id/health-check',
  requireAuth,
  healthCheckLimiter,
  validate(projectIdRequestSchema),
  requireProjectOwner,
  createProjectHealthCheck,
);
router.get(
  '/:id/health-checks',
  requireAuth,
  validate(projectIdRequestSchema),
  requireProjectOwner,
  getProjectHealthChecks,
);
router.post(
  '/:id/qr',
  requireAuth,
  qrSessionLimiter,
  validate(projectIdRequestSchema),
  validate(createQrRequestSchema),
  requireProjectOwner,
  createQr,
);
router.delete(
  '/:id/qr/:qrSessionId',
  requireAuth,
  qrSessionLimiter,
  validate(qrSessionIdRequestSchema),
  requireProjectOwner,
  revokeQr,
);
router.post(
  '/:id/load-tests',
  requireAuth,
  loadTestLimiter,
  validate(projectIdRequestSchema),
  validate(createLoadTestRequestSchema),
  createLoadTestHandler,
);
router.get(
  '/:id/load-tests',
  requireAuth,
  validate(projectIdRequestSchema),
  listLoadTestsHandler,
);

export default router;
