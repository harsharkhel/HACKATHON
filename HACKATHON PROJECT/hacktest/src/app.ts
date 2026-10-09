import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import healthRoutes from './routes/health.routes';
import projectRoutes from './routes/project.routes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(generalLimiter);
app.use(requestLogger);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
