// apps/backend/prisma-platform/seed-platform.ts
const { PrismaClient } = require('../src/platform/generated/platform-client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Platform DB (Tenants Registry)...');

  // En local, on pointe sur la même DB. 
  // En prod, cela sera l'URL spécifique du client.
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/directtransfair?schema=public";

  const doniko = await prisma.tenant.upsert({
    where: { code: 'DONIKO' },
    update: {},
    create: {
      code: 'DONIKO',
      name: 'Doniko Transfert',
      databaseUrl: dbUrl,
      isActive: true,
    },
  });

  console.log(`✅ Tenant Platform created: ${doniko.name} (ID: ${doniko.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Platform Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });