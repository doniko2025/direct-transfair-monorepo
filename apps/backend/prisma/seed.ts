// apps/backend/prisma/seed.ts
/* eslint-disable @typescript-eslint/no-var-requires */

// CommonJS strict — compatible Prisma + NestJS
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(plain: string): Promise<string> {
  try {
    const bcrypt = require("bcrypt");
    return bcrypt.hash(plain, 10);
  } catch {
    const bcryptjs = require("bcryptjs");
    return bcryptjs.hash(plain, 10);
  }
}

async function main() {
  const tenantCode = "DONIKO";
  const tenantName = "DONIKO";

  // 1) Client / Tenant
  const client = await prisma.client.upsert({
    where: { code: tenantCode },
    update: { name: tenantName },
    create: { code: tenantCode, name: tenantName },
  });

  // 2) Comptes
  const adminEmail = "admin@doniko.local";
  const userEmail = "user@doniko.local";

  const adminHash = await hashPassword("Admin2025!");
  const userHash = await hashPassword("User2025!");

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "ADMIN",
      clientId: client.id,
      firstName: "Admin",
      lastName: "DONIKO",
      password: adminHash,
    },
    create: {
      email: adminEmail,
      password: adminHash,
      role: "ADMIN",
      clientId: client.id,
      firstName: "Admin",
      lastName: "DONIKO",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      role: "USER",
      clientId: client.id,
      firstName: "User",
      lastName: "DONIKO",
      password: userHash,
    },
    create: {
      email: userEmail,
      password: userHash,
      role: "USER",
      clientId: client.id,
      firstName: "User",
      lastName: "DONIKO",
    },
  });

  console.log("✅ Seed OK");
  console.table({
    tenant: client.code,
    admin: admin.email,
    user: user.email,
  });
}

main()
  .catch((e: unknown) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
//npx prisma db seed
