// apps/backend/prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Définition manuelle des Enums pour éviter les erreurs d'import
const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  AGENT: 'AGENT',
  USER: 'USER',
};

const SubscriptionType = {
  RENTAL: 'RENTAL',
  PURCHASE: 'PURCHASE',
};

const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
};

async function main() {
  console.log('🌱 Début du seeding SaaS (Mode robuste)...');

  // 1. Créer la Société Mère (DONIKO)
  const doniko = await prisma.client.upsert({
    where: { code: 'DONIKO' },
    update: {},
    create: {
      code: 'DONIKO',
      name: 'Doniko Transfert',
      primaryColor: '#F7931E',
      subscriptionType: SubscriptionType.PURCHASE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  });
  console.log('🏢 Société créée :', doniko.name);

  // 2. Créer le Super Admin
  const password = await bcrypt.hash('123456', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@doniko.com' },
    update: { 
        role: Role.SUPER_ADMIN,
        clientId: doniko.id 
    },
    create: {
      email: 'admin@doniko.com',
      password,
      firstName: 'Admin',
      lastName: 'Principal',
      role: Role.SUPER_ADMIN,
      clientId: doniko.id,
      nationality: 'France',
      country: 'France',
    },
  });
  console.log('👤 Super Admin créé :', admin.email);

  // 3. Taux de change par défaut
  await prisma.exchangeRate.upsert({
    where: { pair: 'EUR_XOF' },
    update: { rate: 655.95 },
    create: { pair: 'EUR_XOF', rate: 655.95 },
  });
  console.log('💱 Taux EUR_XOF initialisé (655.95)');

  console.log('✅ Seeding terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur durant le seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });