-- apps/backend/prisma/migrations/20261023150000_add_idempotency_records_and_ledger_restrict/migration.sql
-- ✅ v4.30 —
--  (1) idempotency_records : idempotence des opérations de trésorerie qui n'ont pas de ligne Transaction ;
--  (2) ledger_entries -> wallets : ON DELETE RESTRICT au lieu de CASCADE. Supprimer un wallet (donc, en cascade, un
--      utilisateur ou une agence) effaçait tout son journal comptable ; la base refuse désormais. Les suppressions
--      du code sont logiques (deletedAt / isActive) : rien ne change au fonctionnement normal.

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_userId_key_key" ON "idempotency_records"("userId", "key");
CREATE INDEX "idempotency_records_createdAt_idx" ON "idempotency_records"("createdAt");

-- AlterTable (clé étrangère du journal)
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_walletId_fkey";
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
