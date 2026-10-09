import type { Request, Response } from 'express';
import { getProjectAnalytics } from '../services/projectAnalytics.service';
import type { ProjectAnalyticsQuery } from '../validators/analytics.validators';
import { UnauthorizedError } from '../utils/errors';

export const getProjectAnalyticsHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED');

  const analytics = await getProjectAnalytics(
    String(req.params.id),
    req.query as unknown as ProjectAnalyticsQuery,
  );
  res.status(200).json({ success: true, data: analytics });
};
