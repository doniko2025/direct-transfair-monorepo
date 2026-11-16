-- =========================================================
-- verifier-tables-inutilisees.sql — LECTURE SEULE (aucune modification)
-- =========================================================
-- Compte les lignes des 12 tables Prisma que le code de l'application n'utilise jamais
-- (aucun prisma.<modèle>.find/create/update… dans apps/backend/src ; seules country_currencies
-- et loyalty_configs sont écrites par prisma/seed.ts, jamais relues par l'application).
--
-- À exécuter sur la base de PRODUCTION (psql, Neon, Render « psql », DBeaver…).
-- Aucune table n'est supprimée ici : une table vide et inutilisée peut être retirée plus tard
-- par une migration Prisma que VOUS décidez ; une table qui contient des lignes doit d'abord
-- être examinée (données saisies à la main, import ancien…).
-- =========================================================

SELECT 'country_currencies'    AS table_prisma, COUNT(*) AS lignes FROM country_currencies
UNION ALL SELECT 'login_history',         COUNT(*) FROM login_history
UNION ALL SELECT 'compliance_cases',      COUNT(*) FROM compliance_cases
UNION ALL SELECT 'loyalty_configs',       COUNT(*) FROM loyalty_configs
UNION ALL SELECT 'loyalty_transactions',  COUNT(*) FROM loyalty_transactions
UNION ALL SELECT 'comms_templates',       COUNT(*) FROM comms_templates
UNION ALL SELECT 'webhook_endpoints',     COUNT(*) FROM webhook_endpoints
UNION ALL SELECT 'webhook_deliveries',    COUNT(*) FROM webhook_deliveries
UNION ALL SELECT 'commission_tiers',      COUNT(*) FROM commission_tiers
UNION ALL SELECT 'promotions',            COUNT(*) FROM promotions
UNION ALL SELECT 'promotion_uses',        COUNT(*) FROM promotion_uses
UNION ALL SELECT 'api_keys',              COUNT(*) FROM api_keys
ORDER BY lignes DESC, table_prisma;

-- Lecture : lignes = 0 pour toutes → retrait possible sans perte de données (à faire via une migration Prisma
-- après avoir retiré les modèles de schema.prisma). Si une table contient des lignes, ne la retirez pas sans
-- avoir compris d'où elles viennent.
