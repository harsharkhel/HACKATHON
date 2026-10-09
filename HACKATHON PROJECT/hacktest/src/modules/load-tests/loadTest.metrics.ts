export interface LoadTestObservation {
  latencyMs: number;
  statusCode: number | null;
  errorReason: string | null;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number | null;
  medianResponseTime: number | null;
  p95ResponseTime: number | null;
  p99ResponseTime: number | null;
  requestsPerSecond: number;
  errorRate: number;
  httpStatusDistribution: Record<string, number>;
  errorDistribution: Record<string, number>;
  durationMs: number;
}

const percentile = (sorted: number[], fraction: number): number | null => {
  if (sorted.length === 0) return null;
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.max(0, rank - 1)];
};

export const calculateLoadTestMetrics = (
  observations: LoadTestObservation[],
  durationMs: number,
): LoadTestMetrics => {
  const latencies = observations.map(({ latencyMs }) => latencyMs).sort((left, right) => left - right);
  const httpStatusDistribution: Record<string, number> = {};
  const errorDistribution: Record<string, number> = {};
  let successfulRequests = 0;

  for (const observation of observations) {
    if (observation.statusCode !== null) {
      const status = String(observation.statusCode);
      httpStatusDistribution[status] = (httpStatusDistribution[status] ?? 0) + 1;
      if (observation.statusCode >= 200 && observation.statusCode < 400) {
        successfulRequests += 1;
      } else {
        const reason = `http_${observation.statusCode}`;
        errorDistribution[reason] = (errorDistribution[reason] ?? 0) + 1;
      }
    } else {
      const reason = observation.errorReason ?? 'connection_error';
      errorDistribution[reason] = (errorDistribution[reason] ?? 0) + 1;
    }
  }

  const totalRequests = observations.length;
  const failedRequests = totalRequests - successfulRequests;
  const safeDurationMs = Math.max(1, durationMs);

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime: latencies.length
      ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
      : null,
    medianResponseTime: percentile(latencies, 0.5),
    p95ResponseTime: percentile(latencies, 0.95),
    p99ResponseTime: percentile(latencies, 0.99),
    requestsPerSecond: totalRequests / (safeDurationMs / 1_000),
    errorRate: totalRequests === 0 ? 0 : failedRequests / totalRequests,
    httpStatusDistribution,
    errorDistribution,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
};
