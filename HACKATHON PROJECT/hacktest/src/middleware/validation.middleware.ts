/**
 * Zod Validation Middleware
 * 
 * WHY: Every API endpoint receives user input (body, query params, URL params).
 * We NEVER trust that input. This middleware validates incoming data against
 * a Zod schema BEFORE the route handler runs.
 * 
 * HOW TO USE:
 * 
 *   import { validate } from '../middleware/validation.middleware';
 *   import { createProjectSchema } from './project.schema';
 *   
 *   router.post('/', validate(createProjectSchema), projectController.create);
 *   
 * If validation fails, the request never reaches the controller — the middleware
 * immediately returns a 422 error with field-level details.
 * 
 * WHAT IT VALIDATES:
 * - req.body   → request payload
 * - req.query  → URL query parameters (e.g., ?page=1&limit=10)
 * - req.params → URL path parameters (e.g., /projects/:id)
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Creates a middleware that validates request data against a Zod schema.
 * 
 * @param schema - A Zod object schema with optional body, query, params keys
 * @returns Express middleware function
 * 
 * @example
 * const schema = z.object({
 *   body: z.object({
 *     name: z.string().min(1),
 *     email: z.string().email(),
 *   }),
 *   params: z.object({
 *     id: z.string().uuid(),
 *   }),
 * });
 */
export const validate = (schema: z.ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse all three sources of input at once
      // Zod will strip any extra fields that aren't in the schema (security!)
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Validation passed — continue to the next middleware/handler
      next();
    } catch (error) {
      // Validation failed — pass the ZodError to the error handler
      if (error instanceof ZodError) {
        next(error); // Our error.middleware.ts knows how to format ZodErrors
      } else {
        next(error); // Unknown error — let the error handler deal with it
      }
    }
  };
};
