-- ✅ v5.3 — (1) Transaction.agencyId : de quelle agence vient un mouvement de caisse
--          (2) fee_rules : barème de frais d'envoi de chaque société

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "agencyId" TEXT;

-- CreateTable
CREATE TABLE "fee_rules" (
    "id" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "label" TEXT,
    "payoutMethod" "PayoutMethod",
    "sendCountry" TEXT,
    "receiveCountry" TEXT,
    "currency" "CurrencyCode" NOT NULL,
    "minAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maxAmount" DECIMAL(18,4),
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_rules_clientId_isActive_idx" ON "fee_rules"("clientId", "isActive");

-- CreateIndex
CREATE INDEX "transactions_agencyId_createdAt_idx" ON "transactions"("agencyId", "createdAt");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────
-- Rattrapage des opérations déjà enregistrées
-- ─────────────────────────────────────────────────────────

-- Recharges de caisse : l'agence est encodée dans providerRef ("REFILL-123|AGENCY:<id>").
UPDATE "transactions" t
SET "agencyId" = substring(t."providerRef" from '\|AGENCY:(.+)$')
WHERE t."type" = 'AGENCY_REFILL'
  AND t."agencyId" IS NULL
  AND t."providerRef" LIKE '%|AGENCY:%'
  AND EXISTS (SELECT 1 FROM "agencies" a WHERE a."id" = substring(t."providerRef" from '\|AGENCY:(.+)$'));

-- Remontées de fonds et retraits forcés : la note se termine par "Agence : <nom>".
-- Rattaché seulement quand une seule agence de la société porte ce nom (sinon on ne devine pas).
UPDATE "transactions" t
SET "agencyId" = m."agencyId"
FROM (
  SELECT t2."id" AS "txId", MIN(a."id") AS "agencyId", COUNT(*) AS "n"
  FROM "transactions" t2
  JOIN "agencies" a
    ON a."clientId" = t2."clientId"
   AND right(t2."note", length('Agence : ' || a."name")) = 'Agence : ' || a."name"
  WHERE t2."type" IN ('AGENCY_REMITTANCE', 'AGENCY_COLLECTION')
    AND t2."agencyId" IS NULL
  GROUP BY t2."id"
) m
WHERE t."id" = m."txId" AND m."n" = 1;

-- Dépôts clients et envois faits par un agent : l'agence de l'agent. Pour les anciennes lignes on
-- ne connaît que son agence actuelle (un agent déplacé d'agence reporte donc ses anciennes opérations).
UPDATE "transactions" t
SET "agencyId" = u."agencyId"
FROM "users" u
WHERE t."senderId" = u."id"
  AND u."role" = 'AGENT'
  AND u."agencyId" IS NOT NULL
  AND t."agencyId" IS NULL
  AND t."type" IN ('DEPOSIT', 'TRANSFER');
