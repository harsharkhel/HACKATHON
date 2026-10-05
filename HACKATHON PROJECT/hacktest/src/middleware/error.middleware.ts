/**
 * Global Error Handling Middleware
 * 
 * WHY: Without this, unhandled errors crash the server or return 
 * ugly HTML error pages. This middleware catches ALL errors thrown 
 * by any route handler and returns a consistent JSON response.
 * 
 * HOW IT WORKS:
 * Express treats any middleware with 4 parameters (err, req, res, next)
 * as an error handler. When any route does `throw new Error(...)` or
 * `next(error)`, Express skips all remaining middleware and jumps
 * straight to this error handler.
 * 
 * RESPONSE FORMAT:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "PROJECT_NOT_FOUND",
 *     "message": "Project not found"
 *   }
 * }
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { createModuleLogger } from '../utils/logger';
import { ZodError } from 'zod';

const log = createModuleLogger('error-handler');

// Express identifies error handlers by having exactly 4 parameters
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // ─── Case 1: Our custom AppError (expected, operational) ───
  if (err instanceof ValidationError) {
    // Validation errors include field-level details
    log.warn({ code: err.code, details: err.details, path: req.path }, err.message);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    // Log at warn level for client errors (4xx), error for server errors (5xx)
    if (err.statusCode >= 500) {
      log.error({ code: err.code, stack: err.stack, path: req.path }, err.message);
    } else {
      log.warn({ code: err.code, path: req.path }, err.message);
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // ─── Case 2: Zod validation error (from middleware) ───
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.issues.forEach((issue) => {
      const path = issue.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    });

    log.warn({ details, path: req.path }, 'Validation failed');
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    });
    return;
  }

  // ─── Case 3: Unexpected error (programming bug) ───
  // NEVER expose internal error details to the client in production
  log.error(
    { 
      err: err.message, 
      stack: err.stack, 
      path: req.path,
      method: req.method,
    }, 
    'Unhandled error'
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'An unexpected error occurred',
    },
  });
};

/**
 * 404 Not Found handler — catches requests to undefined routes.
 * Must be registered AFTER all routes but BEFORE the error handler.
 */
export const notFoundHandler = (
  req: Request, 
  res: Response
): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
};
