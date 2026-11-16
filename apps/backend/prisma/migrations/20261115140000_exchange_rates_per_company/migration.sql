-- Taux de change PAR SOCIÉTÉ : chaque société fixe ses propres taux, indépendamment des autres.

-- 1. Colonne société + contraintes
ALTER TABLE "exchange_rates" ADD COLUMN "clientId" INTEGER;

DROP INDEX IF EXISTS "exchange_rates_pair_key";

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "exchange_rates_clientId_pair_key" ON "exchange_rates"("clientId", "pair");
CREATE INDEX "exchange_rates_clientId_isActive_idx" ON "exchange_rates"("clientId", "isActive");

-- 2. Continuité de service : chaque société existante démarre avec une COPIE des taux actuels de la plateforme
--    (elle les modifie ensuite librement, sans effet sur les autres). Les lignes d'origine (clientId NULL) restent en place.
INSERT INTO "exchange_rates"
  ("id", "clientId", "pair", "rate", "inverseRate", "spread", "source", "validFrom", "validTo", "isActive",
   "previousRate", "changePercent", "providerMetadata", "version", "updatedAt", "updatedBy")
SELECT
  'xr' || c."id"::text || '_' || r."id", c."id", r."pair", r."rate", r."inverseRate", r."spread", r."source", r."validFrom", r."validTo", r."isActive",
  r."previousRate", r."changePercent", r."providerMetadata", r."version", r."updatedAt", r."updatedBy"
FROM "exchange_rates" r
CROSS JOIN "clients" c
WHERE r."clientId" IS NULL;
