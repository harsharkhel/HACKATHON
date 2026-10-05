/**
 * Redis Configuration (Stub for Phase 1)
 * 
 * WHY A STUB: Redis is needed for Phase 8 (BullMQ job queues).
 * We define the config file now so the project structure is established,
 * but the actual Redis connection will be implemented in Phase 8.
 * 
 * This file will eventually export:
 * - A Redis connection (ioredis)
 * - BullMQ queue instances
 */

import { env } from './env';

// Redis configuration — connection will be created in Phase 8
export const redisConfig = {
  url: env.REDIS_URL,
};

// Placeholder export so other files can import this without errors
export default redisConfig;
