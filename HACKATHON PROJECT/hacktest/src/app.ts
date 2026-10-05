/**
 * Express Application Setup
 * 
 * WHY THIS FILE EXISTS: This file creates and configures the Express app
 * separately from the HTTP server (server.ts). This separation is important
 * because:
 * 1. Tests can import the app WITHOUT starting a real HTTP server
 * 2. The app configuration is testable independently
 * 3. Server concerns (port, Socket.IO) are separate from app concerns (routes, middleware)
 * 
 * MIDDLEWARE ORDER MATTERS:
 * Middleware runs in the order it's registered. The order below is intentional:
 * 
 * 1. Helmet       → Set security headers FIRST (before any response)
 * 2. CORS         → Check origin BEFORE processing the request
 * 3. Rate Limiter → Block abusive IPs BEFORE parsing their request body
 * 4. Body Parser  → Parse JSON body
 * 5. Cookie Parser→ Parse cookies
 * 6. Routes       → Handle the request
 * 7. 404 Handler  → Catch unmatched routes
 * 8. Error Handler→ Catch all errors (MUST be last)
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { createModuleLogger } from './utils/logger';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import hackathonRoutes from './modules/hackathons/hackathon.routes';
import projectRoutes from './modules/projects/project.routes';
import qrRoutes from './modules/qr/qr.routes';
import testingRoutes from './modules/testing/test.routes';
import evaluationRoutes from './modules/evaluations/evaluation.routes';
import notificationRoutes from './modules/notifications/notification.routes';

const log = createModuleLogger('app');

// Create Express application
const app = express();

// ─── Security Middleware ───────────────────────────────────

// Helmet: Sets 15+ HTTP security headers automatically
// - X-Content-Type-Options: nosniff (prevents MIME sniffing)
// - X-Frame-Options: DENY (prevents clickjacking)
// - Strict-Transport-Security (forces HTTPS)
// - Content-Security-Policy, and more
app.use(helmet());

// CORS: Only allow requests from our frontend
// Without this, browsers block requests from different origins
app.use(cors({
  origin: env.FRONTEND_URL,       // Only allow our frontend
  credentials: true,               // Allow cookies to be sent
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting: Prevent abuse (100 requests per 15 minutes per IP)
app.use(generalLimiter);

// ─── Body Parsing ──────────────────────────────────────────

// Parse JSON request bodies (limit size to 10KB to prevent large payload attacks)
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Parse cookies (we'll use this for refresh tokens)
app.use(cookieParser());

// ─── Health Check ──────────────────────────────────────────
// A simple endpoint for monitoring tools (Docker, load balancers) to verify
// the server is running. No authentication required.
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
  });
});

// ─── API Routes ────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/hackathons', hackathonRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/testing', testingRoutes);
app.use('/api/v1/evaluations', evaluationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', qrRoutes);

// Temporary welcome route
app.get('/api/v1', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'HackTest API',
      version: '1.0.0',
      description: 'Submit. Scan. Test. Evaluate.',
    },
  });
});

// ─── Error Handling (MUST be after routes) ──────────────────

// Catch requests to undefined routes
app.use(notFoundHandler);

// Global error handler — catches all errors from all routes
app.use(errorHandler);

log.info('Express app configured successfully');

export default app;
