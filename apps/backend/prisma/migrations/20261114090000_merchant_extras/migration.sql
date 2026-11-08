-- Lot 13 — compte marchand : remboursements, QR permanent, logo, clôture de caisse, caissiers, alertes.

-- 1. Nouvelles valeurs d'énumération
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'MERCHANT_REFUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_REFUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_STAFF';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_CLOSING';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MERCHANT_QR_ROTATE';

-- 2. Fiche du commerce : QR permanent et alertes
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "staticQrToken"        TEXT;
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "lowBalanceThreshold"  DECIMAL(18,4);
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "lowBalanceNotifiedAt" TIMESTAMP(3);
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "failureAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "failureAlertedAt"     TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_profiles_staticQrToken_key" ON "merchant_profiles"("staticQrToken");

-- 3. Demandes d'encaissement : caissier, QR permanent, échecs, remboursement
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "createdById"         TEXT;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "viaStaticQr"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "failedAttempts"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "refundedAt"          TIMESTAMP(3);
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "refundedById"        TEXT;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "refundReason"        TEXT;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "refundTransactionId" TEXT;
CREATE INDEX IF NOT EXISTS "payment_requests_payeeId_status_paidAt_idx" ON "payment_requests"("payeeId", "status", "paidAt");
CREATE INDEX IF NOT EXISTS "payment_requests_payeeId_refundedAt_idx"    ON "payment_requests"("payeeId", "refundedAt");
CREATE INDEX IF NOT EXISTS "payment_requests_createdById_createdAt_idx" ON "payment_requests"("createdById", "createdAt");

-- 4. Logo du commerce
CREATE TABLE IF NOT EXISTS "merchant_logos" (
  "merchantId" TEXT         NOT NULL,
  "mimeType"   TEXT         NOT NULL,
  "sizeBytes"  INTEGER      NOT NULL,
  "sha256"     TEXT         NOT NULL,
  "data"       BYTEA        NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "merchant_logos_pkey" PRIMARY KEY ("merchantId")
);
DO $$ BEGIN
  ALTER TABLE "merchant_logos" ADD CONSTRAINT "merchant_logos_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Caissiers
CREATE TABLE IF NOT EXISTS "merchant_staff" (
  "id"         TEXT          NOT NULL,
  "merchantId" TEXT          NOT NULL,
  "userId"     TEXT          NOT NULL,
  "active"     BOOLEAN       NOT NULL DEFAULT true,
  "canRefund"  BOOLEAN       NOT NULL DEFAULT false,
  "maxAmount"  DECIMAL(18,4),
  "addedById"  TEXT          NOT NULL,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "merchant_staff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_staff_merchantId_userId_key" ON "merchant_staff"("merchantId", "userId");
CREATE INDEX IF NOT EXISTS "merchant_staff_userId_active_idx" ON "merchant_staff"("userId", "active");
DO $$ BEGIN
  ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Clôtures de caisse
CREATE TABLE IF NOT EXISTS "merchant_closings" (
  "id"            TEXT           NOT NULL,
  "merchantId"    TEXT           NOT NULL,
  "day"           TEXT           NOT NULL,
  "tzOffsetMin"   INTEGER        NOT NULL DEFAULT 0,
  "currency"      "CurrencyCode" NOT NULL,
  "paymentsCount" INTEGER        NOT NULL,
  "gross"         DECIMAL(18,4)  NOT NULL,
  "fees"          DECIMAL(18,4)  NOT NULL,
  "net"           DECIMAL(18,4)  NOT NULL,
  "refundsCount"  INTEGER        NOT NULL DEFAULT 0,
  "refundsTotal"  DECIMAL(18,4)  NOT NULL DEFAULT 0,
  "details"       JSONB,
  "closedById"    TEXT           NOT NULL,
  "closedAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_closings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_closings_merchantId_day_currency_key" ON "merchant_closings"("merchantId", "day", "currency");
CREATE INDEX IF NOT EXISTS "merchant_closings_merchantId_day_idx" ON "merchant_closings"("merchantId", "day");
DO $$ BEGIN
  ALTER TABLE "merchant_closings" ADD CONSTRAINT "merchant_closings_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
