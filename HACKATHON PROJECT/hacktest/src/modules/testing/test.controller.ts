import type { NextFunction, Request, Response } from 'express';
import { createTestJob, getTestJobById, listProjectTestJobs, updateTestJobStatus } from './test.service';

export const createTestJobHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const job = await createTestJob(req.user.userId, req.user.role, req.body);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

export const listProjectTestJobsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await listProjectTestJobs(String(req.params.projectId));
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
};

export const getTestJobHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await getTestJobById(String(req.params.id));
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

export const updateTestJobStatusHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const job = await updateTestJobStatus(req.user.role, String(req.params.id), req.body);
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};
