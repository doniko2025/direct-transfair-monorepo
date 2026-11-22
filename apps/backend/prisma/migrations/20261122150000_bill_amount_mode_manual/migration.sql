-- Un facturier « montant fourni par le facturier » (FROM_LOOKUP) n'a de sens qu'avec un connecteur qui sait interroger la facture.
-- Le connecteur « manual » n'en est pas capable : le client voyait « Montant dû — » sans pouvoir saisir de montant.

-- 1. Les factures programmées sans montant sur ces facturiers sont mises en pause (le client fixera le montant puis les relancera).
UPDATE "bill_schedules" SET "status" = 'PAUSED'
WHERE "status" = 'ACTIVE' AND "amount" IS NULL
  AND "billerId" IN (SELECT "id" FROM "billers" WHERE "amountMode" = 'FROM_LOOKUP' AND "connectorKey" = 'manual');

-- 2. Ces facturiers passent en montant libre : le client saisit lui-même le montant.
UPDATE "billers" SET "amountMode" = 'FREE' WHERE "amountMode" = 'FROM_LOOKUP' AND "connectorKey" = 'manual';
