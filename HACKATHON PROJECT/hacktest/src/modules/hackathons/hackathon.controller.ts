import type { NextFunction, Request, Response } from 'express';
import { assignJudgeToHackathon, createHackathon, deleteHackathon, getHackathonById, joinHackathon, listHackathons, updateHackathon } from './hackathon.service';

export const getHackathons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hackathons = await listHackathons();
    res.status(200).json({ success: true, data: hackathons });
  } catch (error) {
    next(error);
  }
};

export const createHackathonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const hackathon = await createHackathon(req.user.userId, req.body);
    res.status(201).json({ success: true, data: hackathon });
  } catch (error) {
    next(error);
  }
};

export const getHackathon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hackathonId = String(req.params.id);
    const hackathon = await getHackathonById(hackathonId);
    res.status(200).json({ success: true, data: hackathon });
  } catch (error) {
    next(error);
  }
};

export const updateHackathonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const hackathonId = String(req.params.id);
    const hackathon = await updateHackathon(hackathonId, req.user.userId, req.body);
    res.status(200).json({ success: true, data: hackathon });
  } catch (error) {
    next(error);
  }
};

export const deleteHackathonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const hackathonId = String(req.params.id);
    const result = await deleteHackathon(hackathonId, req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const joinHackathonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const hackathonId = String(req.params.id);
    const result = await joinHackathon(hackathonId, req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const assignJudgeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }

    const hackathonId = String(req.params.id);
    const result = await assignJudgeToHackathon(hackathonId, req.user.userId, req.body.judgeId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
