-- Audit logique — virement MENSUEL : on conserve le jour d'origine (31 janvier → 28 février → 31 mars, et non 28 pour toujours).
ALTER TABLE "scheduled_transfers" ADD COLUMN IF NOT EXISTS "anchorDay" INTEGER;
