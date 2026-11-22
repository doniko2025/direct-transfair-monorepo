-- Marge de change par société (gain sur le taux quand les frais d'envoi sont à 0).
-- 1. Société : marge réglée par son administrateur (0 par défaut = aucun changement de comportement pour les sociétés existantes).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "fxMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- 2. Transaction : marge appliquée à l'envoi, figée pour que le gain estimé (page Rentabilité) reste juste si la marge change plus tard.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fxMarginPct" DECIMAL(5,2);
