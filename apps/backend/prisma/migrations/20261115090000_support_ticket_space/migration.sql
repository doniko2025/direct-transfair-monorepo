-- Comptes séparés : chaque demande d'assistance appartient au compte « client » (défaut) ou « merchant ».
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "space" TEXT NOT NULL DEFAULT 'client';

-- Reprise de l'existant : un litige sur une opération du commerce (paiement encaissé, retrait, remboursement fait à un client) passe côté marchand.
UPDATE "support_tickets" st SET "space" = 'merchant'
FROM "transactions" t
WHERE st."transactionId" = t."id"
  AND ((t."type" = 'MERCHANT_PAYMENT' AND t."recipientId" = st."userId")
    OR (t."type" IN ('MERCHANT_PAYOUT', 'MERCHANT_REFUND') AND t."senderId" = st."userId"));

CREATE INDEX IF NOT EXISTS "support_tickets_userId_space_idx" ON "support_tickets"("userId", "space");
