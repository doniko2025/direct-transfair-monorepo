# Phase 6 — Lot 1 : à appliquer

## Contenu du zip

- 24 fichiers **complets** à copier à leur emplacement (chemins relatifs à la racine du dépôt) : 16 fichiers de code, 8 fichiers de tests.
- `RAPPORT-phase6.md` : tous les constats classés par gravité, et les décisions qu'il me faut.
- Un seul fichier nouveau côté code : `apps/backend/src/auth/refresh-token.util.ts`.

## Avant de déployer

1. Dans `apps/backend` : `pnpm build` (j'ai pu compiler le backend ici, hors module `platform`, mais pas avec ta configuration exacte).
2. Aucune migration de base de données.
3. Les tests ont besoin de `jest` et `ts-jest`, absents de `apps/backend/package.json` (seul `@types/jest` y est) : `pnpm add -D jest ts-jest` si tu veux les lancer. Ils n'entrent pas dans `nest build`.

## Ce qui change pour les utilisateurs

- **Reconnexion unique pour les sessions ouvertes avant le déploiement** (web et mobile) : leur refresh token était stocké en clair et ne pouvait pas être renouvelé ; à l'expiration de l'access token (1 h) ils repassent par la page de connexion. Les nouvelles sessions se renouvellent normalement.
- Inscription publique : le champ `role` est ignoré, le compte créé est toujours un client.
- Un client ne peut plus annuler qu'un envoi (pas une recharge ni une facture B2B) ; une annulation faite deux fois répond « Transaction déjà traitée ou annulée ».
- Un agent ne peut payer en agence qu'un code d'envoi cash. Un code qui ne correspond à aucun envoi cash répond « Code invalide ou introuvable ».
- Un paiement en agence échoue avec « Wallet agence XXX introuvable » si la caisse n'a pas la devise du paiement (avant : il créditait une autre devise). À surveiller sur les agences à une seule devise.
- Frais : le tarif plat et le taux par défaut sont arrondis à l'unité de la devise (XOF, GNF : entier ; autres : 2 décimales).
- B2B rejeté : le remboursement revient sur le wallet de la société.

## Rien à changer côté web-admin

Aucun fichier web n'est modifié dans ce lot.
