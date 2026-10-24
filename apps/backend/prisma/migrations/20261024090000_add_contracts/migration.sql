-- apps/backend/prisma/migrations/20261024090000_add_contracts/migration.sql
-- ✅ v4.31 — contrats de location / d'achat de l'application, avec signature électronique (table contracts).
--   Le contrat signé (PDF + piste d'audit) est conservé en base ; la clé étrangère vers clients est RESTRICT : un document
--   juridique ne disparaît pas avec la société.

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'SIGNED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "terms" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "signTokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signatureImage" TEXT,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "signedPdf" BYTEA,
    "signedPdfHash" TEXT,
    "signedMailedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_reference_key" ON "contracts"("reference");
CREATE UNIQUE INDEX "contracts_signTokenHash_key" ON "contracts"("signTokenHash");
CREATE INDEX "contracts_clientId_idx" ON "contracts"("clientId");
CREATE INDEX "contracts_status_createdAt_idx" ON "contracts"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
