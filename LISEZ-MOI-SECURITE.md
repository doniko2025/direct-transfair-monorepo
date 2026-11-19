# Correctifs sécurité (audit du 19/11/2026)

Les fichiers du zip gardent leur chemin : copie-les à la racine du monorepo en acceptant d'écraser. Aucun commit n'a été fait.

## 1. Sessions révoquées au lieu d'être supprimées
Suspension / réinitialisation de mot de passe / désactivation d'agences et de sociétés faisaient `userSession.deleteMany`.
Le `JwtAuthGuard` accepte un jeton dont la ligne de session n'existe pas : le jeton d'accès (1 h) restait donc utilisable.
Désormais : `updateMany({ status: 'ACTIVE' } -> REVOKED)`, le jeton est refusé à la requête suivante.
Fichiers : support-staff.service.ts, support-desk.service.ts, agents-admin.service.ts, agencies.service.ts, clients.service.ts
+ 3 tests adaptés (agents-admin.reset.spec.ts, support-staff.service.spec.ts, support-access.spec.ts).

## 2. Limites de corps avant authentification (main.ts)
Les routes d'upload (3 à 18 Mo) lisaient le corps avant la vérification du jeton. La limite relevée ne s'applique plus qu'avec
un jeton à signature valide (un jeton expiré passe, pour que l'app reçoive 401 et se renouvelle). Sinon : 100 Ko.

## 3. CORS sûr par défaut (main.ts)
En production, si `CORS_ALLOWED_SUFFIXES` n'est pas défini, plus aucun suffixe n'est ouvert (avant : `.vercel.app`).
⚠️ À vérifier avant de déployer : si un portail est servi depuis une adresse `*.vercel.app`, ajoute cette adresse à `CORS_ORIGINS`
(ou mets `CORS_ALLOWED_SUFFIXES=.vercel.app` pour rouvrir). Les domaines dkmoney.store / personnalisés ne sont pas touchés.

## Non testé ici
Les moteurs Prisma ne se téléchargent pas dans mon environnement : tsc et jest n'ont pas pu tourner en entier.
Lance `pnpm --filter backend test` chez toi avant de déployer.
