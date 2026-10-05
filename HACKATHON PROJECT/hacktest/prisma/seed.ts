import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@hacktest.dev' },
    update: {},
    create: {
      name: 'HackTest Organizer',
      email: 'organizer@hacktest.dev',
      passwordHash: 'demo-password-hash',
      role: 'ORGANIZER',
    },
  });

  const judge = await prisma.user.upsert({
    where: { email: 'judge@hacktest.dev' },
    update: {},
    create: {
      name: 'Demo Judge',
      email: 'judge@hacktest.dev',
      passwordHash: 'demo-password-hash',
      role: 'JUDGE',
    },
  });

  const participant = await prisma.user.upsert({
    where: { email: 'participant@hacktest.dev' },
    update: {},
    create: {
      name: 'Demo Participant',
      email: 'participant@hacktest.dev',
      passwordHash: 'demo-password-hash',
      role: 'PARTICIPANT',
    },
  });

  const hackathon = await prisma.hackathon.upsert({
    where: { id: 'demo-hackathon' },
    update: {},
    create: {
      id: 'demo-hackathon',
      name: 'HackTest Demo Hackathon',
      description: 'A sample hackathon used for local development and testing.',
      status: 'ACTIVE',
      organizerId: organizer.id,
    },
  });

  await prisma.hackathonParticipant.upsert({
    where: {
      userId_hackathonId: {
        userId: participant.id,
        hackathonId: hackathon.id,
      },
    },
    update: {},
    create: {
      userId: participant.id,
      hackathonId: hackathon.id,
    },
  });

  await prisma.hackathonJudge.upsert({
    where: {
      userId_hackathonId: {
        userId: judge.id,
        hackathonId: hackathon.id,
      },
    },
    update: {},
    create: {
      userId: judge.id,
      hackathonId: hackathon.id,
    },
  });

  console.log('Seeded HackTest demo data');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
