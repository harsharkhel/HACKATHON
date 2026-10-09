import type { Request, Response } from 'express';
import {
  getJudgeProjectDevices,
  getJudgeProjectHealth,
  getJudgeProjectLoadTests,
  getJudgeProjectOverview,
} from '../modules/judges/judge.service';

const projectId = (req: Request): string => String(req.params.id);

export const getJudgeProject = async (req: Request, res: Response): Promise<void> => {
  const result = await getJudgeProjectOverview(projectId(req));
  res.setHeader('Cache-Control', 'no-store, private');
  res.status(200).json({ success: true, data: result });
};

export const getJudgeProjectHealthHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await getJudgeProjectHealth(projectId(req));
  res.setHeader('Cache-Control', 'no-store, private');
  res.status(200).json({ success: true, data: result });
};

export const getJudgeProjectLoadTestsHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await getJudgeProjectLoadTests(projectId(req));
  res.setHeader('Cache-Control', 'no-store, private');
  res.status(200).json({ success: true, data: result });
};

export const getJudgeProjectDevicesHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await getJudgeProjectDevices(projectId(req));
  res.setHeader('Cache-Control', 'no-store, private');
  res.status(200).json({ success: true, data: result });
};
