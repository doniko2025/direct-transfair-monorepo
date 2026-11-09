# Fiche marchand : adresse du commerce, coordonnées et isolation client / marchand

## Ce qui change
- **Adresse du commerce obligatoire** (adresse + ville) à l'inscription et à l'activation ; **code postal facultatif**.
- Nouvelles informations facultatives : quartier / commune, pays, téléphone du commerce, NIF / IFU.
- Même bloc de champs dans : inscription marchand, « Devenir marchand », « Réglages du commerce » (un seul composant : `components/merchant/BusinessInfoFields.tsx`).
- Comptes marchands existants : rien ne casse. Ils peuvent changer leur nom sans adresse ; l'application les invite à la compléter (adresse et ville ne peuvent plus être vidées une fois saisies).
- Admin web : fiche marchand avec adresse complète, téléphone du commerce et NIF (le téléphone du responsable est libellé à part).

## Isolation compte client / compte marchand (corrigé)
- Inscription marchand : la ville du commerce n'est **plus reprise de la ville personnelle** du client (le serveur exige `businessCity`).
- « Devenir marchand » : plus aucun pré-remplissage depuis la ville personnelle.
- Adresse, code postal et téléphone du commerce sont stockés sur `merchant_profiles`, jamais sur `users`.
- Déjà isolés avant ce lot (vérifié) : portefeuilles (`wallets.merchantId`, `userId` nul), historique (`?space=`), notifications, tickets de support, plafonds de transfert (ne comptent que TRANSFER / SCHEDULED), impossibilité de se payer soi-même.

## Mise en production
1. Appliquer le zip.
2. `cd apps/backend && npx prisma migrate deploy && npx prisma generate` — migration `20261117090000_merchant_address_details` (5 colonnes facultatives, idempotente).
3. Redémarrer le backend, puis relancer Expo avec `npx expo start -c`.

⚠️ L'erreur « Service momentanément indisponible » sur « Devenir marchand » vient très probablement de migrations marchand non appliquées sur la base du serveur (`npx prisma migrate status` pour le confirmer).

## Vérifications
- Backend : suites merchants + inscription marchand → 195 tests verts (nouveaux tests : validation, mise à jour, isolation de la ville).
- `tsc --noEmit` mobile et web-admin : aucune erreur.
- Aucun commit ni push.
