# Lot 2 — Croissance (suivi public, taux garanti, demandes d'argent, parrainage)

Appliquez ce zip **après** le lot 1 (Pilotage) : les fichiers communs (`schema.prisma`, `app.module.ts`, `modules.tsx`, `navigation.ts`, `index.ts`, `api.ts`, `index.css`) contiennent les deux lots, il suffit de les écraser.

## Installation
1. Copiez les fichiers du zip dans le dépôt (mêmes chemins).
2. `cd apps/backend && npx prisma migrate deploy && npx prisma generate`
   (migration `20261119140000_growth` : 4 tables, 2 énumérations, 1 valeur d'audit — rejouable sans risque).
3. Redémarrez le backend. Reconstruisez le web-admin.
4. Variables facultatives : `RATE_LOCK_MINUTES` (durée du taux garanti, 2 à 30, défaut 5) · `RATE_LOCK_MARGIN_PCT` (marge retenue sur le taux garanti, 0 à 5 %, défaut 0,2) · `MONEY_REQUEST_DAYS` (validité d'une demande, 1 à 30, défaut 7).

## Ce qui change pour vos clients

### 1. Suivi public d'un envoi (déjà branché, rien à configurer)
La page publique de vérification d'un reçu (`/verify/transfer/:code`, lien du QR du reçu) affiche maintenant une **frise animée** :
Envoi enregistré → Validé → Disponible à retirer → Payé au bénéficiaire (4 étapes en cash, mobile et banque ; 2 pour un envoi portefeuille). Un envoi annulé, échoué ou expiré remplace l'étape concernée. La page se rafraîchit seule toutes les 60 s tant que l'envoi n'est pas terminé : l'expéditeur partage le lien, la famille suit.

### 2. Taux garanti
`POST /rate-locks { amount, currency, targetCurrency }` → `{ id, rate, receivedAmount, expiresAt, secondsLeft }`.
L'application affiche « Votre bénéficiaire recevra X — garanti 10 min », puis envoie l'envoi avec `rateLockId`. Si la garantie est valable (même client, même montant, mêmes devises, non expirée, non utilisée), **c'est le montant garanti qui est crédité** ; sinon l'envoi est refusé avec un message clair, **avant tout débit**. Une garantie ne sert qu'une fois, consommée dans la transaction de l'envoi. Maximum 5 garanties ouvertes par client ; la même demande renvoie la garantie existante.

### 3. Demandes d'argent
`POST /money-requests { payerPhone, amount, currency, note? }` · `GET /money-requests` · `PATCH /money-requests/:id/decline` (payeur) · `PATCH …/cancel` (demandeur).
Le payeur est notifié. Il règle en faisant un envoi normal vers le demandeur ; la demande passe **automatiquement à « réglée »** (rapprochement : envoi du payeur vers le demandeur, abouti, postérieur à la demande, montant reçu ≥ montant demandé, même société) et le demandeur est notifié. Les demandes expirent seules après 7 jours. 20 demandes en attente maximum par demandeur.
Le rapprochement se fait à la consultation de la liste (`GET /money-requests`) et couvre les envois vers un portefeuille (payés immédiatement).

### 4. Parrainage
- Inscription : `referralCode` facultatif dans le formulaire (un code inconnu ou d'une autre société est ignoré, l'inscription n'est jamais bloquée ; un compte n'a jamais deux parrains).
- Le **filleul** reçoit N envois sans frais à l'inscription ; le **parrain** en gagne quand son filleul fait son **premier envoi** (montant minimal réglable, une seule fois par filleul, plafond mensuel par parrain contre les abus).
- Un envoi offert annule les frais de cet envoi ; la récompense la plus proche de l'expiration est utilisée en premier. Pas d'envoi offert au comptoir ni pour les envois planifiés.
- Désactivé par défaut. L'administrateur de société l'active et le règle dans **Parrainage** (menu) : envois offerts, minimum, validité, plafond ; il voit filleuls, récompenses données/utilisées et le classement des meilleurs parrains. Chaque changement de réglage est tracé dans le journal d'audit (`REFERRAL_CONFIG`).
- Client : `GET /referrals/me` → code, nombre de filleuls, envois sans frais restants, prochaine expiration.

## Fichiers
- Backend : `src/growth/*` (règles pures, fonctions métier, service, contrôleur, module, 23 tests) · `transactions/transfer-tracking.ts` (+ test) · `transaction-receipts.service.ts`, `transfer-receipt.ts`, `transfer-check-page.ts` · `transactions.service.ts` (taux garanti, envoi sans frais, récompense du parrain — constructeur inchangé) · `create-transaction.dto.ts` (`rateLockId`) · `auth.service.ts` + `register.dto.ts` (`referralCode`) · `app.module.ts` · `prisma/schema.prisma` + migration.
- Partagé : `packages/shared/src/growth.ts` (types et `api.growth.*`).
- Web-admin : page `Parrainage`, `growth.css`, route `/parrainage`, entrée de menu.

## À savoir
- **Écrans mobiles non inclus** : compte à rebours du taux garanti sur l'écran d'envoi, écran « Demander de l'argent », champ « code de parrainage » à l'inscription, compteur d'envois offerts. L'API et le contrat partagé (`api.growth.*`) sont prêts ; je peux les écrire dans un lot 2b.
- Vérifié ici : 31 tests (règles, logique métier sur base simulée, frise), compilation `tsc` du partagé et du web-admin, build Vite. **Non vérifié** : migration et requêtes réelles (Prisma ne pouvait pas être généré dans mon environnement) — lancez `prisma generate`, puis `tsc` et vos tests backend ; envoyez-moi toute erreur et je corrige tout de suite.
