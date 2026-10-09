import { prisma } from '../config/database';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('database');

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  log.info('PostgreSQL connection established');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  log.info('PostgreSQL connection closed');
};
