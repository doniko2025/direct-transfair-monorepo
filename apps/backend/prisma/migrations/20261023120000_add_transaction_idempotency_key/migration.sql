-- apps/backend/prisma/migrations/20261023120000_add_transaction_idempotency_key/migration.sql
-- ✅ v4.29 (audit point 3) — idempotence des envois, dépôts, remises et recharges d'agence.
-- Migration additive : une colonne nullable + un index unique (senderId, idempotencyKey).
-- PostgreSQL ignore les lignes dont la clé est NULL dans un index unique : les anciennes transactions et les
-- opérations sans clé ne sont pas concernées.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_senderId_idempotencyKey_key" ON "transactions"("senderId", "idempotencyKey");
