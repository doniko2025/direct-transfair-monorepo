# Langues FR / EN / PT — Lot 8 (final) : pages légales + passe finale

## Traduit dans ce lot
- **Conditions Générales d'Utilisation** (`app/(auth)/terms.tsx`) : tous les articles, puces, mentions légales, dates localisées (EN : « June 1, 2025 », PT : « 1 de junho de 2025 »).
- **Politique de confidentialité** (`app/(auth)/privacy-policy.tsx`) : 7 sections, droits RGPD, durées de conservation, contact DPO, réclamation auprès de l'autorité.
- Ligne « Connexion chiffrée · Vos données restent protégées » (`AuthShell`).
- Nouveau fichier de textes : `i18n/messages/legal.ts` (préfixes `tm.*` et `pp.*`), enregistré dans `i18n/catalog.ts`.
- Nouvel utilitaire `utils/richText.tsx` : affiche les passages `**en gras**` des textes légaux.

## ⚠️ Textes juridiques
Le **français reste la version de référence**. Les versions anglaise et portugaise sont des **traductions de courtoisie** : faites-les relire par un juriste avant publication.
Les valeurs issues de la configuration (juridiction compétente, raison sociale, régulateur, DPO, autorité de protection des données) restent telles que configurées par tenant.

## Hors périmètre (volontairement resté en français)
- Écrans agent (`app/agent/*`, `(tabs)/withdraw.tsx`, `ReceiptScannerModal`), modale de recharge d'agence, écrans admin.
- Composants non utilisés : `TransactionItem`, `CommissionFilter`, `FloatingSendButton`, `PasswordGuide` (remplacé par `PinGuide`), `TopBar`.
- Valeurs métier envoyées au serveur (catégories, pays, « Autre ») : seul l'affichage est traduit.
- En-têtes CSV générés côté serveur.
- Noms propres : Orange Money, Wave, WhatsApp, Mobile Money.

## Vérifications
- `npx tsc --noEmit` : aucune erreur.
- Catalogue : 2044 clés, 0 problème (doublons, variables `{…}` et pluriels identiques FR/EN/PT), 0 clé orpheline.
- Backend : 36 tests i18n / reçus réussis.

## Installation
Appliquer **après les lots 6 et 7** (`i18n/catalog.ts` est modifié). Aucune migration, aucune nouvelle dépendance.
