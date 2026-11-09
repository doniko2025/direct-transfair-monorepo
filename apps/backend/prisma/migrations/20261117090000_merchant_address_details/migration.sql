-- Compte marchand : coordonnées complètes du COMMERCE (distinctes de l'adresse personnelle du client, qui reste sur "users").
-- Toutes les colonnes sont facultatives : les comptes existants gardent leur fiche telle quelle (l'application leur demande de la compléter).
-- Idempotente : peut être rejouée sans effet.
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "district"      TEXT;
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "postalCode"    TEXT;
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "country"       TEXT;
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "businessPhone" TEXT;
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "taxId"         TEXT;
