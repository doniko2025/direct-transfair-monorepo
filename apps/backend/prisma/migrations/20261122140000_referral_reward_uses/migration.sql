-- Audit argent (lot 18) — parrainage :
--   1. chaque envoi sans frais consommé est enregistré (referral_reward_uses) : un envoi annulé rend exactement SON envoi sans frais ;
--   2. la récompense du parrain garde l'envoi PAYÉ du filleul qui l'a déclenchée : si cet envoi est rappelé, la récompense est retirée.
ALTER TABLE "referral_rewards" ADD COLUMN IF NOT EXISTS "grantedByTransactionId" TEXT;
CREATE INDEX IF NOT EXISTS "referral_rewards_grantedByTransactionId_idx" ON "referral_rewards"("grantedByTransactionId");

CREATE TABLE IF NOT EXISTS "referral_reward_uses" (
  "id"            TEXT         NOT NULL,
  "rewardId"      TEXT         NOT NULL,
  "transactionId" TEXT         NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_reward_uses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referral_reward_uses_transactionId_key" ON "referral_reward_uses"("transactionId");
CREATE INDEX IF NOT EXISTS "referral_reward_uses_rewardId_idx" ON "referral_reward_uses"("rewardId");
DO $$ BEGIN
  ALTER TABLE "referral_reward_uses" ADD CONSTRAINT "referral_reward_uses_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "referral_rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reprise de l'existant : le dernier envoi connu de chaque récompense déjà utilisée.
INSERT INTO "referral_reward_uses" ("id", "rewardId", "transactionId")
SELECT 'rru_' || "id", "id", "transactionId" FROM "referral_rewards" WHERE "transactionId" IS NOT NULL
ON CONFLICT DO NOTHING;
