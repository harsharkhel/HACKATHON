import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import healthRoutes from './routes/health.routes';
import projectRoutes from './routes/project.routes';
import qrRoutes from './routes/qr.routes';
import sessionRoutes from './routes/session.routes';
import previewRoutes from './routes/preview.routes';
import loadTestRoutes from './routes/loadTest.routes';
import judgeRoutes from './routes/judge.routes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Project-Session-Id'],
  credentials: false,
  maxAge: 600,
}));
app.use(generalLimiter);
app.use(requestLogger);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/preview', previewRoutes);
app.use('/api/v1/load-tests', loadTestRoutes);
app.use('/api/v1/judge', judgeRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
