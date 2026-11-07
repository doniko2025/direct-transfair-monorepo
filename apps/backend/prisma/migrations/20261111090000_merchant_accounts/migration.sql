-- Lot 11 — compte marchand : fiche du commerce, encaissements (téléphone / QR code), retraits (Orange Money / virement).

-- 1. Nouvelles valeurs d'énumération
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'MERCHANT_PAYMENT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'MERCHANT_PAYOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_DESTINATION_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_SUSPEND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_PAYMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_PAYOUT_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_PAYOUT_PROCESS';

-- 2. Types
DO $$ BEGIN CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'MERCHANT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentRequestMethod" AS ENUM ('PHONE', 'QR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED', 'EXPIRED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MerchantPayoutMethod" AS ENUM ('ORANGE_MONEY', 'BANK_TRANSFER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MerchantPayoutStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Type de compte
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'PERSONAL';

-- 4. Fiche du commerce
CREATE TABLE IF NOT EXISTS "merchant_profiles" (
  "id"                   TEXT           NOT NULL,
  "userId"               TEXT           NOT NULL,
  "clientId"             INTEGER        NOT NULL,
  "businessName"         TEXT           NOT NULL,
  "category"             TEXT,
  "address"              TEXT,
  "city"                 TEXT,
  "orangeMoneyPhone"     TEXT,
  "bankHolderName"       TEXT,
  "bankIban"             TEXT,
  "bankBic"              TEXT,
  "destinationChangedAt" TIMESTAMP(3),
  "status"               "MerchantStatus" NOT NULL DEFAULT 'ACTIVE',
  "suspendedReason"      TEXT,
  "suspendedAt"          TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_profiles_userId_key" ON "merchant_profiles"("userId");
CREATE INDEX IF NOT EXISTS "merchant_profiles_clientId_status_idx" ON "merchant_profiles"("clientId", "status");
DO $$ BEGIN
  ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Demandes d'encaissement
CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id"            TEXT                   NOT NULL,
  "reference"     TEXT                   NOT NULL,
  "clientId"      INTEGER                NOT NULL,
  "payeeId"       TEXT                   NOT NULL,
  "payerId"       TEXT,
  "payerPhone"    TEXT,
  "method"        "PaymentRequestMethod" NOT NULL,
  "status"        "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "amount"        DECIMAL(18,4)          NOT NULL,
  "fee"           DECIMAL(18,4)          NOT NULL DEFAULT 0,
  "netAmount"     DECIMAL(18,4)          NOT NULL,
  "currency"      "CurrencyCode"         NOT NULL,
  "note"          TEXT,
  "qrToken"       TEXT,
  "expiresAt"     TIMESTAMP(3)           NOT NULL,
  "paidAt"        TIMESTAMP(3),
  "declinedAt"    TIMESTAMP(3),
  "cancelledAt"   TIMESTAMP(3),
  "failureReason" TEXT,
  "transactionId" TEXT,
  "createdAt"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_reference_key" ON "payment_requests"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_qrToken_key" ON "payment_requests"("qrToken");
CREATE INDEX IF NOT EXISTS "payment_requests_payeeId_createdAt_idx" ON "payment_requests"("payeeId", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_requests_payerId_status_idx" ON "payment_requests"("payerId", "status");
CREATE INDEX IF NOT EXISTS "payment_requests_clientId_status_expiresAt_idx" ON "payment_requests"("clientId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "payment_requests_payerPhone_status_idx" ON "payment_requests"("payerPhone", "status");
DO $$ BEGIN
  ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Retraits des marchands
CREATE TABLE IF NOT EXISTS "merchant_payouts" (
  "id"               TEXT                   NOT NULL,
  "reference"        TEXT                   NOT NULL,
  "clientId"         INTEGER                NOT NULL,
  "userId"           TEXT                   NOT NULL,
  "method"           "MerchantPayoutMethod" NOT NULL,
  "status"           "MerchantPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "amount"           DECIMAL(18,4)          NOT NULL,
  "fee"              DECIMAL(18,4)          NOT NULL DEFAULT 0,
  "netAmount"        DECIMAL(18,4)          NOT NULL,
  "currency"         "CurrencyCode"         NOT NULL,
  "destination"      TEXT                   NOT NULL,
  "destinationLabel" TEXT,
  "transactionId"    TEXT,
  "providerRef"      TEXT,
  "processedById"    TEXT,
  "processedAt"      TIMESTAMP(3),
  "failureReason"    TEXT,
  "createdAt"        TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "merchant_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_payouts_reference_key" ON "merchant_payouts"("reference");
CREATE INDEX IF NOT EXISTS "merchant_payouts_userId_createdAt_idx" ON "merchant_payouts"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "merchant_payouts_clientId_status_createdAt_idx" ON "merchant_payouts"("clientId", "status", "createdAt");
DO $$ BEGIN
  ALTER TABLE "merchant_payouts" ADD CONSTRAINT "merchant_payouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
