-- Lot 17 — conformité (listes de surveillance, réglages AML, dossiers enrichis) et webhooks sortants fiabilisés.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WATCHLIST_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMPLIANCE_CASE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMPLIANCE_SETTINGS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WEBHOOK_CHANGE';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'SANCTION_MATCH';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'AML_RULE';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'WEBHOOK_FAILING';

DO $$ BEGIN
  CREATE TYPE "WatchlistKind" AS ENUM ('SANCTION', 'PEP', 'INTERNAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dossiers de conformité enrichis
ALTER TABLE "compliance_cases" ADD COLUMN IF NOT EXISTS "kind"      TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "compliance_cases" ADD COLUMN IF NOT EXISTS "severity"  "AlertSeverity" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "compliance_cases" ADD COLUMN IF NOT EXISTS "details"   JSONB;
ALTER TABLE "compliance_cases" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_cases_dedupeKey_key" ON "compliance_cases"("dedupeKey");

-- Webhooks sortants
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "description"         TEXT;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "disabledAt"          TIMESTAMP(3);
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "disabledReason"      TEXT;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "scanCursor"          TIMESTAMP(3);

ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "eventKey"   TEXT;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "replayOf"   TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_deliveries_endpointId_eventKey_key" ON "webhook_deliveries"("endpointId", "eventKey");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_nextRetryAt_idx" ON "webhook_deliveries"("status", "nextRetryAt");

-- Listes de surveillance
CREATE TABLE IF NOT EXISTS "watchlist_entries" (
  "id"        TEXT NOT NULL,
  "clientId"  INTEGER NOT NULL,
  "kind"      "WatchlistKind" NOT NULL DEFAULT 'SANCTION',
  "fullName"  TEXT NOT NULL,
  "aliases"   TEXT[],
  "country"   TEXT,
  "birthYear" INTEGER,
  "reference" TEXT,
  "notes"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "watchlist_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "watchlist_entries_clientId_isActive_idx" ON "watchlist_entries"("clientId", "isActive");

-- Réglages de conformité par société
CREATE TABLE IF NOT EXISTS "compliance_settings" (
  "id"                   TEXT NOT NULL,
  "clientId"             INTEGER NOT NULL,
  "sanctionsEnabled"     BOOLEAN NOT NULL DEFAULT true,
  "matchThreshold"       INTEGER NOT NULL DEFAULT 88,
  "strongMatchThreshold" INTEGER NOT NULL DEFAULT 96,
  "holdOnStrongMatch"    BOOLEAN NOT NULL DEFAULT false,
  "amlThresholdXof"      DOUBLE PRECISION,
  "amlFlagScore"         INTEGER,
  "highRiskCountries"    TEXT[],
  "structuringCount"     INTEGER NOT NULL DEFAULT 3,
  "fanInSenders"         INTEGER NOT NULL DEFAULT 3,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compliance_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_settings_clientId_key" ON "compliance_settings"("clientId");
