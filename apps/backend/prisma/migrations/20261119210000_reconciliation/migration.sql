-- Audit argent (I3) — réconciliation quotidienne des portefeuilles.

ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'RECONCILIATION_GAP';

CREATE TABLE IF NOT EXISTS "reconciliation_reports" (
  "id"              TEXT NOT NULL,
  "runDate"         DATE NOT NULL,
  "clientId"        INTEGER NOT NULL DEFAULT 0,
  "currency"        TEXT NOT NULL,
  "walletsCount"    INTEGER NOT NULL,
  "walletsBalance"  DECIMAL(20,4) NOT NULL,
  "ledgerNet"       DECIMAL(20,4) NOT NULL,
  "drift"           DECIMAL(20,4) NOT NULL,
  "driftWallets"    INTEGER NOT NULL DEFAULT 0,
  "negativeWallets" INTEGER NOT NULL DEFAULT 0,
  "reservedIssues"  INTEGER NOT NULL DEFAULT 0,
  "inTransitCount"  INTEGER NOT NULL DEFAULT 0,
  "inTransitAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'OK',
  "problems"        JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reconciliation_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "reconciliation_reports_runDate_clientId_currency_key" ON "reconciliation_reports"("runDate", "clientId", "currency");
CREATE INDEX IF NOT EXISTS "reconciliation_reports_clientId_runDate_idx" ON "reconciliation_reports"("clientId", "runDate");
CREATE INDEX IF NOT EXISTS "reconciliation_reports_status_runDate_idx" ON "reconciliation_reports"("status", "runDate");
