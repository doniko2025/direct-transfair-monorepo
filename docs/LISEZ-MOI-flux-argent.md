# Flux d'argent — correctifs des 8 points (v4.34)

Fichiers livrés en entier, aux mêmes chemins que dans le dépôt : il suffit de dézipper à la racine du monorepo en écrasant.

## À faire au déploiement (dans cet ordre)

1. **Appliquer la migration** : `cd apps/backend && npx prisma migrate deploy`
   (nouvelle migration `20261118090000_transaction_commission_split` : une colonne facultative `commissionSplit`, idempotente).
2. `npx prisma generate` (le schéma a changé), puis redémarrer le backend.
3. **Vérifier que les taux de change sont à jour AVANT la mise en production** (voir point 3 ci-dessous).

## Ce qui change

| # | Sujet | Comportement |
|---|-------|--------------|
| 1 | Commission marchand rendue au remboursement | Nouveau réglage société *Remboursements et rappels › Rendre la commission au marchand*. **Désactivé par défaut** (comportement actuel). Activé : la commission est reprise à la société et rendue au marchand, qui n'a alors que le net à avoir. Si la caisse société est insuffisante ou gelée, le client est quand même remboursé et la commission reste acquise (journalisé). L'écran mobile du marchand affiche la bonne mention. |
| 2 | Rappel d'un envoi wallet → wallet déjà payé | Le service client peut demander le rappel (validation à deux personnes, comme avant). La somme est reprise au bénéficiaire **s'il l'a encore** (sinon refus 409 « hors plateforme », rien ne bouge), l'expéditeur est recrédité du montant (+ frais selon le réglage). Réglages : *Frais rendus au rappel* (défaut : oui) et *Délai de rappel* en jours (défaut : 30 ; **0 = rappel fermé**). Statut final `REFUNDED`. Un seul rappel possible, même en cas de double clic. |
| 3 | Âge maximal des taux | En **production**, sans variable, un taux de plus de **48 h** est refusé (503). `RATE_MAX_AGE_HOURS=<n>` pour changer, `0` pour désactiver. Hors production : aucun contrôle. |
| 4 | Commission figée à l'envoi | La répartition (agence payeuse / agence d'envoi / société) est enregistrée à l'envoi cash ; le paiement la relit au lieu d'utiliser les règles du jour. Les envois **déjà en cours** (sans snapshot) continuent d'utiliser les règles actuelles. |
| 5 | Remboursement sur le bon wallet | Le wallet recrédité est celui du DÉBIT réel (lu dans le journal des écritures). Repli sur l'ancienne règle quand aucune écriture n'existe (anciennes données). |
| 6 | Alerte taux de repli | La page *Barème d'envoi* affiche un bandeau quand des modes de retrait n'ont aucun tarif (ils sont alors facturés au taux de repli, 1,5 % d'usine). Un avertissement est aussi écrit dans les logs (1 fois / 6 h / société / mode). |
| 7 | Cash à rendre au client de passage | Annulation, échec, expiration ou remboursement d'un envoi encaissé au comptoir : le montant en espèces à remettre est inscrit au journal d'audit (`COUNTER_CASH_TO_RETURN`), renvoyé à l'agent à l'annulation (`cashToReturn`) et affiché dans l'application mobile. La notification d'expiration le précise. |
| 8 | Référence Sendwave | `SW_` + 12 caractères hexadécimaux tirés par `crypto` (au lieu de 6 chiffres via `Math.random`, colonne `@unique` : collisions possibles). |

## Réglages ajoutés (Réglages › Paramètres de la société › Remboursements et rappels)

| Réglage | Défaut |
|---------|--------|
| Rendre la commission au marchand quand il rembourse un client | Non |
| Rendre les frais quand un envoi payé est rappelé | Oui |
| Délai de rappel d'un envoi payé (jours, 0 = fermé) | 30 |

## Remarques

- Tests : 1063 réussis sur la suite backend complète ; 6 échecs préexistants dans des fichiers non modifiés (`portal-domains`, `payments.passe3`, `platform-sso`, `update-client.dto`), dus à des limites de l'environnement de test sans base Prisma. Le typage de `web-admin` et de l'application mobile passe sans erreur (le backend n'a pas pu être typé ici : `prisma generate` n'est pas accessible ; lancez `npm run build` côté backend après `prisma generate`).
- Le rappel ne couvre que les envois **wallet / Mobile Money déjà crédités sur un wallet**. Un envoi cash déjà retiré en agence reste hors plateforme.

## Idées pour la suite

- Rapprochement quotidien : somme des wallets = somme du journal des écritures, avec alerte si écart.
- Rapport « cash à rendre » pour les agences (liste des annulations de comptoir à solder).
- Mise à jour automatique des taux (le contrôle 48 h oblige à les rafraîchir régulièrement).
