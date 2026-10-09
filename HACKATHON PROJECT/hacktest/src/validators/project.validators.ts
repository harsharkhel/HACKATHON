import { z } from 'zod';
import { validateTargetUrl } from '../services/urlSecurityService';

const publicUrl = z.string().trim().transform((value, ctx) => {
  try {
    return validateTargetUrl(value);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'Must be a valid publicly reachable HTTP(S) URL allowed by server configuration',
    });
    return z.NEVER;
  }
});

const projectFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  projectUrl: publicUrl,
  repositoryUrl: publicUrl.nullable().optional(),
};

export const createProjectRequestSchema = z.object({
  body: z.object(projectFields).strict(),
});

export const updateProjectRequestSchema = z.object({
  body: z.object(projectFields).partial().strict().refine(
    (project) => Object.keys(project).length > 0,
    { message: 'At least one project field must be provided' },
  ),
});

export const projectIdRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateProjectInput = z.infer<typeof createProjectRequestSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectRequestSchema>['body'];
