import { z } from 'zod';
import { projectIdRequestSchema } from './project.validators';

const analyticsQuery = z.object({
  startDate: z.iso.datetime({ offset: true }).optional(),
  endDate: z.iso.datetime({ offset: true }).optional(),
}).strict().refine(
  ({ startDate, endDate }) =>
    startDate === undefined || endDate === undefined || new Date(startDate) <= new Date(endDate),
  { message: 'startDate must be earlier than or equal to endDate' },
);

export const projectAnalyticsRequestSchema = z.object({
  params: projectIdRequestSchema.shape.params,
  query: analyticsQuery,
});

export type ProjectAnalyticsQuery = z.infer<typeof analyticsQuery>;
