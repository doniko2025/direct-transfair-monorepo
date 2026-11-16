-- renommer-migrations-prod.sql
-- À exécuter UNE SEULE FOIS sur la base PRINCIPALE (celle de DATABASE_URL), AVANT « prisma migrate deploy », si ces
-- migrations ont déjà été appliquées en production. Si elles ne l'ont pas été, le script est sans effet (0 ligne modifiée).
-- Le contenu des fichiers migration.sql n'a pas changé : seule l'étiquette (nom + horodatage) change, donc le checksum
-- enregistré par Prisma reste valable. La base « plateforme » (DATABASE_URL_PLATFORM) n'est pas concernée.
BEGIN;

UPDATE "_prisma_migrations" SET migration_name = '20261115100000_merchant_rccm'                 WHERE migration_name = '20261116090000_merchant_rccm';
UPDATE "_prisma_migrations" SET migration_name = '20261115110000_merchant_address_details'      WHERE migration_name = '20261117090000_merchant_address_details';
UPDATE "_prisma_migrations" SET migration_name = '20261115120000_transaction_commission_split'  WHERE migration_name = '20261118090000_transaction_commission_split';
UPDATE "_prisma_migrations" SET migration_name = '20261115130000_merchant_rccm_document'        WHERE migration_name = '20261119090000_merchant_rccm_document';
UPDATE "_prisma_migrations" SET migration_name = '20261115140000_exchange_rates_per_company'    WHERE migration_name = '20261120090000_exchange_rates_per_company';
UPDATE "_prisma_migrations" SET migration_name = '20261115150000_company_rccm_and_documents'    WHERE migration_name = '20261121090000_company_rccm_and_documents';

-- Contrôle : doit lister les nouveaux noms (ou rien si ces migrations n'étaient pas encore appliquées).
SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name >= '20261115090000' ORDER BY migration_name;

COMMIT;
