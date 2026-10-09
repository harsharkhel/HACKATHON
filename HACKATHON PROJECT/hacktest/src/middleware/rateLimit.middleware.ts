/**
 * Rate Limiting Middleware
 * 
 * WHY: Without rate limiting, an attacker can:
 * 1. Brute-force passwords (try thousands of passwords per minute)
 * 2. DoS the server (send millions of requests to overwhelm it)
 * 3. Scrape data (enumerate all users, projects, etc.)
 * 
 * HOW IT WORKS:
 * express-rate-limit tracks requests per IP address. If an IP exceeds
 * the limit within the time window, it gets a 429 Too Many Requests response.
 * 
 * We create two limiters:
 * - generalLimiter: 100 requests per 15 minutes (for normal API usage)
 * - authLimiter: 20 requests per 15 minutes (stricter, for login/register)
 */

import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * General API rate limiter.
 * Applied to all routes via app.use().
 * 
 * Default: 100 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,     // Time window in milliseconds
  max: env.RATE_LIMIT_MAX_REQUESTS,        // Max requests per window per IP
  standardHeaders: true,                    // Return rate limit info in headers (RateLimit-*)
  legacyHeaders: false,                     // Disable X-RateLimit-* headers (deprecated)
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later',
    },
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 * Applied specifically to /auth routes.
 * 
 * 20 requests per 15 minutes — prevents brute-force attacks.
 * This is much stricter because login attempts are security-critical.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,                // 15 minutes
  max: 20,                                  // Only 20 auth attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts, please try again later',
    },
  },
});

export const healthCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Health-check limit reached; try again later' },
  },
});

export const qrSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many QR session requests; try again later' },
  },
});

export const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many preview requests; try again later' },
  },
});

export const loadTestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Load-test creation limit reached for this hour' },
  },
});
