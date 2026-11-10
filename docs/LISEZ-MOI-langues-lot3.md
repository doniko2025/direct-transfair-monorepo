# Langues FR / EN / PT — Lot 3 : envoi d'argent et recharge

À appliquer par-dessus les lots 1 et 2. Aucune migration, aucune nouvelle dépendance, backend inchangé.

## Traduits dans ce lot
- **Envoi d'argent** (`app/(tabs)/send.tsx`) : modes Wallet / Cash Pickup, choix du destinataire (bénéficiaires, contacts du téléphone, nouveau), saisie du numéro et suggestions, montants et taux, frais, récapitulatif, motif, solde insuffisant, alertes, feuille de reçu, et le **texte du reçu partagé** (WhatsApp, SMS…).
- **Recharge du wallet** (`app/(tabs)/recharge.tsx`) et **recharge du compte** (`app/topup.tsx`) : méthodes, formulaires carte / Orange Money / Sendwave, confirmations et alertes.
- **Vérification d'identité requise** (`utils/kycGate.ts`) : l'invitation affichée quand un envoi est refusé tant que l'identité n'est pas validée.
- Les montants et les taux de ces écrans (et de tous ceux qui utilisent `utils/amount.ts`) suivent la langue choisie : `5 004,99` en français, `5,004.99` en anglais, `5 004,99` en portugais.

## Point d'attention : les motifs
Le motif d'un transfert est enregistré par le serveur **en français** (« Frais scolaires »…), comme avant. Seul son affichage change de langue. Pour afficher un motif relu du serveur (historique, détail, reçu), utiliser `motifLabel(valeur)` de `utils/motifs.ts` : un texte libre ou inconnu est rendu tel quel.

## Nouveautés techniques
- `i18n/messages/transfer.ts` (ajouté dans `i18n/catalog.ts`) et `utils/motifs.ts`.
- `utils/amount.ts` : `fmtMoney` / `fmtRate` lisent la langue courante.

## Limites connues
- Les noms de pays (feuille « Indicatif pays ») restent en français.
- `app/(tabs)/withdraw.tsx` (retrait en agence) et `RefillAgencyModal` sont des écrans **agent / admin** : volontairement hors périmètre (l'app client et marchand uniquement).
- `KycStatusCard` et les libellés d'état KYC (`services/kyc.ts`) seront traduits avec le lot profil / vérification d'identité.
- Transactions, détail, reçus, bénéficiaires, profil, marchand (caisse, retraits, réglages), CGU et confidentialité : lots suivants.

## Vérifications
`npx tsc --noEmit -p .` (mobile) : OK. Tests i18n du backend : 17 / 17.
