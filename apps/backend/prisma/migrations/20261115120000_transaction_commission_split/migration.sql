-- Envoi cash : la répartition des frais (agence payeuse / agence d'envoi / société) est figée à l'ENVOI.
-- Un code reste payable jusqu'à 5 mois ; sans cette colonne, une modification des règles entre l'envoi et le paiement
-- changeait la répartition d'un envoi déjà facturé. Colonne facultative : les envois existants gardent le comportement actuel.
-- Idempotente : peut être rejouée sans effet.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "commissionSplit" JSONB;
