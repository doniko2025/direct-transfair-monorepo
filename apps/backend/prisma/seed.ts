//apps/backend/prisma/seed.ts
// apps/backend/prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Enum simulés pour éviter l'import TS qui peut bugger dans le seed
const Role = { SUPER_ADMIN: 'SUPER_ADMIN', COMPANY_ADMIN: 'COMPANY_ADMIN', USER: 'USER' };
const SubscriptionType = { PURCHASE: 'PURCHASE' };
const SubscriptionStatus = { ACTIVE: 'ACTIVE' };

async function main() {
  console.log('🔥 NETTOYAGE COMPLET DE LA BASE DE DONNÉES...');

  // Suppression en cascade (ordre important pour éviter les erreurs de clés étrangères)
  try {
    await prisma.withdrawal.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.beneficiary.deleteMany();
    await prisma.user.deleteMany();
    await prisma.agency.deleteMany();

    // ✅ important (FK vers Client)
    if (prisma.commissionConfig) {
      await prisma.commissionConfig.deleteMany();
    }

    await prisma.client.deleteMany();

    // ✅ si tu utilises le module tenants/guard
    if (prisma.tenant) {
      await prisma.tenant.deleteMany();
    }

    await prisma.exchangeRate.deleteMany();
  } catch (e) {
    console.log('Note: Tables déjà vides ou erreur mineure de nettoyage.');
  }

  console.log('🌱 DÉBUT DU SEEDING...');

  // Nouveau mot de passe global
  const password = await bcrypt.hash('Lcd123456!', 10);

  // ✅ Tenant système (utile si ton x-tenant-id est vérifié via table tenants)
  if (prisma.tenant) {
    await prisma.tenant.create({
      data: {
        code: 'DONIKO',
        name: 'Tenant Doniko (Platform)',
        isActive: true,
      },
    });
    console.log('✅ TENANT DONIKO créé.');
  }

  // 1. CRÉATION DU CLIENT "PLATEFORME" (Support du Super Admin)
  const doniko = await prisma.client.create({
    data: {
      code: 'DONIKO',
      name: 'Doniko SAS',
      primaryColor: '#111827',
      subscriptionType: SubscriptionType.PURCHASE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      email: 'contact@doniko.com',
      phone: '+33600000000',
      address: 'Paris, France',
    },
  });

  // 2. CRÉATION DU SUPER ADMIN
  await prisma.user.create({
    data: {
      email: 'thiernodoniko@gmail.com',
      password,
      firstName: 'Thierno',
      lastName: 'Doniko',
      role: Role.SUPER_ADMIN,
      clientId: doniko.id,
      country: 'France',
      jobTitle: 'Super Administrateur',
    },
  });

  // 3. CRÉATION DE L'ADMIN SOCIÉTÉ
  await prisma.user.create({
    data: {
      email: 'jallowdoniko@gmail.com',
      password,
      firstName: 'Jallow',
      lastName: 'Doniko',
      role: Role.COMPANY_ADMIN,
      clientId: doniko.id,
      country: 'France',
      jobTitle: 'Admin Société',
    },
  });

  // 4. CRÉATION DU CLIENT (USER)
  await prisma.user.create({
    data: {
      email: 'donikojallow@gmail.com',
      password,
      firstName: 'Doniko',
      lastName: 'Jallow',
      role: Role.USER,
      clientId: doniko.id,
      country: 'France',
      jobTitle: 'Client',
    },
  });

  console.log('✅ UTILISATEURS CRÉÉS AVEC SUCCÈS');
  console.log('  👉 Super Admin   : thiernodoniko@gmail.com');
  console.log('  👉 Admin Société : jallowdoniko@gmail.com');
  console.log('  👉 Client (User) : donikojallow@gmail.com');
  console.log('  🔑 Mot de passe  : Lcd123456!');

  // 5. CONFIGURATION MINIMALE (Taux de change)
  await prisma.exchangeRate.upsert({
    where: { pair: 'EUR_XOF' },
    update: { rate: 655.95 },
    create: { pair: 'EUR_XOF', rate: 655.95 },
  });
  console.log('💱 Taux de change EUR/XOF initialisé.');

  console.log('🚀 SEEDING TERMINÉ.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  //npx prisma db seed