import { z } from 'zod';

const issueItemSchema = z.object({
  type: z.string().min(1, 'Issue type is required'),
  message: z.string().min(1, 'Issue message is required'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
}).passthrough();

export const createCompatibilityResultSchema = z.object({
  body: z.object({
    testJobId: z.string().min(1, 'Test job id is required'),
    httpStatus: z.number().int().min(100).max(599).optional(),
    pageLoadTime: z.number().finite().optional(),
    consoleErrors: z.number().int().nonnegative().optional(),
    failedRequests: z.number().int().nonnegative().optional(),
    brokenLinks: z.number().int().nonnegative().optional(),
    horizontalOverflow: z.boolean().optional(),
    responsive: z.boolean().optional(),
    viewportResults: z.record(z.string(), z.any()).optional(),
    screenshots: z.array(z.string()).optional(),
    issues: z.array(issueItemSchema).optional(),
  }),
});

export const createPerformanceResultSchema = z.object({
  body: z.object({
    testJobId: z.string().min(1, 'Test job id is required'),
    avgResponseTime: z.number().finite().optional(),
    p95Latency: z.number().finite().optional(),
    p99Latency: z.number().finite().optional(),
    requestsPerSecond: z.number().finite().optional(),
    errorRate: z.number().finite().min(0).max(100).optional(),
    throughput: z.number().finite().optional(),
    availability: z.number().finite().min(0).max(100).optional(),
  }),
});

export const createLoadTestResultSchema = z.object({
  body: z.object({
    testJobId: z.string().min(1, 'Test job id is required'),
    virtualUsers: z.number().int().min(1).optional(),
    duration: z.number().int().min(1).optional(),
    requestsPerSecond: z.number().finite().optional(),
    avgLatency: z.number().finite().optional(),
    p95Latency: z.number().finite().optional(),
    p99Latency: z.number().finite().optional(),
    errorRate: z.number().finite().min(0).max(100).optional(),
    httpFailures: z.number().int().nonnegative().optional(),
    status: z.enum(['PASSED', 'DEGRADED', 'FAILED']).optional(),
  }),
});

export const createEvaluationSchema = z.object({
  body: z.object({
    projectId: z.string().min(1, 'Project id is required'),
    judgeId: z.string().min(1, 'Judge id is required'),
    innovationScore: z.number().int().min(0).max(10).optional(),
    technicalScore: z.number().int().min(0).max(10).optional(),
    uiuxScore: z.number().int().min(0).max(10).optional(),
    functionalityScore: z.number().int().min(0).max(10).optional(),
    performanceScore: z.number().int().min(0).max(10).optional(),
    scalabilityScore: z.number().int().min(0).max(10).optional(),
    problemSolvingScore: z.number().int().min(0).max(10).optional(),
    presentationScore: z.number().int().min(0).max(10).optional(),
    comments: z.string().trim().max(2000).optional(),
  }),
});
