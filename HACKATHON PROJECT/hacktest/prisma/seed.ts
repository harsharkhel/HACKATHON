import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'demo@hackpreview.local' },
    update: {},
    create: {
      name: 'HackPreview Demo User',
      email: 'demo@hackpreview.local',
      passwordHash: 'seed-only-no-password',
      role: UserRole.PARTICIPANT,
    },
  });

  await prisma.project.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      userId: user.id,
      name: 'HackPreview Example Project',
      description: 'A sample project created by the local development seed.',
      projectUrl: 'https://example.com',
      repositoryUrl: 'https://github.com/example/hackpreview-demo',
      status: 'SUBMITTED',
    },
  });

  console.info('Seeded the HackPreview demo user and project.');
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
