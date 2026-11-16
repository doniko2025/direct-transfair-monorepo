-- Lot 14 — paiement de factures (facturiers par société, paiements, factures enregistrées).

-- 1. Nouvelles valeurs d'énumération
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BILL_PAYMENT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BILL_REFUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLER_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLER_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILL_PAYMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILL_PAYMENT_PROCESS';

-- 2. Nouveaux types
DO $$ BEGIN
  CREATE TYPE "BillerStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BillPaymentStatus" AS ENUM ('SUBMITTED', 'PROCESSING', 'COMPLETED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Facturiers (catalogue de CHAQUE société)
CREATE TABLE IF NOT EXISTS "billers" (
  "id"                   TEXT NOT NULL,
  "clientId"             INTEGER NOT NULL,
  "name"                 TEXT NOT NULL,
  "category"             TEXT NOT NULL,
  "country"              TEXT,
  "currency"             "CurrencyCode" NOT NULL,
  "description"          TEXT,
  "status"               "BillerStatus" NOT NULL DEFAULT 'DRAFT',
  "connectorKey"         TEXT NOT NULL DEFAULT 'manual',
  "referenceLabel"       TEXT NOT NULL DEFAULT 'Numéro de référence',
  "referenceHint"        TEXT,
  "referencePattern"     TEXT,
  "fields"               JSONB,
  "amountMode"           TEXT NOT NULL DEFAULT 'FREE',
  "minAmount"            DECIMAL(18,4),
  "maxAmount"            DECIMAL(18,4),
  "feeFixed"             DECIMAL(18,4) NOT NULL DEFAULT 0,
  "feePct"               DECIMAL(7,4) NOT NULL DEFAULT 0,
  "partnershipStatus"    TEXT NOT NULL DEFAULT 'NONE',
  "settlementInfo"       TEXT,
  "settlementDelayHours" INTEGER NOT NULL DEFAULT 24,
  "internalNote"         TEXT,
  "sortOrder"            INTEGER NOT NULL DEFAULT 0,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billers_clientId_name_key"          ON "billers"("clientId", "name");
CREATE INDEX        IF NOT EXISTS "billers_clientId_status_category_idx" ON "billers"("clientId", "status", "category");
DO $$ BEGIN
  ALTER TABLE "billers" ADD CONSTRAINT "billers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Paiements de factures
CREATE TABLE IF NOT EXISTS "bill_payments" (
  "id"                  TEXT NOT NULL,
  "reference"           TEXT NOT NULL,
  "clientId"            INTEGER NOT NULL,
  "billerId"            TEXT NOT NULL,
  "payerId"             TEXT NOT NULL,
  "accountRef"          TEXT NOT NULL,
  "fields"              JSONB,
  "customerName"        TEXT,
  "amount"              DECIMAL(18,4) NOT NULL,
  "fee"                 DECIMAL(18,4) NOT NULL DEFAULT 0,
  "currency"            "CurrencyCode" NOT NULL,
  "walletCurrency"      "CurrencyCode" NOT NULL,
  "rate"                DECIMAL(18,8) NOT NULL DEFAULT 1,
  "amountCharged"       DECIMAL(18,4) NOT NULL,
  "feeCharged"          DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalCharged"        DECIMAL(18,4) NOT NULL,
  "status"              "BillPaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
  "failureReason"       TEXT,
  "connectorKey"        TEXT NOT NULL DEFAULT 'manual',
  "providerRef"         TEXT,
  "token"               TEXT,
  "receiptNote"         TEXT,
  "idempotencyKey"      TEXT,
  "transactionId"       TEXT,
  "refundTransactionId" TEXT,
  "processedById"       TEXT,
  "processedAt"         TIMESTAMP(3),
  "completedAt"         TIMESTAMP(3),
  "refundedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bill_payments_reference_key"                 ON "bill_payments"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "bill_payments_payerId_idempotencyKey_key"    ON "bill_payments"("payerId", "idempotencyKey");
CREATE INDEX        IF NOT EXISTS "bill_payments_clientId_status_createdAt_idx" ON "bill_payments"("clientId", "status", "createdAt");
CREATE INDEX        IF NOT EXISTS "bill_payments_payerId_createdAt_idx"         ON "bill_payments"("payerId", "createdAt");
CREATE INDEX        IF NOT EXISTS "bill_payments_billerId_status_idx"           ON "bill_payments"("billerId", "status");
DO $$ BEGIN
  ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_billerId_fkey" FOREIGN KEY ("billerId") REFERENCES "billers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Factures enregistrées par les clients
CREATE TABLE IF NOT EXISTS "saved_bills" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "billerId"     TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "accountRef"   TEXT NOT NULL,
  "fields"       JSONB,
  "customerName" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_bills_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_bills_userId_billerId_accountRef_key" ON "saved_bills"("userId", "billerId", "accountRef");
CREATE INDEX        IF NOT EXISTS "saved_bills_userId_createdAt_idx"            ON "saved_bills"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "saved_bills" ADD CONSTRAINT "saved_bills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "saved_bills" ADD CONSTRAINT "saved_bills_billerId_fkey" FOREIGN KEY ("billerId") REFERENCES "billers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
