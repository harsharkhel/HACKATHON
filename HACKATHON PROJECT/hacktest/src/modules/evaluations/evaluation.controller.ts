import type { NextFunction, Request, Response } from 'express';
import { createCompatibilityResult, createEvaluation, createLoadTestResult, createPerformanceResult, listProjectEvaluations } from './evaluation.service';

export const createCompatibilityResultHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const result = await createCompatibilityResult(req.user.role, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createPerformanceResultHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const result = await createPerformanceResult(req.user.role, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createLoadTestResultHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const result = await createLoadTestResult(req.user.role, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createEvaluationHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const evaluation = await createEvaluation(req.user.userId, req.user.role, req.body);
    res.status(201).json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
};

export const listProjectEvaluationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evaluations = await listProjectEvaluations(String(req.params.projectId));
    res.status(200).json({ success: true, data: evaluations });
  } catch (error) {
    next(error);
  }
};
