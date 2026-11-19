-- Lot 17b — listes officielles (ONU, OFAC, UE) : base partagée + suivi des synchronisations.

ALTER TABLE "compliance_settings" ADD COLUMN IF NOT EXISTS "officialLists" TEXT[];

CREATE TABLE IF NOT EXISTS "official_list_entries" (
  "id"         TEXT NOT NULL,
  "provider"   TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "fullName"   TEXT NOT NULL,
  "aliases"    TEXT[],
  "country"    TEXT,
  "birthYear"  INTEGER,
  "reference"  TEXT,
  "programs"   TEXT[],
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "official_list_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "official_list_entries_provider_externalId_key" ON "official_list_entries"("provider", "externalId");
CREATE INDEX IF NOT EXISTS "official_list_entries_provider_isActive_idx" ON "official_list_entries"("provider", "isActive");

CREATE TABLE IF NOT EXISTS "official_list_syncs" (
  "provider"      TEXT NOT NULL,
  "sourceUrl"     TEXT,
  "lastRunAt"     TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'NEVER',
  "error"         TEXT,
  "entryCount"    INTEGER NOT NULL DEFAULT 0,
  "added"         INTEGER NOT NULL DEFAULT 0,
  "updated"       INTEGER NOT NULL DEFAULT 0,
  "removed"       INTEGER NOT NULL DEFAULT 0,
  "contentHash"   TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "official_list_syncs_pkey" PRIMARY KEY ("provider")
);
