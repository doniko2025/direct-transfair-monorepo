-- Lot 16 — croissance : garantie de taux, demandes d'argent, parrainage.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFERRAL_CONFIG';

DO $$ BEGIN
  CREATE TYPE "MoneyRequestStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ReferralRewardStatus" AS ENUM ('AVAILABLE', 'USED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "rate_locks" (
  "id"             TEXT NOT NULL,
  "clientId"       INTEGER NOT NULL,
  "userId"         TEXT NOT NULL,
  "currency"       "CurrencyCode" NOT NULL,
  "targetCurrency" "CurrencyCode" NOT NULL,
  "amount"         DECIMAL(18,4) NOT NULL,
  "rate"           DOUBLE PRECISION NOT NULL,
  "receivedAmount" DECIMAL(18,4) NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "consumedAt"     TIMESTAMP(3),
  "transactionId"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_locks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rate_locks_userId_expiresAt_idx" ON "rate_locks"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "rate_locks_clientId_createdAt_idx" ON "rate_locks"("clientId", "createdAt");

CREATE TABLE IF NOT EXISTS "money_requests" (
  "id"                TEXT NOT NULL,
  "clientId"          INTEGER NOT NULL,
  "requesterId"       TEXT NOT NULL,
  "payerId"           TEXT NOT NULL,
  "amount"            DECIMAL(18,4) NOT NULL,
  "currency"          "CurrencyCode" NOT NULL,
  "note"              TEXT,
  "status"            "MoneyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt"         TIMESTAMP(3) NOT NULL,
  "respondedAt"       TIMESTAMP(3),
  "paidTransactionId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "money_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "money_requests_paidTransactionId_key" ON "money_requests"("paidTransactionId");
CREATE INDEX IF NOT EXISTS "money_requests_payerId_status_idx" ON "money_requests"("payerId", "status");
CREATE INDEX IF NOT EXISTS "money_requests_requesterId_status_idx" ON "money_requests"("requesterId", "status");
CREATE INDEX IF NOT EXISTS "money_requests_clientId_createdAt_idx" ON "money_requests"("clientId", "createdAt");

CREATE TABLE IF NOT EXISTS "referral_configs" (
  "id"                 TEXT NOT NULL,
  "clientId"           INTEGER NOT NULL,
  "isActive"           BOOLEAN NOT NULL DEFAULT false,
  "refereeWaivers"     INTEGER NOT NULL DEFAULT 1,
  "referrerWaivers"    INTEGER NOT NULL DEFAULT 1,
  "minFirstTransfer"   DECIMAL(18,4) NOT NULL DEFAULT 0,
  "rewardValidityDays" INTEGER NOT NULL DEFAULT 30,
  "maxRewardsPerMonth" INTEGER NOT NULL DEFAULT 10,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referral_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referral_configs_clientId_key" ON "referral_configs"("clientId");

CREATE TABLE IF NOT EXISTS "referral_rewards" (
  "id"            TEXT NOT NULL,
  "clientId"      INTEGER NOT NULL,
  "userId"        TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "sourceUserId"  TEXT NOT NULL,
  "status"        "ReferralRewardStatus" NOT NULL DEFAULT 'AVAILABLE',
  "remaining"     INTEGER NOT NULL DEFAULT 1,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "usedAt"        TIMESTAMP(3),
  "transactionId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referral_rewards_userId_kind_sourceUserId_key" ON "referral_rewards"("userId", "kind", "sourceUserId");
CREATE INDEX IF NOT EXISTS "referral_rewards_userId_status_idx" ON "referral_rewards"("userId", "status");
CREATE INDEX IF NOT EXISTS "referral_rewards_clientId_createdAt_idx" ON "referral_rewards"("clientId", "createdAt");
