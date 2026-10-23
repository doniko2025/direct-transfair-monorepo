-- apps/backend/prisma/migrations/20261023140000_add_transaction_receive_country/migration.sql
-- ✅ v4.30 — pays de destination d'un envoi (un code de retrait ne se paie que dans ce pays) + index du balayage
-- quotidien des codes expirés. Migration additive : colonne nullable, aucune donnée existante modifiée.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "receiveCountry" TEXT;

-- CreateIndex
CREATE INDEX "transactions_status_pickupExpiry_idx" ON "transactions"("status", "pickupExpiry");
