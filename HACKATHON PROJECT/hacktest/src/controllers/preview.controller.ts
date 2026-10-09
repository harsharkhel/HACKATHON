import type { Request, Response } from 'express';
import { getProjectPreviewByToken } from '../services/qrSession.service';

export const getProjectPreview = async (req: Request, res: Response): Promise<void> => {
  const preview = await getProjectPreviewByToken(String(req.params.sessionToken));
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.status(200).json({ success: true, data: preview });
};
