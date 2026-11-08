-- Comptes séparés : chaque notification appartient au compte « client » (défaut) ou au compte « merchant ».
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "space" TEXT NOT NULL DEFAULT 'client';

-- Reprise de l'existant : les messages du compte marchand (paiement reçu, retrait, activation…) ouvrent tous un écran /merchant/….
UPDATE "notifications" SET "space" = 'merchant'
WHERE "groupKey" = 'merchant' AND "actionUrl" ~ '^/merchant(/|$|\?)';

CREATE INDEX IF NOT EXISTS "notifications_userId_space_isRead_idx" ON "notifications"("userId", "space", "isRead");
