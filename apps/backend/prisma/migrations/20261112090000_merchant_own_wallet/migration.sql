-- Compte marchand : portefeuille PROPRE au commerce, séparé du portefeuille personnel du client.
-- Avant : l'encaissement créditait (et le retrait débitait) le portefeuille personnel (wallets.userId) : un client qui devenait
-- marchand retrouvait son solde de client sur son espace marchand. Désormais le commerce a ses propres portefeuilles
-- (wallets.merchantId, un par devise) et démarre à 0.
--
-- ⚠️ Les montants déjà encaissés AVANT cette migration restent sur le portefeuille personnel (impossible de les distinguer
-- de l'argent du client sans risque d'erreur). Pour un marchand existant, un administrateur peut les transférer à la main.

ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "merchantId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_merchantId_currency_key" ON "wallets"("merchantId", "currency");

DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
