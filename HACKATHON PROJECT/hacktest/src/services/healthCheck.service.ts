import http from 'node:http';
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { prisma } from '../config/database';
import { createModuleLogger } from '../utils/logger';
import { TooManyRequestsError, NotFoundError } from '../utils/errors';
import { isPrivateAddress, validateTargetUrl } from './urlSecurityService';

const log = createModuleLogger('project-health-check');
const REQUEST_TIMEOUT_MS = 7_000;
const DNS_TIMEOUT_MS = 1_500;
const MAX_REDIRECTS = 5;
const MAX_ATTEMPTS = 2;
const MAX_CONCURRENT_CHECKS = 10;
let activeChecks = 0;

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

interface HealthResult {
  healthy: boolean;
  statusCode: number | null;
  responseTime: number;
  dnsResolutionTime: number;
  tlsSuccess: boolean | null;
  redirectCount: number;
  finalUrl: string;
  errorReason: string | null;
  checkedAt: Date;
}

const resolveAddresses = async (hostname: string, timeoutMs: number): Promise<ResolvedAddress[]> => {
  const normalized = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  const family = isIP(normalized);

  if (family) {
    if (isPrivateAddress(normalized)) throw new Error('unsafe_target');
    return [{ address: normalized, family: family as 4 | 6 }];
  }

  const resolver = new Resolver();
  let timeout: NodeJS.Timeout | undefined;
  const resolving = Promise.all([
    resolver.resolve4(normalized).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') return [];
      throw error;
    }),
    resolver.resolve6(normalized).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') return [];
      throw error;
    }),
  ]);
  const addresses = await Promise.race([
    resolving,
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        resolver.cancel();
        reject(new Error('dns_timeout'));
      }, Math.max(1, timeoutMs));
    }),
  ]).catch((error: unknown) => {
    resolver.cancel();
    throw error;
  }).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
  const results: ResolvedAddress[] = [
    ...addresses[0].map((address) => ({ address, family: 4 as const })),
    ...addresses[1].map((address) => ({ address, family: 6 as const })),
  ];

  if (results.length === 0 || results.some(({ address }) => isPrivateAddress(address))) {
    throw new Error(results.length === 0 ? 'dns_failure' : 'unsafe_target');
  }

  return results;
};

interface ResponseInfo {
  statusCode: number;
  location: string | undefined;
  tlsSuccess: boolean | null;
}

const requestHeadersOnly = (
  target: URL,
  addresses: ResolvedAddress[],
  timeoutMs: number,
): Promise<ResponseInfo> => new Promise((resolve, reject) => {
  const transport = target.protocol === 'https:' ? https : http;
  let settled = false;
  const request = transport.request(target, {
    method: 'GET',
    agent: false,
    headers: {
      'user-agent': 'HackPreview-HealthCheck/1.0',
      accept: '*/*',
      range: 'bytes=0-0',
    },
    lookup: (_hostname, options, callback) => {
      const matchingAddresses = addresses.filter((item) => !options.family || item.family === options.family);
      if (matchingAddresses.length === 0) {
        callback(Object.assign(new Error('No validated address for target'), { code: 'ENOTFOUND' }), '', 0);
        return;
      }
      if (options.all) {
        callback(null, matchingAddresses);
        return;
      }
      const address = matchingAddresses[0];
      callback(null, address.address, address.family);
    },
  });
  const timeout = setTimeout(() => {
    request.destroy(new Error('request_timeout'));
  }, Math.max(1, timeoutMs));

  request.once('response', (response) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    const result: ResponseInfo = {
      statusCode: response.statusCode ?? 0,
      location: response.headers.location,
      tlsSuccess: target.protocol === 'https:' ? true : null,
    };
    response.destroy();
    request.destroy();
    resolve(result);
  });

  request.once('error', (error: Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    reject(error);
  });
  request.end();
});

const errorReasonFor = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message === 'dns_timeout' || error.message === 'request_timeout') return error.message;
    if (error.message === 'unsafe_target' || error.message === 'dns_failure') return error.message;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'INVALID_PROJECT_URL') return 'unsafe_target';
    if (code?.startsWith('CERT_') || code === 'ERR_TLS_CERT_ALTNAME_INVALID') return 'tls_failure';
    return 'connection_error';
  }
  return 'connection_error';
};

