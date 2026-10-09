import type { Request, Response } from 'express';
import {
  cancelLoadTest,
  createProjectLoadTest,
  getLoadTest,
  listProjectLoadTests,
} from '../modules/load-tests/loadTest.service';
import type { CreateLoadTestInput } from '../modules/load-tests/loadTest.schema';
import { UnauthorizedError } from '../utils/errors';

const authenticatedUser = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED');
  return req.user;
};

export const createLoadTestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = authenticatedUser(req);
  const result = await createProjectLoadTest(
    String(req.params.id),
    user.userId,
    user.role,
    req.body as CreateLoadTestInput,
  );
  res.status(202).json({ success: true, data: result });
};

export const listLoadTestsHandler = async (req: Request, res: Response): Promise<void> => {
  const user = authenticatedUser(req);
  const result = await listProjectLoadTests(String(req.params.id), user.userId, user.role);
  res.status(200).json({ success: true, data: result });
};

export const getLoadTestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = authenticatedUser(req);
  const result = await getLoadTest(String(req.params.id), user.userId, user.role);
  res.status(200).json({ success: true, data: result });
};

export const cancelLoadTestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = authenticatedUser(req);
  const result = await cancelLoadTest(String(req.params.id), user.userId, user.role);
  res.status(202).json({ success: true, data: result });
};
