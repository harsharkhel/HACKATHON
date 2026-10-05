/**
 * Environment Configuration
 * 
 * WHY: We validate ALL environment variables at startup using Zod.
 * If any required variable is missing or invalid, the server crashes
 * immediately with a clear error message — instead of failing mysteriously
 * at runtime when some module tries to use an undefined value.
 * 
 * HOW IT WORKS:
 * 1. dotenv loads the .env file into process.env
 * 2. Zod parses and validates every variable
 * 3. The validated `env` object is exported — all other files import from here
 * 4. No file should ever read process.env directly
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file FIRST, before validation
dotenv.config();

// Define the shape of our environment variables
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000), // coerce converts string "3000" → number 3000

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // n8n
  N8N_BASE_URL: z.string().url('N8N_BASE_URL must be a valid URL'),
  N8N_WEBHOOK_SECRET: z.string().min(16, 'N8N_WEBHOOK_SECRET must be at least 16 characters'),

  // Internal API
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 characters'),

  // Frontend
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),   // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

// Parse and validate — if this fails, the server won't start
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1); // Exit immediately — don't run with bad config
}

// Export the validated, typed environment object
export const env = parsed.data;

// TypeScript type for the environment (useful for other files)
export type Env = z.infer<typeof envSchema>;
