export const sanitizeRequestPath = (path: string): string =>
  path
    .replace(/(\/api\/v1\/qr\/)[a-f0-9]{64}(?=\/|$)/gi, '$1[REDACTED]')
    .replace(/(\/api\/v1\/sessions\/)[0-9a-f-]{36}(?=\/|$)/gi, '$1[REDACTED]');
