-- Lot 14b — factures récurrentes, rappels d'échéance, rapprochement des fichiers de facturiers.

-- 1. Nouvelles valeurs d'énumération
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILL_SCHEDULE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILL_RECONCILE';

-- 2. Nouveaux types
DO $$ BEGIN
  CREATE TYPE "BillScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BillScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Programmations récurrentes
CREATE TABLE IF NOT EXISTS "bill_schedules" (
  "id"             TEXT NOT NULL,
  "clientId"       INTEGER NOT NULL,
  "userId"         TEXT NOT NULL,
  "billerId"       TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "accountRef"     TEXT NOT NULL,
  "fields"         JSONB,
  "customerName"   TEXT,
  "amount"         DECIMAL(18,4),
  "walletCurrency" "CurrencyCode",
  "frequency"      "BillScheduleFrequency" NOT NULL DEFAULT 'MONTHLY',
  "anchorDay"      INTEGER NOT NULL DEFAULT 1,
  "mode"           TEXT NOT NULL DEFAULT 'REMIND',
  "status"         "BillScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "nextRunAt"      TIMESTAMP(3) NOT NULL,
  "endAt"          TIMESTAMP(3),
  "remindedFor"    TIMESTAMP(3),
  "retryAt"        TIMESTAMP(3),
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "lastError"      TEXT,
  "lastRunAt"      TIMESTAMP(3),
  "lastPaymentId"  TEXT,
  "runsCount"      INTEGER NOT NULL DEFAULT 0,
  "consentAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bill_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bill_schedules_status_nextRunAt_idx" ON "bill_schedules"("status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "bill_schedules_userId_status_idx" ON "bill_schedules"("userId", "status");
CREATE INDEX IF NOT EXISTS "bill_schedules_billerId_idx" ON "bill_schedules"("billerId");

DO $$ BEGIN
  ALTER TABLE "bill_schedules" ADD CONSTRAINT "bill_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bill_schedules" ADD CONSTRAINT "bill_schedules_billerId_fkey" FOREIGN KEY ("billerId") REFERENCES "billers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Lien paiement → programmation à l'origine
ALTER TABLE "bill_payments" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;
CREATE INDEX IF NOT EXISTS "bill_payments_scheduleId_idx" ON "bill_payments"("scheduleId");
