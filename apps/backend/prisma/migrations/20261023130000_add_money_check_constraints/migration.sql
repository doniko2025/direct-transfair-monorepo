-- apps/backend/prisma/migrations/20261023130000_add_money_check_constraints/migration.sql
-- ✅ v4.29 (audit point 10) — filet de sécurité en base : le code applicatif protège déjà ces règles, mais rien
-- n'interdisait au niveau PostgreSQL un solde négatif ou un montant ≤ 0 (bug futur, script manuel, requête SQL directe).
--
-- NOT VALID : la contrainte s'applique à toute NOUVELLE écriture, sans re-contrôler les lignes déjà présentes
-- (une ancienne ligne incohérente ne fait donc pas échouer le déploiement). Une fois les données vérifiées :
--   ALTER TABLE "wallets" VALIDATE CONSTRAINT "wallets_balance_non_negative";   (idem pour chaque contrainte)
-- Pour repérer d'éventuelles lignes fautives avant : SELECT id, balance FROM wallets WHERE balance < 0;

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_non_negative"          CHECK ("balance" >= 0)         NOT VALID,
  ADD CONSTRAINT "wallets_reserved_balance_non_negative" CHECK ("reservedBalance" >= 0) NOT VALID;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0) NOT VALID,
  ADD CONSTRAINT "transactions_fees_non_negative" CHECK ("fees" >= 0) NOT VALID,
  ADD CONSTRAINT "transactions_total_non_negative" CHECK ("total" >= 0) NOT VALID;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount" > 0) NOT VALID;
