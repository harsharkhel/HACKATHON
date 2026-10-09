import type { Request, Response } from 'express';
import { checkProjectHealth, listProjectHealthChecks } from '../services/healthCheck.service';

export const createProjectHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const result = await checkProjectHealth(String(req.params.id));
  res.status(201).json({ success: true, data: result });
};

export const getProjectHealthChecks = async (req: Request, res: Response): Promise<void> => {
  const results = await listProjectHealthChecks(String(req.params.id));
  res.status(200).json({ success: true, data: results });
};
