# Lot « audit » n°2 — le reste des corrections (16 novembre)

À appliquer **après** le premier zip (certains fichiers, comme `main.ts` et `apps/backend/.env.example`, sont une 2ᵉ version du même fichier).

## Ordre d'application

1. Copier le contenu du zip à la racine du dépôt (fichiers complets, ils remplacent les anciens).
2. `bash supprimer-fichiers-audit-2.sh` — supprime `apps/backend/src/rates/rates.controller.ts`.
3. **Aucune variable à changer pour que tout fonctionne comme avant** : `PHONE_VERIFICATION_REQUIRED` vaut `false` par défaut.
4. Mobile : `verify-contact.tsx` et `login-v2.tsx` changent → nouvelle version OTA/EAS pour que les clients les reçoivent.
5. Facultatif : exécuter `verifier-tables-inutilisees.sql` (lecture seule) sur la base de production.

## Ce qui change

| Sujet | Changement |
|---|---|
| Vérification du téléphone | Le « DEV bypass » codé en dur à 4 endroits de `v2-auth.service.ts` est remplacé par **une règle unique** (`auth/verification-policy.ts`) pilotée par `PHONE_VERIFICATION_REQUIRED` (défaut `false` = comportement actuel : seul l'email est exigé). v1 (`auth.service.ts`) et `account-verified.guard.ts` suivent la même règle. Les réponses contiennent `phoneRequired`. |
| Mobile (SMS) | `verify-contact.tsx` v2.2 : l'étape SMS apparaît quand le serveur l'exige (dès l'ouverture depuis la connexion, ou juste après l'email) et envoie son code automatiquement. Avec le réglage par défaut, l'écran se comporte exactement comme avant. |
| Garde-fou | `main.ts` v2.10 : avertissement au démarrage si `PHONE_VERIFICATION_REQUIRED=true` sans Twilio complet. |
| Taux de change | Suppression de `POST /rates` (contrôleur) et `PATCH /exchange-rates/:pair` : aucun client ne les appelait ; `/rates-admin` (historique, audit, garde-fou) reste le seul point d'écriture. `updateExchangeRate` (jamais appelée) retirée de `services/api.ts`. `ExchangeRatesModule` est enfin importé dans `app.module.ts` v5.8. |
| Pays → devise | 5 copies divergentes (auth, users, clients, agences, transactions) → **une table** : `common/utils/country-currency-map.ts`. Corrige : clients/agences donnaient XOF pour CY, EE, LT, LV, MT, SI, SK ; transactions pour AT, FI, GR, IE, IT, LU, NL, GG, JE, IM, SV, PA, EC, etc. |
| `keep-alive.yml` | En-tête réécrit avec la réalité mesurée (GitHub ne le lance que 3-4 fois/jour) ; interrupteur `KEEP_ALIVE_ENABLED=false` (variable de dépôt). Horaire inchangé. |
| `LOGIN_OTP_REQUIRED` | Documenté dans `.env.example` : ne s'applique qu'à l'ancienne route `/auth/login` (v1), **pas** à `/auth/v2/login-password` (mobile login-v2 et portail web). |

## Vérifié

- Backend : `tsc --noEmit` = 0 erreur ; **100 suites / 1142 tests passent** (+7 tests de la règle de vérification, −15 tests des routes supprimées, +1 test « aucune route d'écriture »).
- Mobile : `tsc --noEmit` = 0 erreur. Package `shared` : `tsc` = 0 erreur.
- Non vérifié ici : le typage du portail web (dépendances non installées dans l'environnement) — il ne reçoit que deux champs optionnels dans `packages/shared`.

## Activer le SMS plus tard (quand tu le décides)

1. Render : renseigner `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` et vérifier qu'un SMS arrive réellement.
2. Puis `PHONE_VERIFICATION_REQUIRED=true`. Les comptes existants avec téléphone non vérifié devront confirmer leur numéro à la prochaine connexion.
3. Limite connue : un compte déjà connecté (jeton valide) n'est pas redemandé avant sa prochaine connexion.

## Reste à ta décision (non modifié volontairement)

- **Endpoints sans écran** : `/admin/withdrawals`, `/transactions/admin/all`, `/treasury/snapshot*`, `/admin/tenants*`, `/merchants/options` — à brancher à une page ou à retirer.
- **12 tables Prisma inutilisées** : lance `verifier-tables-inutilisees.sql` ; si tout est à 0, on pourra les retirer par une migration.
- **Auth v1 / v2** : deux systèmes de connexion cohabitent (le mobile utilise encore `api.login` v1 à un endroit). Les unifier est un chantier à part (ce qui rend `LOGIN_OTP_REQUIRED` incomplet).
- **Liste des pays du mobile** vs les 5 devises supportées (XOF, EUR, USD, GNF, GBP).
- **keep-alive** : mettre un ping externe (cron-job.org / UptimeRobot) sur `/api/health`.
