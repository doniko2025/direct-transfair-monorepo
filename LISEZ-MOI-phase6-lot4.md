# Phase 6 — lot 4 (à appliquer après le lot 3)

Ce lot contient : tes 3 demandes (suppression avec solde, corps des mails/SMS, pays d'agence → devise) **et** la passe 3 du scanner (voir `RAPPORT-phase6-passe3.md`).

## 1. Suppression d'un utilisateur avec solde
- `users/users.service.ts` v4.8 : refus **409 `BALANCE_NOT_EMPTY`** tant qu'un wallet de l'utilisateur a un solde ou des fonds réservés ≠ 0 (contrôle dans la même transaction que la suppression). La réponse contient la liste `balances`.
- web-admin `UserDetailPage.tsx` : le bouton « Supprimer » est désactivé et le solde est affiché.
- Test : `users/users.delete.spec.ts`.
- Pas encore fait : la suppression d'une **agence** ou d'une **société** avec de l'argent affiche toujours seulement un avertissement.

## 2. Corps des mails et SMS non enregistrés
- `mail/mail.service.ts` v4.6, `sms/sms.service.ts` v4.1 : le journal garde destinataire, sujet, type et statut — plus le corps (OTP, mots de passe temporaires, codes de retrait). Sans Twilio, le SMS « stub » n'écrit plus le message dans les logs en production.
- **Migration à lancer** : `20261012210000_scrub_communication_bodies` efface les corps déjà enregistrés. `pnpm --filter backend prisma migrate deploy`.
- Les corps des notifications push ne sont pas touchés.

## 3. Une agence qui change de pays prend la devise locale
Vérification : **ce n'était pas fait.** Le changement de pays recalculait `primaryCurrency` (à partir des 2 premières lettres du pays : « Guinée » donnait XOF) mais ne créait pas la caisse, et l'écran disait que le pays ne pouvait pas changer.
- `agencies/agencies.service.ts` v4.9 : pays validé (400 si inconnu), code ISO enregistré, devise principale = devise du pays, **caisse (wallet) de cette devise créée ou réactivée et mise par défaut**. L'ancienne caisse reste active avec son solde (rien n'est déplacé).
- web-admin : champ « Pays » modifiable dans `AgencyDetailPage.tsx`, texte d'aide dans `AgencyCreatePage.tsx`; `packages/shared/src/agencies.ts` : `UpdateAgencyInput.country`.
- Test : `agencies/agencies.country.spec.ts`.
- Non fait : la devise personnelle des **agents** de l'agence n'est pas synchronisée ; le changement de pays d'un **utilisateur** ne crée toujours pas de wallet.

## 4. Passe 3 (corrections)
| Fichier | Changement |
|---|---|
| `payments/payments.service.ts` v1.1 | `/payments/initiate` fermé par défaut |
| `payments/simulation.flags.ts` (nouveau) | interrupteurs `ALLOW_SIMULATED_PAYMENTS`, `BLOCK_SIMULATED_RECHARGES` |
| `payments/recharge.service.ts` v1.3 | recharges fermables au lancement |
| `payments/payment-methods.service.ts` v1.1 | un numéro par opérateur, une carte par défaut, 10 cartes max |
| `payments/dto/*` | montants et longueurs bornés |
| `treasury/treasury.controller.ts` v5.5, `treasury.service.ts` v5.5, `dto/treasury.dto.ts` | snapshots réservés aux admins, audit, plafonds, snapshot global sans doublon |
| `rate-alerts/*` v4.1 | DTO, taux inverse, déclenchement unique, 20 alertes max |
| `limits/limits.controller.ts` v1.4 | 3 demandes/heure |
| `main.ts` v2.2 | trust proxy |

## Variables d'environnement (Railway)
| Variable | Effet | Par défaut |
|---|---|---|
| `BLOCK_SIMULATED_RECHARGES=true` | ferme les recharges simulées (à mettre au lancement) | ouvertes |
| `ALLOW_SIMULATED_PAYMENTS=true` | rouvre `/payments/initiate` (dev seulement) | fermé |
| `TRUST_PROXY_HOPS=<n>` | nombre de proxys devant l'API (0 = aucun) | 1 en production, 0 sinon |

## Vérifications
- Backend : 29 suites, 232 tests verts ; `tsc` sans erreur nouvelle (les 8 erreurs `platform`/`tenant` viennent du client Prisma plateforme non généré ici).
- web-admin et shared : `tsc` propre.
- **Non vérifié** : comportement des verrous sur un vrai PostgreSQL (tests avec simulation de la base), écrans web ouverts dans un navigateur. Après déploiement : `pnpm build` dans `apps/backend`, puis vérifier l'IP dans l'historique de connexion (point Q3).
