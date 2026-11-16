-- Compte marchand : numéro RCCM (Registre du Commerce et du Crédit Mobilier), obligatoire à l'ouverture.
-- Nul pour les comptes existants (l'application leur demande de le renseigner) ; l'unicité est contrôlée par le service.
ALTER TABLE "merchant_profiles" ADD COLUMN IF NOT EXISTS "rccm" TEXT;
CREATE INDEX IF NOT EXISTS "merchant_profiles_rccm_idx" ON "merchant_profiles"("rccm");