const runAttempt = async (initialUrl: string, deadline: number): Promise<Omit<HealthResult, 'responseTime' | 'checkedAt'>> => {
  let currentUrl = initialUrl;
  let statusCode: number | null = null;
  let dnsResolutionTime = 0;
  let tlsSuccess: boolean | null = null;
  let redirectCount = 0;

  try {
    for (;;) {
      const target = new URL(validateTargetUrl(currentUrl));
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new Error('request_timeout');

      const dnsStartedAt = Date.now();
      let addresses: ResolvedAddress[];
      try {
        addresses = await resolveAddresses(target.hostname, Math.min(DNS_TIMEOUT_MS, remainingMs));
      } finally {
        dnsResolutionTime += Date.now() - dnsStartedAt;
      }

      const response = await requestHeadersOnly(target, addresses, deadline - Date.now());
      statusCode = response.statusCode;
      tlsSuccess = response.tlsSuccess;

      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.location
      ) {
        if (redirectCount >= MAX_REDIRECTS) {
          return {
            healthy: false,
            statusCode,
            dnsResolutionTime,
            tlsSuccess,
            redirectCount,
            finalUrl: currentUrl,
            errorReason: 'redirect_limit_exceeded',
          };
        }

        currentUrl = validateTargetUrl(new URL(response.location, target).toString());
        redirectCount += 1;
        continue;
      }

      const healthy = response.statusCode >= 200 && response.statusCode < 400;
      return {
        healthy,
        statusCode,
        dnsResolutionTime,
        tlsSuccess,
        redirectCount,
        finalUrl: currentUrl,
        errorReason: healthy ? null : `http_status_${response.statusCode}`,
      };
    }
  } catch (error) {
    return {
      healthy: false,
      statusCode,
      dnsResolutionTime,
      tlsSuccess: errorReasonFor(error) === 'tls_failure' ? false : tlsSuccess,
      redirectCount,
      finalUrl: currentUrl,
      errorReason: errorReasonFor(error),
    };
  }
};

const retryable = (result: Omit<HealthResult, 'responseTime' | 'checkedAt'>): boolean =>
  result.statusCode !== null && result.statusCode >= 500 ||
  ['dns_timeout', 'dns_failure', 'request_timeout', 'connection_error', 'tls_failure'].includes(result.errorReason ?? '');

export const isHealthyStatus = (statusCode: number): boolean => statusCode >= 200 && statusCode < 400;

export const checkProjectHealth = async (projectId: string): Promise<HealthResult> => {
  if (activeChecks >= MAX_CONCURRENT_CHECKS) {
    throw new TooManyRequestsError('Health-check capacity is currently full; try again shortly');
  }
  activeChecks += 1;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectUrl: true },
    });
    if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');

    const checkedAt = new Date();
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    let result: Omit<HealthResult, 'responseTime' | 'checkedAt'> = {
      healthy: false,
      statusCode: null,
      dnsResolutionTime: 0,
      tlsSuccess: null,
      redirectCount: 0,
      finalUrl: project.projectUrl,
      errorReason: 'connection_error',
    };
    let dnsResolutionTime = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const attemptResult = await runAttempt(project.projectUrl, deadline);
      dnsResolutionTime += attemptResult.dnsResolutionTime;
      result = attemptResult;
      if (!retryable(attemptResult) || attempt === MAX_ATTEMPTS || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, Math.max(0, deadline - Date.now()))));
    }

    const healthResult: HealthResult = {
      ...result,
      responseTime: Date.now() - checkedAt.getTime(),
      dnsResolutionTime,
      checkedAt,
    };

    await prisma.healthCheck.create({
      data: {
        projectId,
        url: project.projectUrl,
        statusCode: healthResult.statusCode,
        responseTime: healthResult.responseTime,
        dnsResolutionTime: healthResult.dnsResolutionTime,
        tlsSuccess: healthResult.tlsSuccess,
        redirectCount: healthResult.redirectCount,
        finalUrl: healthResult.finalUrl,
        isHealthy: healthResult.healthy,
        errorReason: healthResult.errorReason,
        checkedAt: healthResult.checkedAt,
      },
    });

    const logFields = {
      projectId,
      healthy: healthResult.healthy,
      statusCode: healthResult.statusCode,
      responseTime: healthResult.responseTime,
      errorReason: healthResult.errorReason,
    };
    if (healthResult.healthy) log.info(logFields, 'Project health check completed');
    else log.warn(logFields, 'Project health check failed');

    return healthResult;
  } finally {
    activeChecks -= 1;
  }
};

export const listProjectHealthChecks = async (projectId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');

  const rows = await prisma.healthCheck.findMany({
    where: { projectId },
    orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: {
      id: true,
      statusCode: true,
      responseTime: true,
      dnsResolutionTime: true,
      tlsSuccess: true,
      redirectCount: true,
      finalUrl: true,
      isHealthy: true,
      errorReason: true,
      checkedAt: true,
    },
  });

  return rows.map(({ isHealthy, ...result }) => ({ ...result, healthy: isHealthy }));
};
