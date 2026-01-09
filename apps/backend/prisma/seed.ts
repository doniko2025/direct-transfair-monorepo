//apps/backend/prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Définition manuelle des Enums
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
  SUSPENDED: 'SUSPENDED',
};

async function main() {
  console.log('🔥 DESTRUCTION DE LA BASE (Nettoyage)...');
  // On supprime dans l'ordre pour respecter les contraintes de clés étrangères
  await prisma.transaction.deleteMany().catch(() => {});
  await prisma.beneficiary.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});
  await prisma.client.deleteMany().catch(() => {});
  await prisma.exchangeRate.deleteMany().catch(() => {});
  
  console.log('🌱 DÉBUT DU SEEDING (4 COMPTES SÉPARÉS)...');

  const password = await bcrypt.hash('123456', 10);

  // ====================================================
  // 1. SUPER ADMIN (Le Dieu) - Chez "DONIKO"
  // ====================================================
  const doniko = await prisma.client.create({
    data: {
      code: 'DONIKO',
      name: 'Doniko SAS (Siège)',
      primaryColor: '#111827', // Noir
      subscriptionType: SubscriptionType.PURCHASE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'super@doniko.com', // LOGIN: super@doniko.com / 123456
      password,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      clientId: doniko.id,
      country: 'France',
    },
  });
  console.log('✅ COMPTE 1 : SUPER ADMIN (super@doniko.com / DONIKO)');


  // ====================================================
  // 2. ADMIN SOCIÉTÉ (Le Client SaaS) - Chez "FLASH TRANSFERT"
  // ====================================================
  const flash = await prisma.client.create({
    data: {
      code: 'FLASH2026',
      name: 'Flash Transfert',
      primaryColor: '#F59E0B', // Orange
      subscriptionType: SubscriptionType.RENTAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@flash.com', // LOGIN: admin@flash.com / 123456 (CODE: FLASH2026)
      password,
      firstName: 'Patron',
      lastName: 'Flash',
      role: Role.COMPANY_ADMIN,
      clientId: flash.id,
      country: 'Sénégal',
    },
  });
  console.log('✅ COMPTE 2 : ADMIN SOCIÉTÉ (admin@flash.com / FLASH2026)');


  // ====================================================
  // 3. AGENCE / GUICHETIER (L'Employé) - Chez "FLASH TRANSFERT"
  // ====================================================
  await prisma.user.create({
    data: {
      email: 'agent@flash.com', // LOGIN: agent@flash.com / 123456 (CODE: FLASH2026)
      password,
      firstName: 'Guichetier',
      lastName: 'Dakar',
      role: Role.AGENT,
      clientId: flash.id,
      country: 'Sénégal',
    },
  });
  console.log('✅ COMPTE 3 : AGENT GUICHET (agent@flash.com / FLASH2026)');


  // ====================================================
  // 4. CLIENT FINAL (Wallet) - Chez "FLASH TRANSFERT"
  // ====================================================
  await prisma.user.create({
    data: {
      email: 'client@flash.com', // LOGIN: client@flash.com / 123456 (CODE: FLASH2026)
      password,
      firstName: 'Mamadou',
      lastName: 'Client',
      role: Role.USER,
      clientId: flash.id,
      country: 'Sénégal',
    },
  });
  console.log('✅ COMPTE 4 : CLIENT WALLET (client@flash.com / FLASH2026)');


  // ====================================================
  // CONFIGURATION GLOBALE
  // ====================================================
  await prisma.exchangeRate.upsert({
    where: { pair: 'EUR_XOF' },
    update: { rate: 655.95 },
    create: { pair: 'EUR_XOF', rate: 655.95 },
  });
  console.log('💱 Taux de change initialisé.');

  console.log('🚀 SEEDING TERMINÉ ! Tu peux tester tes 4 comptes.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  //client@flash.com
  //agent@flash.com
  //admin@flash.com
  //super@doniko.com
  //super@doniko.com