// apps/backend/prisma-platform/seed-platform.ts
const { PrismaClient } = require('../src/platform/generated/platform-client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Initialisation du registre DONIKO sur Railway...');

  // On utilise l'URL de la base de données de production
  const dbUrl = process.env.DATABASE_URL;

  const doniko = await prisma.tenant.upsert({
    where: { code: 'DONIKO' },
    update: { databaseUrl: dbUrl }, // Mise à jour de l'URL au cas où
    create: {
      code: 'DONIKO',
      name: 'Doniko Transfert',
      databaseUrl: dbUrl,
      isActive: true,
    },
  });

  console.log(`✅ Registre prêt : ${doniko.name} (Code: ${doniko.code})`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur Seed Platform:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  //npx ts-node prisma-platform/seed-platform.ts