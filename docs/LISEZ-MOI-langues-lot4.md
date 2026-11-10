# Langues FR / EN / PT — Lot 4 : transactions, reçus, bénéficiaires, virement wallet

## Ce qui est traduit
- **Transactions** : liste (filtres, compteurs), détail (statuts, annulation retrait), reçu client (écran + PDF).
- **Reçu de transfert** : carte, écran `receipt/[id]`, PDF et partage.
- **Bénéficiaires** : liste, création (import contacts inclus), détail / modification / suppression.
- **Virement wallet** : confirmation, messages de succès / erreur, récapitulatif, sélecteur d'indicatif.
- Dates, heures et montants suivent la langue choisie (plus aucun `fr-FR` en dur dans ces écrans).

## Backend (à déployer avec l'app)
Le reçu est construit côté serveur (titre, statut, libellé de paiement). L'endpoint de reçu le traduit désormais
selon l'en-tête `x-app-lang` envoyé par le mobile.
- Nouveau : `src/i18n/phrases/receipt.ts` (+ import dans `phrases/index.ts`)
- Modifiés : `src/transactions/transfer-receipt.ts`, `src/transactions/transaction-receipts.controller.ts`, `src/i18n/i18n.spec.ts`
- Tests : 36 verts (i18n + reçu).
- Sans ce déploiement, le reçu reste en français côté en-têtes/statuts ; le reste de l'app est traduit.

## Noms de pays
Nouveau `utils/countryNames.ts` : noms de pays traduits via `Intl.DisplayNames` (pt → pt-PT), avec repli sur le français.
Les noms de **villes** restent tels quels (données métier) ; `Corridor.tsx` n'est pas modifié.

## Règles à retenir
- Les valeurs métier envoyées au serveur restent en **français** (motif, catégories, ville « Autre ») ; seul l'affichage est traduit.
- La page publique de vérification d'un reçu (QR) n'est **pas** traduite (langue du lecteur inconnue).
- `KycStatusCard` et `services/kyc.ts` seront traités avec le lot Profil.

## Fichiers du lot
Mobile : `i18n/messages/activity.ts` (nouveau), `i18n/catalog.ts`, `utils/countryNames.ts` (nouveau), `utils/amount.ts` (déjà lot 3),
`app/(tabs)/transactions/{index,[id],client-receipt}.tsx`, `app/(tabs)/beneficiaries/{index,create,[id]}.tsx`,
`app/wallet-transfer.tsx`, `app/receipt/[id].tsx`, `services/transferReceipt.ts`, `components/receipt/TransferReceiptCard.tsx`.

## Vérifications
`tsc` mobile : 0 erreur · scanner i18n : plus de texte français (hors exemples « Mamadou / Diallo », « Mobile Money ») · jest backend : 36/36.

## Prochain lot (5)
Profil (infos, KYC, limites, appareils, moyens de paiement, sécurité, notifications, support, suppression), puis Marchand, scan/pay, légal.
