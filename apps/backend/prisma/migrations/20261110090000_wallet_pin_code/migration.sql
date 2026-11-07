-- Lot 10 — code secret à 6 chiffres des clients du portefeuille mobile.
-- 1. Date du choix du code.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pinSetAt" TIMESTAMP(3);

-- 2. Les clients (rôle USER) qui ont encore un ancien mot de passe doivent choisir leur code à 6 chiffres à leur prochaine
--    connexion : le garde d'authentification (PASSWORD_CHANGE_REQUIRED) ferme tout le reste de l'API jusque-là, et l'application
--    affiche l'écran « Choisissez votre code secret ». Ne touche pas les comptes déjà passés au code à 6 chiffres.
UPDATE "users"
   SET "mustChangePassword" = true
 WHERE "role" = 'USER'
   AND "pinSetAt" IS NULL
   AND "mustChangePassword" = false;
