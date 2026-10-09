import type { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../utils/logger';
import { sanitizeRequestPath } from '../utils/requestPath';

const log = createModuleLogger('http');

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = performance.now();

  res.once('finish', () => {
    log.info({
      method: req.method,
      path: sanitizeRequestPath(req.path),
      statusCode: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    }, 'HTTP request completed');
  });

  next();
};
