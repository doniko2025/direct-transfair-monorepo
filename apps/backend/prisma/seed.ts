//apps/backend/prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const Role = { SUPER_ADMIN: 'SUPER_ADMIN' };
const SubscriptionType = { PURCHASE: 'PURCHASE' };
const SubscriptionStatus = { ACTIVE: 'ACTIVE' };

async function main() {
  console.log('🔥 NETTOYAGE COMPLET DE LA BASE MÉTIER...');

  try {
    await prisma.withdrawal.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.beneficiary.deleteMany();
    await prisma.user.deleteMany();
    await prisma.agency.deleteMany();

    if (prisma.commissionConfig) {
      await prisma.commissionConfig.deleteMany();
    }

    await prisma.client.deleteMany();
    await prisma.exchangeRate.deleteMany();

  } catch (e) {
    console.log('Note: tables déjà vides ou nettoyage partiel.');
  }

  console.log('🌱 SEEDING MÉTIER...');

  const password = await bcrypt.hash('123456', 10);

  const doniko = await prisma.client.create({
    data: {
      code: 'DONIKO',
      name: 'Doniko SAS (Super Admin)',
      primaryColor: '#111827',
      subscriptionType: SubscriptionType.PURCHASE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      email: 'contact@doniko.com',
      phone: '+33600000000',
      address: 'Paris, France',
    },
  });

  await prisma.user.create({
    data: {
      email: 'super@doniko.com',
      password,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      clientId: doniko.id,
      country: 'France',
      jobTitle: 'Directeur Technique',
    },
  });

  await prisma.exchangeRate.upsert({
    where: { pair: 'EUR_XOF' },
    update: { rate: 655.95 },
    create: { pair: 'EUR_XOF', rate: 655.95 },
  });

  console.log('✅ Seed métier terminé.');
}

main()
  .catch((e: any) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


  //npx prisma db seed