-- Lot 15 — pilotage : clôture de caisse, seuils de liquidité, objectifs des agents.

ALTER TYPE "AlertType"   ADD VALUE IF NOT EXISTS 'CASH_VARIANCE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CASH_CLOSING';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LIQUIDITY_RULE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AGENT_TARGET';

CREATE TABLE IF NOT EXISTS "cash_closings" (
  "id"             TEXT NOT NULL,
  "clientId"       INTEGER NOT NULL,
  "agencyId"       TEXT NOT NULL,
  "agentId"        TEXT NOT NULL,
  "day"            TEXT NOT NULL,
  "tzOffsetMin"    INTEGER NOT NULL DEFAULT 0,
  "currency"       "CurrencyCode" NOT NULL,
  "expectedAmount" DECIMAL(18,4) NOT NULL,
  "countedAmount"  DECIMAL(18,4) NOT NULL,
  "variance"       DECIMAL(18,4) NOT NULL,
  "opsCount"       INTEGER NOT NULL DEFAULT 0,
  "note"           TEXT,
  "details"        JSONB,
  "reviewedAt"     TIMESTAMP(3),
  "reviewedById"   TEXT,
  "reviewNote"     TEXT,
  "closedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_closings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cash_closings_agencyId_day_currency_key" ON "cash_closings"("agencyId", "day", "currency");
CREATE INDEX IF NOT EXISTS "cash_closings_clientId_day_idx" ON "cash_closings"("clientId", "day");
CREATE INDEX IF NOT EXISTS "cash_closings_clientId_reviewedAt_idx" ON "cash_closings"("clientId", "reviewedAt");

CREATE TABLE IF NOT EXISTS "liquidity_rules" (
  "id"          TEXT NOT NULL,
  "clientId"    INTEGER NOT NULL,
  "agencyId"    TEXT,
  "currency"    "CurrencyCode" NOT NULL,
  "minBalance"  DECIMAL(18,4) NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "lastAlertAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "liquidity_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "liquidity_rules_clientId_isActive_idx" ON "liquidity_rules"("clientId", "isActive");

CREATE TABLE IF NOT EXISTS "agent_targets" (
  "id"               TEXT NOT NULL,
  "clientId"         INTEGER NOT NULL,
  "agentId"          TEXT NOT NULL,
  "month"            TEXT NOT NULL,
  "currency"         "CurrencyCode" NOT NULL,
  "targetAmount"     DECIMAL(18,4) NOT NULL DEFAULT 0,
  "targetOperations" INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_targets_agentId_month_key" ON "agent_targets"("agentId", "month");
CREATE INDEX IF NOT EXISTS "agent_targets_clientId_month_idx" ON "agent_targets"("clientId", "month");
