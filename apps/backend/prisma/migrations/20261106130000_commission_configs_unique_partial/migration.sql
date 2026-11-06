-- commission_configs : une seule ligne par réglage.
--
-- La contrainte d'origine (clientId, sourceType, destType, currency) ne protège pas les lignes dont la devise est NULL
-- (en PostgreSQL deux NULL sont distincts) : deux enregistrements simultanés pouvaient créer deux lignes du même tarif ou de
-- la même répartition, et la lecture prenait l'une ou l'autre. Deux index uniques PARTIELS corrigent cela :
--   1. tarif d'un mode d'envoi  : une ligne par (société, mode)                         — payoutMethod renseigné
--   2. répartition des frais    : une ligne par (société, expéditeur, agence payeuse)   — payoutMethod et devise NULL
--
-- Les doublons existants sont d'abord sauvegardés dans commission_configs_dedup_backup, puis supprimés : on garde la ligne
-- modifiée en dernier (celle que lisait déjà le service de retrait).

CREATE TABLE IF NOT EXISTS "commission_configs_dedup_backup" (LIKE "commission_configs" INCLUDING DEFAULTS);
ALTER TABLE "commission_configs_dedup_backup" ADD COLUMN IF NOT EXISTS "backedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 1. tarifs par mode
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientId", "payoutMethod" ORDER BY "updatedAt" DESC, "id" DESC) AS rn
  FROM "commission_configs"
  WHERE "payoutMethod" IS NOT NULL
), doomed AS (SELECT "id" FROM ranked WHERE rn > 1)
INSERT INTO "commission_configs_dedup_backup" ("id","clientId","sourceType","destType","currency","payoutMethod","feeRate","fixedFee","senderShare","payerShare","platformShare","description","priority","isActive","updatedAt")
SELECT c."id",c."clientId",c."sourceType",c."destType",c."currency",c."payoutMethod",c."feeRate",c."fixedFee",c."senderShare",c."payerShare",c."platformShare",c."description",c."priority",c."isActive",c."updatedAt"
FROM "commission_configs" c JOIN doomed d ON d."id" = c."id";

DELETE FROM "commission_configs" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientId", "payoutMethod" ORDER BY "updatedAt" DESC, "id" DESC) AS rn
    FROM "commission_configs" WHERE "payoutMethod" IS NOT NULL
  ) r WHERE rn > 1
);

-- 2. répartitions
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientId", "sourceType", "destType" ORDER BY "updatedAt" DESC, "id" DESC) AS rn
  FROM "commission_configs"
  WHERE "payoutMethod" IS NULL AND "currency" IS NULL
), doomed AS (SELECT "id" FROM ranked WHERE rn > 1)
INSERT INTO "commission_configs_dedup_backup" ("id","clientId","sourceType","destType","currency","payoutMethod","feeRate","fixedFee","senderShare","payerShare","platformShare","description","priority","isActive","updatedAt")
SELECT c."id",c."clientId",c."sourceType",c."destType",c."currency",c."payoutMethod",c."feeRate",c."fixedFee",c."senderShare",c."payerShare",c."platformShare",c."description",c."priority",c."isActive",c."updatedAt"
FROM "commission_configs" c JOIN doomed d ON d."id" = c."id";

DELETE FROM "commission_configs" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientId", "sourceType", "destType" ORDER BY "updatedAt" DESC, "id" DESC) AS rn
    FROM "commission_configs" WHERE "payoutMethod" IS NULL AND "currency" IS NULL
  ) r WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_configs_fee_per_method_key"
  ON "commission_configs" ("clientId", "payoutMethod")
  WHERE "payoutMethod" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "commission_configs_split_per_pair_key"
  ON "commission_configs" ("clientId", "sourceType", "destType")
  WHERE "payoutMethod" IS NULL AND "currency" IS NULL;
