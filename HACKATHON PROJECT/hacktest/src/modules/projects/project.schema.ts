import { z } from 'zod';

export const createProjectSchema = z.object({
  body: z.object({
    hackathonId: z.string().min(1, 'Hackathon id is required'),
    name: z.string().trim().min(2, 'Project name is required').max(120),
    description: z.string().trim().min(20, 'Description must be at least 20 characters').max(2000),
    githubUrl: z.string().url('GitHub URL must be valid').optional().or(z.literal('')),
    deploymentUrl: z.string().url('Deployment URL must be valid').optional().or(z.literal('')),
  }),
});

export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(20).max(2000).optional(),
    githubUrl: z.string().url().optional().or(z.literal('')),
    deploymentUrl: z.string().url().optional().or(z.literal('')),
    status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'TESTED', 'EVALUATED']).optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Project id is required'),
  }),
});
