import type { Request, Response } from 'express';
import * as projectService from '../services/project.service';
import type { CreateProjectInput, UpdateProjectInput } from '../validators/project.validators';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { listProjectDeviceCompatibility } from '../services/deviceSession.service';

const authenticatedUserId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication is required', 'AUTH_REQUIRED');
  return req.user.userId;
};

const projectId = (req: Request): string => {
  const { id } = req.params;
  if (typeof id !== 'string') throw new BadRequestError('Invalid project id', 'INVALID_PROJECT_ID');
  return id;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.createProject(
    authenticatedUserId(req),
    req.body as CreateProjectInput,
  );
  res.status(201).json({ success: true, data: project });
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const projects = await projectService.listProjects(authenticatedUserId(req));
  res.status(200).json({ success: true, data: projects });
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.getProject(authenticatedUserId(req), projectId(req));
  res.status(200).json({ success: true, data: project });
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateProject(
    authenticatedUserId(req),
    projectId(req),
    req.body as UpdateProjectInput,
  );
  res.status(200).json({ success: true, data: project });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await projectService.deleteProject(authenticatedUserId(req), projectId(req));
  res.status(204).end();
};

export const listDevices = async (req: Request, res: Response): Promise<void> => {
  const devices = await listProjectDeviceCompatibility(projectId(req), authenticatedUserId(req));
  res.status(200).json({ success: true, data: devices });
};
