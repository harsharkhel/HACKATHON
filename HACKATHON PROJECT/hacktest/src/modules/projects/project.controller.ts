import type { NextFunction, Request, Response } from 'express';
import { createProject, deleteProject, getProjectById, getProjectStatus, listProjectsForHackathon, updateProject } from './project.service';

export const createProjectHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const project = await createProject(req.user.userId, req.body);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await getProjectById(String(req.params.id));
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const updateProjectHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const project = await updateProject(String(req.params.id), req.user.userId, req.user.role, req.body);
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const deleteProjectHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const result = await deleteProject(String(req.params.id), req.user.userId, req.user.role);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProjectStatusHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getProjectStatus(String(req.params.id));
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

export const getProjectsByHackathon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await listProjectsForHackathon(String(req.params.hackathonId));
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
};
